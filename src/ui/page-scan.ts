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
import type { WorkspaceContext } from './workspace-context';

type Decision = 'pending' | 'card' | 'empty' | 'skip';
type Pocket = {
  decision: Decision;
  candidates: PersonalCard[];
  card?: PersonalCard;
  select: HTMLSelectElement;
  finish: HTMLSelectElement;
  variant: HTMLInputElement;
  search: HTMLInputElement;
  status: HTMLElement;
  quality: HTMLElement;
  quickChoices?: HTMLElement;
  container?: HTMLElement;
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
  const save = action(
    'Geprüfte Binderseite übernehmen',
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
  const updateSave = () => {
    manualAlign.disabled = !current || processing || reAligning;
    skipPage.disabled = !current || processing || reAligning;
    save.disabled =
      !current ||
      processing ||
      reAligning ||
      pockets.length !== 9 ||
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
    const empty = pockets.filter(
      (pocket) => pocket.decision === 'empty',
    ).length;
    const open = pockets.filter(
      (pocket) => pocket.decision === 'pending' || pocket.decision === 'skip',
    ).length;
    reviewSummary.textContent = pockets.length
      ? `${matches} ausgewählt · ${empty} vermutlich leer · ${open} offen. Du kannst nur die ausgewählten Karten übernehmen.`
      : 'Noch keine Binderseite eingelesen.';
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
  );
  sheet.footer.append(stop, save);
  reportQueue();

  const updatePocket = (pocket: Pocket) => {
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
      pocket.status.textContent = 'Vermutlich leer · antippen zum Ändern';
    else if (pocket.decision === 'skip')
      pocket.status.textContent = 'Nicht zugeordnet';
    if (pocket.container) pocket.container.dataset.decision = pocket.decision;
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
          updatePocket(pocket);
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
  const selectExactPrintedMatch = (pocket: Pocket, text: string) => {
    const number = (value: string) =>
      value
        .replace(/\s/g, '')
        .replace(/(^|\/)0+(?=\d)/g, '$1')
        .toLowerCase();
    const clues = recognitionClues(text).filter((clue) => clue.setId);
    const exact = pocket.candidates.filter((card) =>
      clues.some(
        (clue) =>
          clue.setId === card.setId &&
          number(clue.number) === number(card.number) &&
          (!clue.language || clue.language === card.language),
      ),
    );
    // A name or an unqualified number cannot establish a printing.
    if (pocket.decision !== 'pending' || exact.length !== 1) return false;
    pocket.select.value = `card:${pocket.candidates.indexOf(exact[0]!)}`;
    updatePocket(pocket);
    return true;
  };
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
      pick.addEventListener('change', () => updatePocket(pocket));
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
      const container = el(
        'section',
        'w-page-scan-pocket',
        el('h3', '', `Fach ${index + 1}`),
        el('div', 'w-page-scan-photo-frame', photo),
        info,
        quality,
        el(
          'details',
          'w-page-scan-editor',
          el('summary', '', 'Prüfen / ändern'),
          quickChoices,
          pick,
          finish,
          variant,
          el('div', 'w-page-scan-search', query, searchButton),
        ),
      );
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
          status.textContent = label;
        },
      );
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
      }
      for (let index = 0; index < tiles.length; index++) {
        if (closed || abort.signal.aborted) break;
        const pocket = pockets[index]!;
        try {
          if (await likelyEmptyPocket(tiles[index]!, abort.signal)) {
            if (closed || abort.signal.aborted) break;
            pocket.select.value = 'empty';
            pocket.container!.dataset.recognitionState = 'empty-suggested';
            updatePocket(pocket);
            animateResolvedPocket(pocket.container, 'empty');
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
              online = await fetchRecognizedCards(
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
          displayCandidates(
            pocket,
            printedEnergy.length
              ? printedEnergy
              : [...resolvedVisual, ...online, ...local],
          );
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
          const matched = selectExactPrintedMatch(pocket, text);
          pocket.status.textContent = matched
            ? `${pocket.card!.name} · ${pocket.card!.number}`
            : resolvedVisual.length
              ? `${resolvedVisual.length} visuelle Kandidaten · Ausgabe prüfen`
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
        } catch (error) {
          if (closed || abort.signal.aborted) break;
          pocket.container!.dataset.recognitionState = 'error';
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
        status.textContent = `${index + 1} von 9 Fächern verarbeitet. Keine Karte wurde automatisch gespeichert.`;
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
          ? 'Erkennung angehalten. Prüfe die vorhandenen Vorschläge oder suche fehlende Karten manuell.'
          : 'Erkennung abgeschlossen. Prüfe die offenen Fächer oder übernimm die ausgewählten Karten.';
    }
  };
  const nextPage = async () => {
    if (closed || current || !queued.length) return;
    current = queued.shift()!;
    reportQueue();
    fingerprint = '';
    grid.replaceChildren();
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
      status.textContent =
        aligned.method === 'detected'
          ? 'Seitenränder erkannt. Neun Kartenfächer werden gelesen …'
          : aligned.method === 'grid'
            ? 'Binderfächer automatisch ausgerichtet. Prüfe die neun Vorschaubilder.'
            : 'Foto auf neun Fächer aufgeteilt. Prüfe die Vorschau; bei Bedarf „Zuschnitt korrigieren“.';
      const tiles = await extractPagePockets(aligned.blob, lifetime.signal);
      if (closed || lifetime.signal.aborted) return;
      buildGrid(tiles);
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
