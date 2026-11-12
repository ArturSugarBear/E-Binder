import { scanProgress } from './scan-progress';
import {
  candidatesFromText,
  recognitionClues,
  visualNumberClues,
  fetchCatalogCard,
  fetchRecognizedCards,
  fetchNameHintCandidates,
  searchCatalog,
} from '../data/card-catalog';
import { extractPagePockets } from '../data/page-pockets';
import { autoAlignPage } from '../data/auto-page-align';
import { likelyEmptyPocket } from '../data/pocket-occupancy';
import { inspectPocketPhoto } from '../data/photo-quality';
import { createRecognitionSession } from '../data/recognize';
import { createVisualSearchSession } from '../data/visual-search';
import { anniversaryEnergyFromText } from '../domain/anniversary-energy';
import {
  reviewVisualCandidates,
  type VisualHit,
} from '../domain/visual-retrieval';
import {
  finishLabels,
  finishes,
  importScannedPage,
  normalize,
  type Finish,
  type PersonalCard,
  type ScannedCardChoice,
} from '../domain/personal';
import {
  action,
  el,
  errorText,
  field,
  input,
  message,
  modal,
  select,
} from './workspace-dom';
import { alignPhoto } from './photo-crop';
import { openLivePageScanner } from './live-page-scan';
import { animateResolvedPocket } from './collector-polish';
import { rankScanCandidates } from '../data/scan-review';
import { discoverNumberedCards } from '../data/scan-auto-resolve';
import { type PocketDecision } from '../domain/binder-scan-review';
import { recordBetaEvent } from '../data/beta-diagnostics';
import { donateBetaScanPhoto } from '../data/beta-scan-donation';
import type { WorkspaceContext } from './workspace-context';

type Decision = PocketDecision;
type Pocket = {
  decision: Decision;
  candidates: PersonalCard[];
  card?: PersonalCard;
  suggested?: PersonalCard;
  select: HTMLSelectElement;
  finish: HTMLSelectElement;
  variant: HTMLInputElement;
  search: HTMLInputElement;
  status: HTMLElement;
  quality: HTMLElement;
  quickChoices?: HTMLElement;
  container?: HTMLElement;
  editor?: HTMLDetailsElement;
  tileButton?: HTMLButtonElement;
  previewUrl?: string;
  emptySuggested?: boolean;
  ocrText?: string;
};

/** Import a physical binder as repeated, explicitly reviewed 3x3 page captures. */
export function openPageScanner(
  ctx: WorkspaceContext,
  selectedBinderId?: string,
): void {
  const sheet = modal('Binderseiten scannen', true);
  sheet.dialog.classList.add('w-page-scan-dialog');
  const lifetime = new AbortController();
  let recognitionAbort: AbortController | undefined;
  let sharedRecognitionAbort: AbortController | undefined;
  let sharedRecognition:
    ReturnType<typeof createRecognitionSession> | undefined;
  let sharedVisualPromise:
    ReturnType<typeof createVisualSearchSession> | undefined;
  let closed = false;
  let processing = false;
  let reAligning = false;
  let current: File | undefined;
  let fingerprint = '';
  let queued: File[] = [];
  let pockets: Pocket[] = [];
  let previews: string[] = [];
  const status = el(
    'p',
    'w-message',
    'Fotografiere die komplette 3×3-Seite möglichst gerade und mit lesbaren Kartenrändern.',
  );
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const queueStatus = el('p', 'w-muted');
  const grid = el('div', 'w-page-scan-grid');
  const reviewSummary = el('p', 'w-muted w-page-scan-summary');
  const editorHost = el('div', 'w-page-scan-editor-host');
  const reviewHeading = el('h3', '', 'Fach prüfen');
  const reviewHint = el('p', 'w-muted');
  const reviewPhoto = el('img', 'w-page-scan-review-photo');
  reviewPhoto.alt = 'Vergrößerte Karte im ausgewählten Binderfach';
  const reviewPanel = el(
    'section',
    'w-page-scan-review-panel',
    reviewHeading,
    reviewHint,
    reviewPhoto,
    editorHost,
  );
  reviewPanel.tabIndex = -1;
  reviewPanel.setAttribute('aria-label', 'Ausgewähltes Binderfach prüfen');
  reviewPanel.hidden = true;
  let activePocket = -1;
  const journey = scanProgress(9);
  const progress = el('progress', 'w-progress');
  progress.max = 9;
  progress.hidden = true;
  const gallery = input('file');
  gallery.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
  gallery.multiple = true;
  gallery.hidden = true;
  const camera = input('file');
  camera.accept = 'image/*';
  camera.setAttribute('capture', 'environment');
  camera.hidden = true;
  const binder = select(
    [
      ['', 'Neuen Binder anlegen'],
      ...ctx.state.binders.map(
        (item) => [item.id, item.name] as [string, string],
      ),
    ],
    selectedBinderId ?? '',
  );
  const binderName = input('text', 'Mein gescannter Binder');
  binderName.maxLength = 200;
  const binderNameField = field('Name des neuen Binders', binderName);
  binderNameField.hidden = Boolean(binder.value);
  binder.addEventListener('change', () => {
    binderNameField.hidden = Boolean(binder.value);
  });
  const language = select([
    ['auto', 'Automatisch (DE/EN/JA)'],
    ['de', 'Deutsch'],
    ['en', 'Englisch'],
    ['ja', 'Japanisch'],
  ]);
  language.value = 'auto';
  const preferredLanguage = (text: string) => {
    if (language.value !== 'auto') return language.value;
    const printed = recognitionClues(text).find(
      (clue) => clue.language,
    )?.language;
    if (printed) return printed;
    if (/[\u3040-\u30ff]/.test(text)) return 'ja';
    if (/\b(BASIC|ABILITY|WEAKNESS|RETREAT)\b/i.test(text)) return 'en';
    return 'de';
  };
  const scanOptions = el(
    'details',
    'w-page-scan-options',
    el('summary', '', 'Erweiterte Scanoptionen'),
    field('Sprache der Karten (optional)', language),
  );
  const manualAlign = action(
    'Zuschnitt korrigieren',
    () => {
      if (!current || processing || reAligning) return;
      const photo = current;
      reAligning = true;
      grid.dataset.scanState = 'aligning';
      updateSave();
      void (async () => {
        try {
          const aligned = await alignPhoto(photo, lifetime.signal, 'page');
          if (
            !aligned ||
            closed ||
            lifetime.signal.aborted ||
            current !== photo
          )
            return;
          const tiles = await extractPagePockets(aligned, lifetime.signal);
          if (closed || lifetime.signal.aborted || current !== photo) return;
          releasePreviews();
          grid.dataset.scanGeometry = 'manual';
          grid.dataset.scanAdjustment = 'manual';
          buildGrid(tiles);
          void recognizeAll(tiles);
        } catch (error) {
          if (!closed) status.textContent = errorText(error);
        } finally {
          reAligning = false;
          updateSave();
        }
      })();
    },
    'secondary',
  );
  manualAlign.hidden = true;
  const skipPage = action(
    'Seite überspringen',
    () => {
      if (!current || processing || reAligning) return;
      releasePreviews();
      grid.replaceChildren();
      editorHost.replaceChildren();
      reviewPanel.hidden = true;
      activePocket = -1;
      pockets = [];
      current = undefined;
      manualAlign.hidden = true;
      skipPage.hidden = true;
      updateSave();
      reportQueue();
      if (queued.length) void nextPage();
      else
        status.textContent = 'Seite ausgelassen. Kein Bestand wurde verändert.';
    },
    'secondary',
  );
  skipPage.hidden = true;
  const stop = action(
    'Erkennung stoppen',
    () => recognitionAbort?.abort(),
    'secondary',
  );
  stop.hidden = true;
  const acceptSuggestions = action(
    'Sichere Vorschläge auswählen',
    () => {
      if (processing || reAligning) return;
      let chosen = 0;
      for (const pocket of pockets) {
        if (pocket.decision !== 'pending' || !pocket.suggested) continue;
        const index = pocket.candidates.findIndex(
          (card) => card.key === pocket.suggested?.key,
        );
        if (index < 0) continue;
        pocket.select.value = 'card:' + index;
        updatePocket(pocket, true);
        chosen++;
      }
      if (chosen) {
        status.textContent =
          chosen +
          ' Vorschläge ausgewählt. Prüfe die Kartenausgaben im Raster und tippe erst danach auf „Karten übernehmen“.';
        updateSave();
      }
    },
    'secondary',
    'check',
  );
  acceptSuggestions.hidden = true;
  const save = action(
    'Gefundene Karten übernehmen',
    () => {
      if (!current || processing) return;
      const slots: (ScannedCardChoice | null)[] = pockets.map((pocket) =>
        pocket.decision === 'card' && pocket.card
          ? {
              card: pocket.card,
              finish: pocket.finish.value as Finish,
              variantNote: pocket.variant.value,
            }
          : null,
      );
      const acceptedCount = slots.filter(Boolean).length;
      if (!acceptedCount) {
        status.textContent =
          'Noch keine Kartenausgabe erkannt. Prüfe ein Fach oder fotografiere die Seite erneut.';
        return;
      }
      if (
        !ctx.commit('Binderseite aus Foto übernommen', (state) =>
          importScannedPage(state, {
            fingerprint,
            binderId: binder.value || undefined,
            binderName: binderName.value,
            slots,
          }),
        )
      )
        return;
      recordBetaEvent('scan_review', 'scan', 'page_imported', 'ok', {
        metric: slots.filter(Boolean).length,
      });
      const id = ctx.state.lastBinderId;
      if (id && ![...binder.options].some((option) => option.value === id)) {
        const option = el(
          'option',
          '',
          ctx.state.binders.find((item) => item.id === id)?.name ?? 'Binder',
        );
        option.value = id;
        binder.append(option);
      }
      if (id) binder.value = id;
      binderNameField.hidden = true;
      releasePreviews();
      current = undefined;
      manualAlign.hidden = true;
      skipPage.hidden = true;
      pockets = [];
      grid.replaceChildren();
      editorHost.replaceChildren();
      reviewPanel.hidden = true;
      activePocket = -1;
      if (queued.length) {
        void nextPage();
      } else {
        sheet.close();
        ctx.navigate('binder');
      }
    },
    'primary',
    'check',
  );
  save.disabled = true;
  const skipUnresolved = action(
    'Offene Fächer ungeklärt lassen',
    () => {
      if (processing || reAligning || pockets.length !== 9) return;
      for (const pocket of pockets)
        if (pocket.decision === 'pending') {
          pocket.select.value = 'skip';
          updatePocket(pocket, true);
        }
    },
    'secondary',
  );
  skipUnresolved.hidden = true;
  const confirmEmptyHints = action(
    'Als leer erkannte Fächer bestätigen',
    () => {
      if (processing || reAligning || pockets.length !== 9) return;
      for (const pocket of pockets)
        if (pocket.emptySuggested && pocket.decision === 'pending') {
          pocket.select.value = 'empty';
          updatePocket(pocket, true);
        }
    },
    'secondary',
  );
  confirmEmptyHints.hidden = true;
  const reviewBulk = el(
    'details',
    'w-page-scan-bulk-actions',
    el('summary', '', 'Weitere Prüfoptionen'),
    el('div', 'w-action-row', confirmEmptyHints, skipUnresolved),
  );
  const updateSave = () => {
    manualAlign.disabled = !current || processing || reAligning;
    skipPage.disabled = !current || processing || reAligning;
    save.disabled =
      !current ||
      processing ||
      reAligning ||
      !pockets.some((pocket) => pocket.decision === 'card') ||
      pockets.some(
        (pocket) =>
          pocket.decision === 'card' &&
          (!pocket.card ||
            (pocket.finish.value === 'other' && !pocket.variant.value.trim())),
      );
    const matches = pockets.filter(
      (pocket) => pocket.decision === 'card',
    ).length;
    const open = pockets.filter(
      (pocket) => pocket.decision === 'pending',
    ).length;
    const skipped = pockets.filter(
      (pocket) => pocket.decision === 'skip',
    ).length;
    const suggestedCount = pockets.filter(
      (pocket) => pocket.decision === 'pending' && pocket.suggested,
    ).length;
    if (!pockets.length) {
      reviewSummary.textContent = 'Bereit für deine Binderseite.';
    } else if (matches > 0) {
      reviewSummary.textContent = `${matches} ${matches === 1 ? 'Karte' : 'Karten'} ausgewählt · ${open + skipped} offen. Nur ausgewählte Karten werden übernommen.`;
    } else if (processing) {
      reviewSummary.textContent = 'Deine Karten werden geprüft …';
    } else if (suggestedCount > 0) {
      reviewSummary.textContent = `${suggestedCount} ${suggestedCount === 1 ? 'passender Vorschlag' : 'passende Vorschläge'} gefunden · vor dem Übernehmen auswählen.`;
    } else {
      reviewSummary.textContent =
        'Noch keine eindeutige Ausgabe. Tippe auf ein Fach, um die Karte zu prüfen.';
    }
    save.querySelector('span')!.textContent =
      matches > 0
        ? `${matches} ${matches === 1 ? 'Karte' : 'Karten'} übernehmen`
        : 'Noch keine Karten ausgewählt';
    acceptSuggestions.hidden = processing || suggestedCount === 0;
    acceptSuggestions.querySelector('span')!.textContent =
      suggestedCount +
      ' eindeutige ' +
      (suggestedCount === 1 ? 'Ausgabe' : 'Ausgaben') +
      ' auswählen';
    skipUnresolved.hidden = open === 0;
    skipUnresolved.disabled = processing || reAligning || open === 0;
    const emptyHints = pockets.filter(
      (pocket) => pocket.decision === 'pending' && pocket.emptySuggested,
    ).length;
    confirmEmptyHints.hidden = emptyHints === 0;
    confirmEmptyHints.disabled = processing || reAligning || emptyHints === 0;
    const selected = pockets[activePocket];
    if (selected && !reviewPanel.hidden)
      reviewHint.textContent = selected.status.textContent ?? '';
  };
  const reportQueue = () => {
    queueStatus.textContent = `${current ? 'Eine Seite in Prüfung. ' : ''}${queued.length} weitere Seiten vorgemerkt.`;
  };
  const releasePreviews = () => {
    for (const url of previews) URL.revokeObjectURL(url);
    previews = [];
  };
  sheet.onClose(() => {
    closed = true;
    recognitionAbort?.abort();
    lifetime.abort();
    releasePreviews();
    queued = [];
  });
  sheet.body.append(
    message(
      'Richte die vollständige 3×3-Seite in der Live-Kamera aus oder nutze ein Foto. E-Binder zerlegt sie anschließend in neun Positionen. Keine Karte zählt vor deiner Prüfung als Besitz.',
    ),
    el(
      'ol',
      'w-page-scan-steps',
      el('li', '', '1 · Ganze Seite aufnehmen'),
      el('li', '', '2 · Neun Fächer prüfen'),
      el('li', '', '3 · Binder übernehmen'),
    ),
    el('div', 'w-form-grid', field('Zielbinder', binder), binderNameField),
    el(
      'div',
      'w-action-row w-page-scan-entry',
      action(
        'Binderseite live scannen',
        () =>
          openLivePageScanner(
            (file) => enqueue([file]),
            () => camera.click(),
            () => {
              sheet.close();
              ctx.openAdd({ live: true });
            },
          ),
        'primary',
        'camera',
      ),
      action(
        'Kamerafoto verwenden',
        () => camera.click(),
        'secondary',
        'camera',
      ),
      action(
        'Mehrere Seiten auswählen',
        () => gallery.click(),
        'secondary',
        'upload',
      ),
    ),
    camera,
    gallery,
    scanOptions,
    el('div', 'w-action-row', manualAlign, skipPage),
    queueStatus,
    status,
    journey.element,
    progress,
    grid,
    reviewSummary,
    acceptSuggestions,
    reviewBulk,
    reviewPanel,
  );
  sheet.footer.append(stop, save);
  reportQueue();

  const updatePocket = (pocket: Pocket, reviewed = false) => {
    const selected = pocket.select.value;
    if (selected === 'empty' || selected === 'skip') {
      pocket.decision = selected;
      pocket.card = undefined;
    } else if (selected.startsWith('card:')) {
      const index = Number(selected.slice(5));
      pocket.card = pocket.candidates[index];
      pocket.decision = pocket.card ? 'card' : 'pending';
    } else {
      pocket.card = undefined;
      pocket.decision = 'pending';
    }
    if (pocket.decision === 'card' && pocket.card)
      pocket.status.textContent = `${pocket.card.name} · ${pocket.card.number}`;
    else if (pocket.decision === 'empty')
      pocket.status.textContent = 'Leer bestätigt · jederzeit korrigierbar';
    else if (pocket.decision === 'skip')
      pocket.status.textContent = 'Nicht zugeordnet';
    if (pocket.container) pocket.container.dataset.decision = pocket.decision;
    if (reviewed)
      recordBetaEvent('scan_review', 'scan', 'page_pocket_reviewed', 'ok', {
        selected:
          pocket.card?.source === 'tcgdex' ? pocket.card.key : undefined,
        metric: pockets.indexOf(pocket) + 1,
      });
    pocket.tileButton?.setAttribute(
      'aria-label',
      `Fach ${pockets.indexOf(pocket) + 1} prüfen · ${pocket.decision === 'card' ? 'Karte ausgewählt' : pocket.decision === 'empty' ? 'Leer bestätigt' : pocket.decision === 'skip' ? 'Ungeklärt' : 'Offen'}`,
    );
    pocket.quickChoices
      ?.querySelectorAll<HTMLButtonElement>('.w-page-scan-candidate')
      .forEach((button, index) =>
        button.setAttribute(
          'aria-pressed',
          String(
            pocket.decision === 'card' &&
              pocket.select.value === `card:${index}`,
          ),
        ),
      );
    pocket.finish.hidden = pocket.decision !== 'card';
    pocket.variant.hidden =
      pocket.decision !== 'card' || pocket.finish.value !== 'other';
    updateSave();
  };
  const displayCandidates = (pocket: Pocket, cards: PersonalCard[]) => {
    const previousKey = pocket.card?.key;
    pocket.candidates = [
      ...new Map(
        [...pocket.candidates, ...cards].map((card) => [card.key, card]),
      ).values(),
    ].slice(0, 14);
    if (pocket.container)
      pocket.container.dataset.scanRankedKeys = JSON.stringify(
        pocket.candidates.map((card) => card.key),
      );
    const options: [string, string][] = [
      ['', 'Karte auswählen / prüfen'],
      ['empty', 'Fach ist leer'],
      ['skip', 'Nicht erkannt – leer lassen'],
      ...pocket.candidates.map(
        (card, index) =>
          [
            `card:${index}`,
            `${card.name} · ${card.setName} · ${card.number}`,
          ] as [string, string],
      ),
    ];
    const old = pocket.decision;
    const value =
      old === 'card'
        ? `card:${pocket.candidates.findIndex((card) => card.key === previousKey)}`
        : old === 'pending'
          ? ''
          : old;
    pocket.select.replaceChildren();
    for (const [key, caption] of options) {
      const choice = el('option', '', caption);
      choice.value = key;
      if (key.startsWith('card:')) {
        const card = pocket.candidates[Number(key.slice(5))];
        if (card) choice.dataset.cardKey = card.key;
      }
      pocket.select.append(choice);
    }
    pocket.select.value = value;
    pocket.quickChoices?.replaceChildren();
    for (const [index, card] of pocket.candidates.slice(0, 3).entries()) {
      const choice = action(
        `${card.name} · ${card.setName} · ${card.number}`,
        () => {
          pocket.select.value = `card:${index}`;
          updatePocket(pocket, true);
        },
        'card',
      );
      choice.classList.add('w-page-scan-candidate');
      choice.replaceChildren(
        ctx.images.artwork(card),
        el(
          'span',
          'w-page-scan-candidate-caption',
          el('strong', '', card.name),
          el('small', '', `${card.setName} · ${card.number}`),
        ),
      );
      choice.setAttribute(
        'aria-label',
        `${card.name}, ${card.setName}, ${card.number} für Fach auswählen`,
      );
      pocket.quickChoices?.append(choice);
    }
    updatePocket(pocket);
  };
  const showPocket = (index: number) => {
    const pocket = pockets[index];
    if (!pocket?.editor || !pocket.previewUrl) return;
    activePocket = index;
    reviewPanel.hidden = false;
    reviewHeading.textContent = `Fach ${index + 1} von 9 prüfen`;
    reviewHint.textContent = pocket.status.textContent ?? '';
    reviewPhoto.src = pocket.previewUrl;
    pockets.forEach((item, position) => {
      if (!item.editor) return;
      item.editor.hidden = position !== index;
      item.editor.open = position === index;
      item.tileButton?.setAttribute('aria-pressed', String(position === index));
    });
    reviewPanel.scrollIntoView({ block: 'nearest' });
  };
  const nextPocket = () => {
    if (!pockets.length) return;
    const next = pockets.findIndex(
      (pocket, index) => index > activePocket && pocket.decision === 'pending',
    );
    const first = pockets.findIndex((pocket) => pocket.decision === 'pending');
    showPocket(next >= 0 ? next : first >= 0 ? first : (activePocket + 1) % 9);
  };
  const reviewButtons = el(
    'div',
    'w-action-row w-page-scan-review-buttons',
    action(
      'Fach als leer bestätigen',
      () => {
        const pocket = pockets[activePocket];
        if (!pocket) return;
        pocket.select.value = 'empty';
        updatePocket(pocket, true);
        nextPocket();
      },
      'secondary',
    ),
    action(
      'Fach ungeklärt lassen',
      () => {
        const pocket = pockets[activePocket];
        if (!pocket) return;
        pocket.select.value = 'skip';
        updatePocket(pocket, true);
        nextPocket();
      },
      'secondary',
    ),
    action('Nächstes Fach prüfen', nextPocket, 'primary'),
    action(
      'Zur 3×3-Übersicht',
      () => {
        reviewPanel.hidden = true;
        activePocket = -1;
        pockets.forEach((pocket) => {
          if (pocket.editor) pocket.editor.open = false;
          pocket.tileButton?.setAttribute('aria-pressed', 'false');
        });
      },
      'secondary',
    ),
  );
  reviewPanel.append(reviewButtons);
  const searchPocket = async (pocket: Pocket) => {
    const query = pocket.search.value.trim();
    if (query.length < 2) {
      pocket.status.textContent = 'Gib mindestens zwei Zeichen ein.';
      return;
    }
    pocket.status.textContent = 'Katalogsuche …';
    try {
      const existing = [
        ...ctx.catalog,
        ...ctx.state.holdings.map((holding) => holding.card),
      ].filter((card) =>
        normalize(`${card.name} ${card.setName} ${card.number}`).includes(
          normalize(query),
        ),
      );
      let online: PersonalCard[] = [];
      if (navigator.onLine) {
        const locales =
          language.value === 'auto' ? ['de', 'en', 'ja'] : [language.value];
        const batches = await Promise.allSettled(
          locales.map(async (locale) => {
            const found = await searchCatalog(query, locale, lifetime.signal);
            const resolved = await Promise.allSettled(
              found
                .slice(0, 6)
                .map((item) =>
                  fetchCatalogCard(item.id, locale, lifetime.signal),
                ),
            );
            return resolved.flatMap((result) =>
              result.status === 'fulfilled' ? [result.value] : [],
            );
          }),
        );
        online = batches.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : [],
        );
      }
      if (closed || lifetime.signal.aborted) return;
      displayCandidates(pocket, [...online, ...existing]);
      pocket.status.textContent =
        online.length + existing.length
          ? 'Wähle die genaue Kartenausgabe. Druckdetails sind optional.'
          : 'Keine passende Ausgabe. Diese Position kann ungeklärt bleiben.';
    } catch {
      if (!closed && !lifetime.signal.aborted)
        pocket.status.textContent =
          'Katalog derzeit nicht erreichbar. Du kannst die Position überspringen.';
    }
  };
  const buildGrid = (tiles: Blob[]) => {
    grid.replaceChildren();
    editorHost.replaceChildren();
    reviewPanel.hidden = true;
    activePocket = -1;
    pockets = [];
    for (const [index, tile] of tiles.entries()) {
      const url = URL.createObjectURL(tile);
      previews.push(url);
      const photo = el('img', 'w-page-scan-pocket-image');
      photo.src = url;
      photo.alt = `Foto von Binderfach ${index + 1}`;
      const pick = select([
        ['', 'Karte auswählen / prüfen'],
        ['empty', 'Fach ist leer'],
        ['skip', 'Nicht erkannt – leer lassen'],
      ]);
      const finish = select(
        [
          ['unverified', 'Nicht bestimmt (später ändern)'],
          ...finishes
            .filter((key) => key !== 'unverified')
            .map((key) => [key, finishLabels[key]] as [string, string]),
        ],
        'unverified',
      );
      finish.hidden = true;
      const variant = input('text');
      variant.placeholder = 'Auflage / Stempel beschreiben';
      variant.setAttribute(
        'aria-label',
        `Auflage oder Stempel für Fach ${index + 1}`,
      );
      variant.maxLength = 200;
      variant.hidden = true;
      const query = input('search');
      query.placeholder = 'Name oder Sammlernummer';
      query.setAttribute('aria-label', `Karte in Fach ${index + 1} suchen`);
      const info = el('small', 'w-muted', 'Noch nicht erkannt');
      const quality = el(
        'small',
        'w-muted w-page-scan-quality',
        'Bildqualität wird geprüft …',
      );
      const quickChoices = el('div', 'w-page-scan-candidates');
      const pocket: Pocket = {
        previewUrl: url,
        quickChoices,
        candidates: [],
        decision: 'pending',
        select: pick,
        finish,
        variant,
        search: query,
        status: info,
        quality,
      };
      pockets.push(pocket);
      pick.setAttribute('aria-label', `Karte für Fach ${index + 1} auswählen`);
      finish.setAttribute('aria-label', `Druckvariante für Fach ${index + 1}`);
      pick.addEventListener('change', () => updatePocket(pocket, true));
      finish.addEventListener('change', () => updatePocket(pocket));
      variant.addEventListener('input', updateSave);
      const searchButton = action(
        'Suchen',
        () => void searchPocket(pocket),
        'secondary',
        'search',
      );
      searchButton.setAttribute(
        'aria-label',
        `Katalogsuche für Fach ${index + 1}`,
      );
      query.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void searchPocket(pocket);
        }
      });
      const tileButton = action(
        `Fach ${index + 1} prüfen`,
        () => showPocket(index),
        'card',
      );
      tileButton.classList.add('w-page-scan-open-pocket');
      tileButton.setAttribute('aria-pressed', 'false');
      tileButton.setAttribute('aria-label', `Fach ${index + 1} prüfen · Offen`);
      tileButton.replaceChildren(
        el('div', 'w-page-scan-photo-frame', photo),
        el('strong', 'w-page-scan-pocket-label', `Fach ${index + 1}`),
      );
      const editor = el(
        'details',
        'w-page-scan-editor',
        el('summary', '', 'Kartenausgabe prüfen oder korrigieren'),
        quickChoices,
        pick,
        finish,
        variant,
        el('div', 'w-page-scan-search', query, searchButton),
      );
      editor.hidden = true;
      editorHost.append(editor);
      const container = el(
        'section',
        'w-page-scan-pocket',
        tileButton,
        info,
        quality,
      );
      pocket.editor = editor;
      pocket.tileButton = tileButton;
      pocket.container = container;
      container.dataset.decision = 'pending';
      container.dataset.recognitionState = 'pending';
      container.dataset.scanRankedKeys = '[]';
      grid.append(container);
    }
    grid.dataset.scanResultContract = '1';
    grid.dataset.scanState = 'pending';
    updateSave();
  };
  const recognizeAll = async (tiles: Blob[]) => {
    if (
      !sharedRecognition ||
      !sharedRecognitionAbort ||
      sharedRecognitionAbort.signal.aborted
    ) {
      const controller = new AbortController();
      sharedRecognitionAbort = controller;
      lifetime.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
      sharedVisualPromise = undefined;
      sharedRecognition = createRecognitionSession(
        controller.signal,
        (label) => {
          status.textContent = 'Binderkarten werden gelesen · ' + label;
        },
      );
      // Start loading ONNX immediately, before per-card quality inspection.
      sharedRecognition.warmup();
    }
    const abort = sharedRecognitionAbort;
    const session = sharedRecognition;
    recognitionAbort = abort;
    processing = true;
    grid.dataset.scanState = 'running';
    progress.hidden = false;
    progress.value = 0;
    journey.update('recognize', 'Fächer werden einzeln geprüft …', 0);
    stop.hidden = false;
    updateSave();
    try {
      // Optional visual search is local and prepared once per binder scan.
      // Until a versioned licensed model/corpus is installed, the OCR path remains.
      const visual = await (sharedVisualPromise ??= createVisualSearchSession(
        abort.signal,
      ));
      if (closed || abort.signal.aborted) return;
      let visualFailure = false;
      // Small, sequential decodes keep peak RAM bounded on older iPhones.
      // Diagnostics only advise retakes; they never auto-mark a pocket as empty.
      for (let index = 0; index < tiles.length; index++) {
        if (closed || abort.signal.aborted) break;
        const pocket = pockets[index]!;
        status.textContent = `Fach ${index + 1} von ${tiles.length} · Texterkennung läuft …`;
        try {
          const inspection = await inspectPocketPhoto(
            tiles[index]!,
            abort.signal,
          );
          if (closed || abort.signal.aborted) break;
          const quality = pockets[index]!.quality;
          quality.hidden = inspection.warnings.length === 0;
          quality.textContent = inspection.warnings.length
            ? `Aufnahmehinweis: ${inspection.warnings.join(' · ')}`
            : 'Keine deutlichen Belichtungsprobleme erkannt';
          quality.dataset.warning = inspection.warnings.length
            ? 'true'
            : 'false';
        } catch {
          if (closed || abort.signal.aborted) break;
          pockets[index]!.quality.hidden = false;
          pockets[index]!.quality.textContent =
            'Fotoqualität konnte nicht geprüft werden. Bitte selbst kontrollieren.';
        }
        try {
          if (await likelyEmptyPocket(tiles[index]!, abort.signal)) {
            if (closed || abort.signal.aborted) break;
            // This is a hint, not a decision: a dark or reflective card
            // must not silently disappear from the collector's binder.
            pocket.emptySuggested = true;
            pocket.container!.dataset.recognitionState = 'empty-suggested';
            recordBetaEvent(
              'scan_result',
              'scan',
              'page_pocket_empty_hint',
              'unknown',
              { metric: index + 1 },
            );
            pocket.status.textContent = 'Vermutlich leer · bitte bestätigen';
            animateResolvedPocket(pocket.container, 'unknown');
            updateSave();
            pocket.container?.classList.add('is-processed');
            progress.value = index + 1;
            journey.update(
              'recognize',
              `${index + 1} von 9 Fächern geprüft`,
              index + 1,
            );
            status.textContent = `${index + 1} von 9 Fächern geprüft.`;
            continue;
          }
        } catch {
          if (closed || abort.signal.aborted) break;
          // If occupancy cannot be determined, try OCR instead.
        }
        pocket.status.textContent = 'Lese Karte …';
        pocket.container?.classList.remove('is-processed');
        pocket.container?.classList.add('is-scanning');
        try {
          let visualHits: VisualHit[] = [];
          if (visual && !visualFailure) {
            try {
              pocket.status.textContent = 'Kartenmotiv wird lokal verglichen …';
              visualHits = await visual.match(tiles[index]!);
              if (closed || abort.signal.aborted) break;
            } catch {
              visualFailure = true;
              visual.close();
              // Never make an optional embedding model block OCR or ownership review.
            }
          }
          const text = await session.recognize(
            tiles[index]!,
            visualHits.length > 0,
          );
          if (closed || abort.signal.aborted) break;
          pocket.ocrText = text;
          const visualReview = reviewVisualCandidates(
            visualHits,
            visualNumberClues(text),
          );
          const existingCards = [
            ...ctx.catalog,
            ...ctx.state.holdings.map((holding) => holding.card),
          ];
          const localVisual = visualReview.choices.flatMap((hit) => {
            const sourceId = hit.reference.id.split(':').at(-1)!;
            return existingCards.filter(
              (card) =>
                card.sourceId === sourceId &&
                card.language === hit.reference.language &&
                card.setId === hit.reference.setId,
            );
          });
          let resolvedVisual = [...localVisual];
          if (visualReview.choices.length && navigator.onLine) {
            // Fetch only the three best image candidates, never a full catalog.
            const candidateSignal = AbortSignal.any([
              abort.signal,
              AbortSignal.timeout(10000),
            ]);
            const found = await Promise.allSettled(
              visualReview.choices.map((hit) => {
                const sourceId = hit.reference.id.split(':').at(-1)!;
                return fetchCatalogCard(
                  sourceId,
                  hit.reference.language,
                  candidateSignal,
                );
              }),
            );
            if (closed || abort.signal.aborted) break;
            resolvedVisual = [
              ...found.flatMap((item) =>
                item.status === 'fulfilled' ? [item.value] : [],
              ),
              ...localVisual,
            ];
          }
          const printedEnergy = anniversaryEnergyFromText(
            text,
            preferredLanguage(text),
          );
          const local = candidatesFromText(text, [
            ...ctx.catalog,
            ...ctx.state.holdings.map((holding) => holding.card),
          ]);
          let online: PersonalCard[] = [];
          let catalogFailed = false;
          // Never make one bad TCGdex request stall a whole 9-pocket page.
          const lookupSignal = AbortSignal.any([
            abort.signal,
            AbortSignal.timeout(11000),
          ]);
          if (
            !printedEnergy.length &&
            navigator.onLine &&
            text.trim() &&
            (!resolvedVisual.length || visualReview.kind !== 'exact-print')
          ) {
            try {
              // When Japanese characters are unreadable, a numeric fraction
              // still identifies candidates in Japanese catalogues. Explore
              // DE/EN/JA in parallel rather than assuming German from OCR.
              online = recognitionClues(text).some((clue) => clue.setId)
                ? await fetchRecognizedCards(
                    text,
                    preferredLanguage(text),
                    lookupSignal,
                  )
                : await discoverNumberedCards(
                    text,
                    preferredLanguage(text),
                    lookupSignal,
                  );
            } catch {
              catalogFailed = true;
              // OCR and local cards remain available without a connection.
            }
          }
          if (closed || abort.signal.aborted) break;
          let titleHint = '';
          if (
            !printedEnergy.length &&
            navigator.onLine &&
            text.trim() &&
            !online.length &&
            !resolvedVisual.length
          ) {
            try {
              pocket.status.textContent =
                'Kartenname wird im Katalog gesucht …';
              const hint = await fetchNameHintCandidates(
                text,
                preferredLanguage(text),
                lookupSignal,
              );
              online = hint.candidates;
              titleHint = hint.query;
            } catch {
              catalogFailed = true;
              // Never substitute a guessed printing for an unavailable lookup.
            }
          }
          if (closed || abort.signal.aborted) break;
          // One set+number+full-name policy for single-card and binder scans.
          // A contradictory OCR title cannot become an automatic match.
          const ranked = rankScanCandidates(
            text,
            printedEnergy.length
              ? printedEnergy
              : [...resolvedVisual, ...online, ...local],
          );
          displayCandidates(pocket, ranked.candidates);
          if (titleHint) pocket.search.value = titleHint;
          pocket.container!.dataset.recognitionState = pocket.candidates.length
            ? catalogFailed
              ? 'partial-catalog'
              : 'suggestions'
            : !navigator.onLine
              ? 'offline'
              : catalogFailed
                ? 'catalog-error'
                : 'no-candidates';
          const preferred = ranked.suggested;
          pocket.suggested = preferred;
          const exactIndex = preferred
            ? pocket.candidates.findIndex((card) => card.key === preferred.key)
            : -1;
          // Even strong OCR evidence is only a recommendation. Explicitly
          // tapping/selecting the printing is required before page import.
          const matched = exactIndex >= 0;
          if (matched) {
            pocket.container!.dataset.suggestedCardKey = preferred!.key;
          }
          pocket.status.textContent = matched
            ? `Vorschlag: ${preferred!.name} · ${preferred!.number}`
            : resolvedVisual.length
              ? `${resolvedVisual.length} visuelle Kandidaten · Ausgabe prüfen`
              : ranked.conflictingName
                ? 'Kartennamen widersprechen sich · Ausgabe genau prüfen'
                : pocket.candidates.length && titleHint
                  ? `„${titleHint}“ erkannt · Ausgabe wählen`
                  : pocket.candidates.length
                    ? `${pocket.candidates.length} mögliche Ausgaben · prüfen`
                    : !navigator.onLine
                      ? 'Offline · Katalogabgleich benötigt Internet'
                      : catalogFailed
                        ? 'Katalogabgleich fehlgeschlagen · später erneut suchen'
                        : text.trim()
                          ? 'Text gelesen, aber keine Ausgabe gefunden · prüfen'
                          : 'Kein lesbarer Kartenname · Foto prüfen';
          if (printedEnergy.length)
            pocket.status.textContent = `${printedEnergy[0]!.name} · ${printedEnergy[0]!.number} · Code erkannt, bitte prüfen`;
          recordBetaEvent(
            'scan_result',
            'scan',
            matched
              ? 'page_pocket_exact'
              : ranked.conflictingName
                ? 'page_pocket_conflict'
                : pocket.candidates.length
                  ? 'page_pocket_candidates'
                  : 'page_pocket_no_candidate',
            'unknown',
            {
              candidate:
                pocket.candidates[0]?.source === 'tcgdex'
                  ? pocket.candidates[0].key
                  : undefined,
              metric: index + 1,
            },
          );
        } catch (error) {
          if (closed || abort.signal.aborted) break;
          pocket.container!.dataset.recognitionState = 'error';
          recordBetaEvent('scan_result', 'scan', 'page_pocket_error', 'error', {
            metric: index + 1,
          });
          pocket.status.textContent = `Erkennung fehlgeschlagen: ${errorText(error)}`;
        } finally {
          pocket.container?.classList.remove('is-scanning');
          if (!closed && !abort.signal.aborted) {
            pocket.container?.classList.add('is-processed');
            animateResolvedPocket(
              pocket.container,
              pocket.decision === 'card' ? 'card' : 'unknown',
            );
          }
        }
        progress.value = index + 1;
        journey.update(
          'recognize',
          `${index + 1} von 9 Fächern geprüft`,
          index + 1,
        );
        status.textContent = `Karten werden gelesen · ${index + 1} von ${tiles.length} geprüft`;
      }
    } finally {
      // Keep the ONNX model loaded for subsequent photos in the same batch.
      // A cancelled scan terminates the worker; the next scan starts fresh.
      if (abort.signal.aborted || closed) {
        session.close();
        if (sharedRecognition === session) sharedRecognition = undefined;
        if (sharedRecognitionAbort === abort)
          sharedRecognitionAbort = undefined;
      }
      if (recognitionAbort === abort) recognitionAbort = undefined;
      processing = false;
      stop.hidden = true;
      progress.hidden = true;
      grid.dataset.scanState = abort.signal.aborted ? 'cancelled' : 'complete';
      journey.update(
        abort.signal.aborted ? 'cancelled' : 'review',
        abort.signal.aborted
          ? 'Angehalten · vorhandene Ergebnisse bleiben prüfbar'
          : 'Verarbeitung abgeschlossen · Ausgaben prüfen',
        progress.value,
      );
      updateSave();
      if (!closed)
        status.textContent = abort.signal.aborted
          ? 'Erkennung angehalten. Deine bisherigen Vorschläge bleiben prüfbar.'
          : pockets.some((pocket) => pocket.decision === 'card')
            ? 'Erkennung abgeschlossen. Übernimm die ausgewählten Karten – unerkannte Fächer bleiben frei.'
            : pockets.some((pocket) => pocket.suggested)
              ? 'Erkennung abgeschlossen. Wähle die eindeutigen Vorschläge aus und bestätige danach die Übernahme.'
              : 'Noch keine Karten sicher erkannt. Tippe auf ein Fach und prüfe die Ausgaben oder fotografiere erneut.';
    }
  };
  const nextPage = async () => {
    if (closed || current || !queued.length) return;
    current = queued.shift()!;
    reportQueue();
    fingerprint = '';
    grid.replaceChildren();
    editorHost.replaceChildren();
    reviewPanel.hidden = true;
    activePocket = -1;
    delete grid.dataset.scanState;
    delete grid.dataset.scanAdjustment;
    delete grid.dataset.scanGeometry;
    pockets = [];
    releasePreviews();
    const file = current;
    try {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      if (
        ctx.state.binders.some((item) =>
          item.pages.some((page) => page.sourceFingerprint === fingerprint),
        )
      )
        throw new Error(
          'Diese Aufnahme wurde bereits importiert. Die vorhandene Binderseite bleibt unverändert.',
        );
      status.textContent = 'Binderseite wird automatisch ausgerichtet …';
      const aligned = await autoAlignPage(file, lifetime.signal);
      if (lifetime.signal.aborted || closed) return;
      grid.dataset.scanGeometry = aligned.method;
      grid.dataset.scanAdjustment = 'automatic';
      manualAlign.hidden = false;
      skipPage.hidden = false;
      if (aligned.method === 'full-photo') {
        // Unknown geometry is not a successful nine-pocket detection.
        // The original remains available for explicit manual alignment.
        grid.dataset.scanGeometry = 'full-photo';
        grid.dataset.scanAdjustment = 'required';
        grid.dataset.scanState = 'needs-adjustment';
        const url = URL.createObjectURL(file);
        previews.push(url);
        const original = el('img', 'w-page-alignment-preview');
        original.src = url;
        original.alt = 'Originalfoto – die Binderseiten-Grenzen sind unklar';
        grid.replaceChildren(
          el(
            'section',
            'w-page-alignment-needed',
            el('h3', '', 'Binderseite nicht eindeutig erkannt'),
            el(
              'p',
              'w-muted',
              'Wir konnten die neun Fächer nicht sicher bestimmen. Prüfe das Originalfoto und richte die Seitenränder selbst aus. Vorher wird keine Karte erkannt oder übernommen.',
            ),
            original,
            action(
              'Binderseite jetzt ausrichten',
              () => manualAlign.click(),
              'primary',
            ),
          ),
        );
        status.textContent =
          'Bitte Binderseite ausrichten. Es wurden keine neun Karten aus einem unsicheren Zuschnitt erzeugt.';
        updateSave();
        return;
      }
      status.textContent =
        aligned.method === 'detected'
          ? 'Seitenränder und Taschenraster erkannt. Prüfe die neun Vorschaubilder.'
          : 'Binderfächer automatisch ausgerichtet. Prüfe die neun Vorschaubilder.';
      const tiles = await extractPagePockets(aligned.blob, lifetime.signal);
      if (closed || lifetime.signal.aborted) return;
      buildGrid(tiles);
      void donateBetaScanPhoto(aligned.blob, 'page');
      void recognizeAll(tiles);
    } catch (error) {
      if (!closed) {
        status.textContent = errorText(error);
        current = undefined;
        reportQueue();
        updateSave();
      }
    }
  };
  const enqueue = (files: FileList | File[] | null) => {
    if (!files?.length) return;
    for (const file of files) {
      if (
        file.size > 20000000 ||
        (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) &&
          !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))
      ) {
        status.textContent =
          'Nur JPG, PNG, WebP oder HEIC/HEIF bis 20 MB pro Binderseite.';
        continue;
      }
      if (queued.length >= 40) {
        status.textContent = 'Bitte jeweils höchstens 40 Seiten vormerken.';
        break;
      }
      queued.push(file);
    }
    reportQueue();
    void nextPage();
  };
  gallery.addEventListener('change', () => {
    enqueue(gallery.files);
    gallery.value = '';
  });
  camera.addEventListener('change', () => {
    enqueue(camera.files);
    camera.value = '';
  });
}
