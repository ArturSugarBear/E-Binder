import { scanProgress } from './scan-progress';
import {
  candidatesFromText,
  catalogSets,
  catalogSetCards,
  fetchCatalogCard,
  fetchRecognizedCards,
  fetchNameHintCandidates,
  recognitionClues,
  matchesCard,
} from '../data/card-catalog';
import { recognizePhoto } from '../data/recognize';
import {
  resolvePhotoScan,
  type AutomaticScanResult,
} from '../data/scan-auto-resolve';
import { scanEvidence } from '../data/scan-review';
import {
  recordBetaEvent,
  betaDiagnosticsAuthorized,
} from '../data/beta-diagnostics';
import { anniversaryEnergyFromText } from '../domain/anniversary-energy';
import { recognizedNameHints } from '../domain/recognition-names';
import { alignPhoto } from './photo-crop';
import { openLiveScanner } from './live-scan';
import { createCatalogBrowser } from './catalog-browser';
import {
  changeState,
  confirmHolding,
  correctHolding,
  finishLabels,
  finishes,
  normalize,
  numberKey,
  sameCard,
  uid,
  type Capture,
  type Finish,
  type PersonalCard,
} from '../domain/personal';
import {
  action,
  choices,
  check,
  el,
  errorText,
  field,
  input,
  message,
  modal,
  select,
} from './workspace-dom';
import type { AddOptions, WorkspaceContext } from './workspace-context';

function publicCardKey(card: PersonalCard | undefined): string | undefined {
  return card?.source === 'manual' ? undefined : card?.key;
}

export function openAddCards(
  ctx: WorkspaceContext,
  options: AddOptions = {},
): void {
  const transientPhotos = new Map<string, Blob>();
  const alignedCaptures = new Set<string>();
  const previewUrls = new Set<string>();
  const sheet = modal(
    options.correctHoldingId ? 'Ausgabe korrigieren' : 'Karten hinzufügen',
    true,
  );
  const flow = el(
    'ol',
    'w-scan-flow',
    el('li', '', '1 · Erfassen'),
    el('li', '', '2 · Ausgabe prüfen'),
    el('li', '', '3 · Bestand bestätigen'),
  );
  flow.setAttribute('aria-label', 'Schritte der Kartenerfassung');
  const flowSteps = Array.from(flow.querySelectorAll('li'));
  const setFlowStage = (index: 0 | 1 | 2) => {
    flowSteps.forEach((item, position) => {
      if (position === index) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      item.classList.toggle('is-complete', position < index);
    });
  };
  setFlowStage(options.card || options.correctHoldingId ? 2 : 0);
  const notices = el('div', 'w-form-notices');
  notices.setAttribute('aria-live', 'polite');
  const results = el('div', 'w-search-results');
  const scanSetChoice = el('section', 'w-scan-set-choice');
  const details = el('div', 'w-add-details');
  const queue = el('div', 'w-capture-queue');
  const photoArea = el('div', 'w-photo-review');
  const language = choices(
    'Katalogsprache',
    [
      ['de', 'Deutsch'],
      ['en', 'Englisch'],
      ['ja', 'Japanisch'],
    ],
    options.language ?? options.card?.language ?? 'de',
  );
  const search = input('search');
  search.placeholder = 'Kartenname oder Sammlernummer';
  search.autocomplete = 'off';
  const searchBox = field('Karte suchen', search);
  const searchLine = el('div', 'w-search-line', searchBox, language.element);
  const browser = createCatalogBrowser({
    ctx,
    search,
    language,
    results,
    artist: options.artist,
    browse: options.browse,
    setId: options.setId,
    onChoose: (card) => choose(card),
    onSearch: (reset) => {
      void onlineSearch(reset);
    },
    tell: (text, error = false) =>
      notices.replaceChildren(message(text, error ? 'error' : 'note')),
  });
  let selected = options.card;
  let captureId = options.captureId;
  let searchController: AbortController | undefined;
  let ocrController: AbortController | undefined;
  let debounce: ReturnType<typeof setTimeout>;
  let closed = false;
  let queueLimit = 30;
  let setChoiceRequest = 0;
  const interrupt = () => {
    setChoiceRequest++;
    ocrController?.abort();
    ocrController = undefined;
    searchController?.abort();
    clearTimeout(debounce);
  };
  sheet.onClose(() => {
    closed = true;
    transientPhotos.clear();
    alignedCaptures.clear();
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls.clear();
    browser.close();
    searchController?.abort();
    ocrController?.abort();
    clearTimeout(debounce);
  });

  const gallery = input('file');
  gallery.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
  gallery.multiple = true;
  gallery.hidden = true;
  const camera = input('file');
  camera.accept = 'image/*';
  camera.setAttribute('capture', 'environment');
  camera.hidden = true;
  const upload = action(
    'Fotos auswählen',
    () => gallery.click(),
    'secondary',
    'upload',
  );
  const takePhoto = action(
    'Karte live scannen',
    () =>
      openLiveScanner(
        async (file, aligned) => {
          await addFiles([file], true, aligned);
        },
        () => camera.click(),
        () =>
          ctx.state.captures.filter((shot) => shot.status === 'pending').length,
        () => {
          sheet.close();
          ctx.openPageScan();
        },
      ),
    'primary',
    'camera',
  );
  const scanBinder = action(
    'Ganze Binderseite scannen',
    () => {
      sheet.close();
      ctx.openPageScan();
    },
    'secondary',
    'binder',
  );
  const captureStart = el(
    'section',
    'w-capture-start',
    el('h3', '', 'Wie möchtest du Karten erfassen?'),
    el('div', 'w-capture-start-grid', scanBinder, takePhoto, upload),
    action('Karte manuell eintragen', () => manualForm(), 'text'),
  );
  captureStart.hidden = Boolean(options.correctHoldingId || options.card);
  const advancedCatalog = el(
    'details',
    'w-add-catalog-advanced',
    el('summary', '', 'Erweiterte Suche: Set, Illustrator und Seltenheit'),
    browser.element,
  );
  advancedCatalog.open = Boolean(
    options.browse || options.setId || options.artist,
  );
  sheet.body.append(
    flow,
    captureStart,
    el(
      'p',
      'w-muted w-add-capture-intro',
      'Ein Foto für eine Einzelkarte oder ein Foto für eine ganze Binderseite. Keine Beispielkarten werden automatisch als deine Karten vorgeschlagen.',
    ),
    gallery,
    camera,
    queue,
    searchLine,
    advancedCatalog,
    notices,
    photoArea,
    scanSetChoice,
    results,
    browser.pager,
    details,
  );
  sheet.footer.append(
    message(
      ctx.account && ctx.state.mode !== 'demo'
        ? 'Texterkennung läuft im Browser. Fotos werden anschließend verworfen. Dein Konto speichert ausschließlich Karten-Metadaten; Katalogbilder kommen direkt von TCGdex.'
        : 'Fotos werden nur vorübergehend für die Erkennung geöffnet und beim Schließen verworfen. Gespeichert werden Karten-Metadaten. Katalogbilder kommen von TCGdex.',
    ),
  );

  const capture = () =>
    ctx.state.captures.find((item) => item.id === captureId);
  const tell = (text: string, error = false) =>
    notices.replaceChildren(message(text, error ? 'error' : 'note'));
  const showCapture = () => {
    photoArea.replaceChildren();
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls.clear();
    const shot = capture();
    if (!shot) return;
    const temporary = transientPhotos.get(shot.id);
    const picture = el('span', 'card-art w-original-photo');
    if (temporary) {
      const url = URL.createObjectURL(temporary);
      previewUrls.add(url);
      const image = el('img');
      image.src = url;
      image.alt = 'Temporäre Aufnahme für die Erkennung';
      picture.append(image);
    } else picture.append(el('span', 'art-fallback', 'Kein Foto gespeichert'));
    const copy = el(
      'div',
      '',
      el('h3', '', shot.name),
      el(
        'p',
        'w-muted',
        shot.status === 'confirmed'
          ? 'Dieses Foto wurde bereits übernommen.'
          : temporary
            ? shot.text && !shot.candidates.length
              ? 'Kein verlässlicher Treffer. Richte die Ecken auf die gedruckte Karte aus und prüfe die vergrößerte Sammlernummer. Das Foto bleibt nur bis zum Schließen geöffnet.'
              : 'Vergleiche die Aufnahme mit der Ausgabe. Das Foto wird beim Schließen verworfen.'
            : 'Nur das Erkennungsergebnis wurde gespeichert. Prüfe die Ausgabe oder fotografiere die Karte erneut.',
      ),
    );
    if (shot.status !== 'confirmed' && temporary)
      copy.append(
        action(
          'Foto ausrichten und erkennen',
          () => {
            void runOcr();
          },
          'secondary',
          'spark',
        ),
      );
    if (shot.error) copy.append(message(shot.error, 'error'));
    if (shot.text) {
      const disclosure = el(
        'details',
        'w-disclosure',
        el('summary', '', 'Erkannten Text ansehen'),
        el('pre', 'w-ocr-text', shot.text),
      );
      copy.append(disclosure);
    }
    photoArea.append(el('div', 'w-photo-comparison', picture, copy));
  };
  const discardCaptures = (ids: string[]) => {
    const removable = ctx.state.captures.filter(
      (shot) => ids.includes(shot.id) && shot.status !== 'confirmed',
    );
    if (!removable.length) return;
    const removed = new Set(removable.map((shot) => shot.id));
    const ok = ctx.commit(
      removable.length === 1
        ? 'Offene Aufnahme entfernt'
        : 'Offene Aufnahmen entfernt',
      (state) =>
        changeState(state, (next) => {
          next.captures = next.captures.filter((shot) => !removed.has(shot.id));
        }),
    );
    if (!ok) return;
    for (const id of removed) {
      transientPhotos.delete(id);
      alignedCaptures.delete(id);
    }
    if (captureId && removed.has(captureId)) {
      setFlowStage(0);
      captureId = ctx.state.captures.find(
        (shot) => shot.status === 'pending',
      )?.id;
      selected = undefined;
      details.replaceChildren();
      results.replaceChildren();
      notices.replaceChildren();
    }
    showQueue();
    showCapture();
    const active = capture();
    if (active?.text) void renderScanReview(active.text, active.candidates);
    else results.replaceChildren();
    tell(
      removable.length === 1
        ? 'Aufnahme entfernt. Der Kartenbestand ist unverändert.'
        : `${removable.length} offene Aufnahmen entfernt. Der Kartenbestand ist unverändert.`,
    );
  };
  const showQueue = () => {
    queue.replaceChildren();
    const shots = ctx.state.captures;
    if (!shots.length) return;
    queue.append(
      el('p', 'w-eyebrow', 'Deine Erfassungssitzung'),
      el(
        'p',
        'w-muted',
        `${shots.filter((item) => item.status === 'pending').length} offen · ${shots.filter((item) => item.status === 'confirmed').length} übernommen`,
      ),
    );
    const open = shots.filter((shot) => shot.status !== 'confirmed');
    if (open.length) {
      const clear = action(
        `Alle offenen Aufnahmen entfernen (${open.length})`,
        () => {
          if (
            window.confirm(
              `${open.length} offene Erkennungseinträge entfernen? Bereits bestätigte Karten bleiben im Bestand.`,
            )
          )
            discardCaptures(open.map((shot) => shot.id));
        },
        'secondary',
        'trash',
      );
      queue.append(clear);
    }
    const list = el('div', 'w-capture-list');
    for (const shot of [...open].reverse().slice(0, queueLimit)) {
      const button = action(
        `${shot.name} · ${shot.status === 'skipped' ? 'zurückgestellt' : 'offen'}`,
        () => {
          interrupt();
          captureId = shot.id;
          selected = undefined;
          details.replaceChildren();
          results.replaceChildren();
          notices.replaceChildren();
          showCapture();
          if (shot.text) void renderScanReview(shot.text, shot.candidates);
        },
        'text',
      );
      button.setAttribute('aria-pressed', String(shot.id === captureId));
      const remove = action(
        `Aufnahme ${shot.name} entfernen`,
        () => discardCaptures([shot.id]),
        'text',
        'trash',
      );
      remove.setAttribute('aria-label', `Aufnahme ${shot.name} entfernen`);
      list.append(el('div', 'w-capture-entry', button, remove));
    }
    queue.append(list);
    if (open.length > queueLimit)
      queue.append(
        action(
          'Weitere 30 Fotos anzeigen',
          () => {
            queueLimit += 30;
            showQueue();
          },
          'text',
        ),
      );
    const confirmed = shots.filter((shot) => shot.status === 'confirmed');
    if (confirmed.length) {
      const history = el(
        'details',
        'w-capture-history',
        el(
          'summary',
          '',
          `Bereits übernommene Aufnahmen (${confirmed.length})`,
        ),
      );
      const completed = el('div', 'w-capture-list');
      for (const shot of [...confirmed].reverse().slice(0, 30)) {
        completed.append(
          action(
            `${shot.name} · übernommen`,
            () => {
              if (shot.holdingId) {
                sheet.close();
                ctx.openHolding(shot.holdingId);
              }
            },
            'text',
          ),
        );
      }
      history.append(completed);
      queue.append(history);
    }
  };

  async function addFiles(
    files: FileList | File[] | null,
    fromCamera = false,
    autoAligned = false,
  ): Promise<void> {
    if (!files?.length) return;
    interrupt();
    upload.disabled = true;
    takePhoto.disabled = true;
    let first: string | undefined;
    let added = 0;
    let repeats = 0;
    try {
      for (const file of Array.from(files)) {
        if (
          file.size > 12000000 ||
          !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)
        )
          throw new Error(
            'Bitte nutze JPG, PNG, WebP oder HEIC/HEIF bis 12 MB pro Karte. Bereits geöffnete Aufnahmen bleiben bis zum Schließen im Arbeitsspeicher.',
          );
        tell(`${file.name} wird für die Erkennung geöffnet …`);
        const digest = await crypto.subtle.digest(
          'SHA-256',
          await file.arrayBuffer(),
        );
        const hash = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
        const existing = ctx.state.captures.find((item) => item.hash === hash);
        if (existing) {
          transientPhotos.set(existing.id, file);
          if (autoAligned) alignedCaptures.add(existing.id);
          first ??= existing.id;
          repeats++;
          continue;
        }
        const shot: Capture = {
          id: uid(),
          hash,
          name: file.name.slice(0, 200),
          createdAt: new Date().toISOString(),
          status: 'pending',
          text: '',
          error: '',
          candidates: [],
        };
        transientPhotos.set(shot.id, file);
        if (autoAligned) alignedCaptures.add(shot.id);
        if (
          !ctx.commit('Foto zur Erfassung hinzugefügt', (state) =>
            changeState(state, (next) => {
              next.captures.push(shot);
            }),
          )
        )
          break;
        first ??= shot.id;
        added++;
      }
      if (!closed) {
        captureId = first;
        selected = undefined;
        details.replaceChildren();
        results.replaceChildren();
        showQueue();
        showCapture();
        photoArea.scrollIntoView({ block: 'start' });
        tell(
          `${added} Aufnahmen geöffnet.${repeats ? ` ${repeats} identische Fotos waren bereits erfasst; Mengen wurden nicht erhöht.` : ''} Richte das Foto aus und starte die Erkennung oder suche die Ausgabe manuell.`,
        );
      }
    } catch (error) {
      if (!closed) {
        if (first) {
          captureId = first;
          selected = undefined;
          details.replaceChildren();
          results.replaceChildren();
          showQueue();
          showCapture();
        }
        tell(errorText(error), true);
      }
    } finally {
      upload.disabled = false;
      takePhoto.disabled = false;
      gallery.value = '';
      camera.value = '';
    }
    if (fromCamera && first && !closed) await runOcr();
  }
  gallery.addEventListener('change', () => {
    void addFiles(gallery.files);
  });
  camera.addEventListener('change', () => {
    void addFiles(camera.files, true);
  });

  async function runOcr(): Promise<void> {
    setFlowStage(0);
    const shot = capture();
    if (!shot || shot.status === 'confirmed') return;
    interrupt();
    const controller = new AbortController();
    ocrController = controller;
    selected = undefined;
    details.replaceChildren();
    results.replaceChildren();
    results.dataset.scanState = 'running';
    const status = el('p', 'w-muted', 'Texterkennung startet …');
    status.setAttribute('role', 'status');
    const journey = scanProgress();
    journey.update('recognize', 'Karte wird vorbereitet …', 0);
    const progress = el('progress', 'w-progress');
    progress.max = 1;
    progress.setAttribute('aria-label', 'Fortschritt der Kartenerkennung');
    const stop = action(
      'Erkennung abbrechen',
      () => controller.abort(),
      'text',
    );
    notices.replaceChildren(journey.element, status, progress, stop);
    try {
      const photo = transientPhotos.get(shot.id);
      if (!photo)
        throw new Error(
          'Die Aufnahme ist nicht mehr geöffnet. Fotografiere die Karte erneut; Bilder werden nicht gespeichert.',
        );
      const aligned = alignedCaptures.has(shot.id)
        ? photo
        : await alignPhoto(photo, controller.signal);
      if (!aligned || closed || controller.signal.aborted) {
        if (!closed && ocrController === controller)
          tell(
            'Ausrichtung abgebrochen. Die Aufnahme bleibt bis zum Schließen geöffnet.',
          );
        return;
      }
      const text = await recognizePhoto(
        aligned,
        controller.signal,
        (label, fraction) => {
          if (!closed && ocrController === controller) {
            status.textContent = label;
            journey.update('recognize', label);
            if (fraction !== undefined) progress.value = fraction;
            else progress.removeAttribute('value');
          }
        },
      );
      if (controller.signal.aborted || closed || ocrController !== controller)
        return;
      const known = [
        ...ctx.catalog,
        ...ctx.state.holdings.map((item) => item.card),
      ];
      const printedEnergy = anniversaryEnergyFromText(text, language.value);
      const local = candidatesFromText(text, known);
      status.textContent =
        'Set, Sammlernummer und Kartenbild werden abgeglichen …';
      let automatic: AutomaticScanResult | undefined;
      let catalogUnavailable = false;
      if (!printedEnergy.length) {
        try {
          automatic = await resolvePhotoScan(
            aligned,
            text,
            local,
            language.value,
            controller.signal,
          );
        } catch {
          catalogUnavailable = true;
        }
      }
      if (controller.signal.aborted || closed || ocrController !== controller)
        return;
      let online = automatic?.candidates ?? [];
      let titleHint = '';
      if (
        !printedEnergy.length &&
        !online.length &&
        recognitionClues(text).some((clue) => clue.setId)
      ) {
        try {
          online = await fetchRecognizedCards(
            text,
            language.value,
            controller.signal,
          );
        } catch {
          catalogUnavailable = true;
        }
      }
      if (
        !printedEnergy.length &&
        !online.length &&
        navigator.onLine &&
        recognizedNameHints(text).length > 0
      ) {
        try {
          const found = await fetchNameHintCandidates(
            text,
            language.value,
            controller.signal,
          );
          online = found.candidates;
          titleHint = found.query;
        } catch {
          catalogUnavailable = true;
        }
      }
      const candidates = printedEnergy.length
        ? printedEnergy
        : [
            ...new Map(
              [...online, ...local].map((card) => [card.key, card]),
            ).values(),
          ].slice(0, 24);
      recordBetaEvent(
        'scan_result',
        'scan',
        candidates.length ? 'candidates_found' : 'no_candidate',
        candidates.length ? 'ok' : 'unknown',
        {
          candidate: publicCardKey(candidates[0]),
          metric: candidates.length,
        },
      );
      ctx.commit('Texterkennung abgeschlossen', (state) =>
        changeState(state, (next) => {
          const target = next.captures.find((item) => item.id === shot.id);
          if (target?.status === 'pending') {
            target.text = text.slice(0, 30000);
            target.candidates = candidates;
            target.error = '';
          }
        }),
      );
      showCapture();
      await renderScanReview(
        text,
        candidates,
        automatic?.suggested,
        automatic?.basis,
      );
      results.dataset.scanState = 'complete';
      if (controller.signal.aborted || closed || ocrController !== controller)
        return;
      photoArea.scrollIntoView({ block: 'start' });
      if (catalogUnavailable)
        tell(
          'Der Katalog war teilweise nicht erreichbar. Prüfe den angezeigten Vorschlag oder nutze die Korrektursuche.',
        );
      else if (titleHint && !automatic?.suggested)
        tell(
          `Der Kartenname „${titleHint}“ wurde gelesen. Die genaue Ausgabe muss noch bestätigt werden.`,
        );
      else notices.replaceChildren();
    } catch (error) {
      if (closed || ocrController !== controller) return;
      if (controller.signal.aborted) {
        tell(
          'Erkennung abgebrochen. Die Aufnahme bleibt bis zum Schließen geöffnet.',
        );
        return;
      }
      recordBetaEvent('scan_result', 'scan', 'recognition_failed', 'error');
      const text = errorText(error);
      results.dataset.scanState = 'error';
      ctx.commit('Foto bleibt zur Klärung offen', (state) =>
        changeState(state, (next) => {
          const target = next.captures.find((item) => item.id === shot.id);
          if (target) target.error = text;
        }),
      );
      tell(text, true);
    } finally {
      if (results.dataset.scanState === 'running')
        results.dataset.scanState = 'cancelled';
    }
  }

  /**
   * Scan review is separate from general catalogue browsing: no random
   * cards with the same collector fraction are presented as recognition.
   * A collector can first select the physical set and resolve its one print.
   */
  async function renderScanReview(
    text: string,
    candidates: PersonalCard[],
    suggested?: PersonalCard,
    basis?: AutomaticScanResult['basis'],
  ): Promise<void> {
    const request = ++setChoiceRequest;
    setFlowStage(1);
    captureStart.hidden = true;
    sheet.dialog.classList.remove('w-scan-confirming');
    sheet.dialog.classList.add('w-guided-scan');
    results.classList.remove('w-text-results');
    results.classList.add('w-scan-result-stack');
    results.replaceChildren();
    scanSetChoice.replaceChildren();
    browser.pager.replaceChildren();

    const evidence = scanEvidence(text, candidates);
    const knownNumber = recognitionClues(text)[0]?.number ?? '';

    const showPrint = (card: PersonalCard, explanation: string) => {
      if (closed || request !== setChoiceRequest) return;
      scanSetChoice.replaceChildren();
      const copy = el(
        'div',
        'w-scan-match-copy',
        el('p', 'w-eyebrow', 'Ausgabe mit deinem Foto vergleichen'),
        el('h3', '', card.name),
        el(
          'p',
          'w-muted',
          `${card.setName} · ${card.number} · ${card.language.toUpperCase()}`,
        ),
        el('p', 'w-scan-match-reason', explanation),
        action('Diese Ausgabe prüfen', () => choose(card), 'primary', 'check'),
        action(
          'Treffer stimmt nicht?',
          () => {
            const alternatives = results.querySelector<HTMLDetailsElement>(
              '.w-scan-alternatives',
            );
            if (alternatives) {
              alternatives.open = true;
              alternatives.scrollIntoView({ block: 'nearest' });
            } else {
              void showSetChooser();
            }
          },
          'secondary',
        ),
      );
      results.replaceChildren(
        el('div', 'w-scan-match-card', ctx.images.artwork(card), copy),
      );
    };

    const showSetChooser = async () => {
      if (closed || request !== setChoiceRequest) return;
      results.replaceChildren();
      const currentLanguage = language.value;
      const size = recognitionClues(text)[0]?.number.split('/')[1] ?? '';
      const numberField = input('text', knownNumber);
      numberField.placeholder = 'z. B. 088/063';
      numberField.autocomplete = 'off';
      const setQuery = input('search');
      setQuery.placeholder = 'Setname oder Setcode, z. B. M1L';
      const setList = select([['', 'Set auswählen']], '');
      const feedback = el('p', 'w-muted', 'Passende Sets werden geladen …');
      feedback.setAttribute('role', 'status');
      const verify = action(
        'Set und Nummer abgleichen',
        () => {
          void (async () => {
            const setId = setList.value;
            const fraction = numberField.value.trim();
            if (!setId) {
              feedback.textContent = 'Wähle zuerst das Set deiner Karte.';
              return;
            }
            if (
              !/^[a-z]{0,2}[0-9]{1,3}\s*\/\s*[a-z]{0,2}[0-9]{1,3}$/i.test(
                fraction,
              )
            ) {
              feedback.textContent =
                'Gib die vollständige Sammlernummer wie 088/063 ein.';
              numberField.focus();
              return;
            }
            verify.disabled = true;
            feedback.textContent = 'Set und Kartennummer werden geprüft …';
            try {
              const editions = await catalogSetCards(setId, currentLanguage);
              if (closed || request !== setChoiceRequest) return;
              const matched = editions.filter(
                (item) => numberKey(item.number ?? '') === numberKey(fraction),
              );
              if (matched.length !== 1) {
                feedback.textContent =
                  'Diese Nummer wurde in dem gewählten Set nicht eindeutig gefunden. Prüfe die Nummer und den Setcode auf der Karte.';
                return;
              }
              const card = await fetchCatalogCard(
                matched[0]!.id,
                currentLanguage,
              );
              if (closed || request !== setChoiceRequest) return;
              const title = recognizedNameHints(text)[0];
              const consistent =
                !title || normalize(title) === normalize(card.name);
              showPrint(
                card,
                consistent
                  ? 'Set und vollständige Nummer stimmen im Katalog überein. Vergleiche noch den Kartennamen und das Bild.'
                  : 'Set und Nummer stimmen überein, aber der gelesene Name weicht ab. Bitte den vollständigen Kartennamen auf dem Foto prüfen.',
              );
            } catch {
              feedback.textContent =
                'Der Setkatalog ist gerade nicht erreichbar. Du kannst die Karte auch manuell suchen.';
            } finally {
              verify.disabled = false;
            }
          })();
        },
        'primary',
        'check',
      );
      const languageRow = el('div', 'w-scan-language-row');
      for (const [key, caption] of [
        ['de', 'Deutsch'],
        ['en', 'Englisch'],
        ['ja', 'Japanisch'],
      ] as const) {
        const button = action(
          caption,
          () => {
            if (language.value === key) return;
            language.value = key;
            void showSetChooser();
          },
          key === currentLanguage ? 'primary' : 'secondary',
        );
        button.setAttribute('aria-pressed', String(key === currentLanguage));
        languageRow.append(button);
      }
      scanSetChoice.replaceChildren(
        el(
          'div',
          'w-scan-set-panel',
          el('p', 'w-eyebrow', 'Set zuerst bestimmen'),
          el('h3', '', 'Welches Set steht auf deiner Karte?'),
          el(
            'p',
            'w-muted',
            knownNumber
              ? `Die Nummer ${knownNumber} allein kommt in mehreren Sets vor. Wähle das gedruckte Set; wir gleichen danach die vollständige Nummer ab.`
              : 'Suche nach dem Setcode unten auf der Karte. Anschließend prüfen wir die Sammlernummer.',
          ),
          languageRow,
          field('Sammlernummer', numberField),
          field('Set suchen', setQuery),
          field('Set auswählen', setList),
          verify,
          feedback,
          action(
            'Stattdessen Karte manuell suchen',
            () => {
              sheet.dialog.classList.remove('w-guided-scan');
              scanSetChoice.replaceChildren();
              results.classList.remove('w-scan-result-stack');
              searchLine.scrollIntoView({ block: 'start' });
              search.focus();
            },
            'text',
          ),
        ),
      );
      let allSets: Awaited<ReturnType<typeof catalogSets>> = [];
      const fill = () => {
        const query = normalize(setQuery.value);
        const denominator = numberField.value.trim().split('/')[1] ?? size;
        const appropriate = allSets.filter(
          (item) =>
            (!query ||
              normalize(`${item.id} ${item.name} ${item.alias ?? ''}`).includes(
                query,
              )) &&
            (query ||
              !denominator ||
              Number(denominator) === item.cardCount.official),
        );
        setList.replaceChildren(el('option', '', 'Set auswählen'));
        for (const item of appropriate.slice(0, 45)) {
          const option = el(
            'option',
            '',
            `${item.id.toUpperCase()} · ${item.name}`,
          );
          option.value = item.id;
          setList.append(option);
        }
        feedback.textContent = appropriate.length
          ? `${appropriate.length} passende Sets. Suche bei Bedarf nach dem gedruckten Kürzel.`
          : 'Kein Set mit dieser Nummer gefunden. Suche nach dem Setcode oder prüfe die Katalogsprache.';
      };
      setQuery.addEventListener('input', fill);
      numberField.addEventListener('input', fill);
      try {
        allSets = await catalogSets(currentLanguage);
        if (
          closed ||
          request !== setChoiceRequest ||
          !scanSetChoice.isConnected
        )
          return;
        fill();
      } catch {
        if (closed || request !== setChoiceRequest) return;
        feedback.textContent =
          'Die Setliste konnte nicht geladen werden. Probiere eine andere Sprache oder die manuelle Suche.';
      }
    };

    const showAlternatives = () => {
      if (candidates.length <= 1) return;
      const other = el(
        'details',
        'w-scan-alternatives',
        el(
          'summary',
          '',
          'Nicht deine Karte? Weitere mögliche Ausgaben ansehen',
        ),
        el(
          'p',
          'w-muted',
          'Nur mögliche Ausgaben mit passender Sammlernummer. Wähle die Karte, die deinem Foto entspricht.',
        ),
      );
      const grid = el('div', 'w-scan-alternative-grid');
      for (const card of candidates.slice(0, 6)) {
        const button = action(
          `${card.name}, ${card.setName}, ${card.number}`,
          () =>
            showPrint(
              card,
              'Manuell ausgewählte Ausgabe. Bitte Foto, Set und vollständigen Namen vergleichen.',
            ),
          'card',
        );
        button.replaceChildren(
          ctx.images.artwork(card),
          el(
            'span',
            'w-card-caption',
            el('strong', '', card.name),
            el('small', '', `${card.setName} · ${card.number}`),
          ),
        );
        grid.append(button);
      }
      other.append(grid);
      results.append(other);
    };

    if (suggested) {
      const description =
        basis === 'printed-set'
          ? 'Gedrucktes Set und Sammlernummer stimmen überein. Prüfe die Kartenausgabe vor dem Hinzufügen.'
          : basis === 'full-name'
            ? 'Vollständiger Name und Sammlernummer stimmen mit dem Katalog überein. Prüfe noch das Set.'
            : 'Kartenbild und Sammlernummer deuten auf diese Ausgabe. Vergleiche dein Foto vor der Bestätigung.';
      showPrint(suggested, description);
      showAlternatives();
    } else if (evidence.kind === 'set-number') {
      showPrint(
        evidence.card,
        evidence.title === 'conflicting'
          ? 'Gedrucktes Set und Nummer stimmen überein, der gelesene Name jedoch nicht. Bitte Bild und Namen genau vergleichen.'
          : 'Gedrucktes Set und Nummer passen. Prüfe diese Kartenausgabe.',
      );
      showAlternatives();
    } else if (evidence.kind === 'name-number') {
      showPrint(
        evidence.card,
        'Vollständiger Name und Sammlernummer passen. Prüfe das Set und das Bild.',
      );
      showAlternatives();
    } else if (candidates.length) {
      showPrint(
        candidates[0]!,
        'Mögliche Ausgabe, aber kein sicherer Treffer. Bitte vergleiche Name, Set und Bild. Wenn sie nicht passt, findest du unten weitere Vorschläge.',
      );
      showAlternatives();
    } else {
      await showSetChooser();
    }
  }

  function renderChoices(cards: PersonalCard[]): void {
    setFlowStage(1);
    results.classList.remove('w-text-results', 'w-scan-result-stack');
    browser.pager.replaceChildren();
    results.replaceChildren();
    const unique = [
      ...new Map(cards.map((card) => [card.key, card])).values(),
    ].slice(0, 24);
    for (const card of unique) {
      const button = action(card.name, () => choose(card), 'card');
      button.dataset.cardKey = card.key;
      button.replaceChildren(
        ctx.images.artwork(card),
        el(
          'span',
          'w-card-caption',
          el('strong', '', card.name),
          el('small', '', `${card.setName} · ${card.number}`),
        ),
      );
      results.append(button);
    }
  }
  function choose(card: PersonalCard): void {
    const currentCapture = capture();
    if (currentCapture)
      recordBetaEvent(
        'scan_review',
        'scan',
        currentCapture.candidates.length
          ? 'candidate_selected'
          : 'manual_selected',
        'ok',
        {
          candidate: publicCardKey(currentCapture.candidates[0]),
          selected: publicCardKey(card),
        },
      );
    captureStart.hidden = true;
    interrupt();
    sheet.dialog.classList.remove('w-guided-scan');
    sheet.dialog.classList.add('w-scan-confirming');
    selected = card;
    details.replaceChildren();
    notices.replaceChildren();
    renderConfirmation();
  }
  function renderConfirmation(): void {
    if (!selected) return;
    setFlowStage(2);
    const card = selected;
    const original = options.correctHoldingId
      ? ctx.state.holdings.find((item) => item.id === options.correctHoldingId)
      : undefined;
    const shot = capture();
    const known = ctx.state.holdings.find((item) => sameCard(item.card, card));
    const finish = select(
      [
        ['', 'Variante auswählen'],
        ...finishes.map((key) => [key, finishLabels[key]] as [string, string]),
      ],
      original?.finish ?? (card.finishes.length === 1 ? card.finishes[0]! : ''),
    );
    const variant = input('text', original?.variantNote ?? '');
    variant.placeholder = 'z. B. 1. Auflage, Stempel';
    variant.maxLength = 200;
    const quantity = input(
      'number',
      String(original?.quantity ?? known?.quantity ?? 1),
    );
    quantity.min = '1';
    quantity.max = '999';
    quantity.required = true;
    const confirm = check(
      'Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.',
    );
    const detailsLanguage = select(
      [
        ['de', 'Deutsch'],
        ['en', 'Englisch'],
        ['ja', 'Japanisch'],
        ['fr', 'Französisch'],
        ['it', 'Italienisch'],
        ['es', 'Spanisch'],
      ],
      card.language,
    );
    detailsLanguage.disabled = card.source !== 'manual';
    const form = el('form', 'w-confirm-form');
    const note = message(
      known
        ? `Diese Ausgabe ist bereits vorhanden. Du bestätigst den Gesamtbestand, keine automatisch zusätzlich gezählte Kopie.`
        : 'Trage nur physisch vorhandene Exemplare ein.',
    );
    const artist = card.artist
      ? `Illustration: ${card.artist}${card.artistSource === 'publisher' ? ' · Publisher-Credit geprüft' : card.artistSource === 'manual' ? ' · auf der Karte abgelesen' : ' · Katalogangabe'}`
      : 'Illustrator noch unbekannt';
    const error = message('', 'error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    const submit = action(
      original ? 'Korrektur übernehmen' : 'Bestand bestätigen',
      () => undefined,
      'primary',
      'check',
    );
    submit.type = 'submit';
    const chosenCard = (): PersonalCard => {
      const chosen: PersonalCard = {
        ...card,
        language: detailsLanguage.value,
        ...(card.source === 'manual'
          ? {
              key: `manual:${normalize(card.setName)}:${normalize(card.number)}:${detailsLanguage.value}`,
            }
          : {}),
      };
      delete chosen.photoId;
      return chosen;
    };
    const wish = action(
      'Auf die Wunschliste',
      () => {
        const chosen = chosenCard();
        if (ctx.state.wishes.some((item) => sameCard(item.card, chosen)))
          return;
        if (
          ctx.commit('Wunschkarte hinzugefügt', (state) =>
            changeState(state, (next) => {
              next.wishes.push({
                id: uid(),
                card: chosen,
                quantity: 1,
                priority: 'normal',
                notes: '',
              });
            }),
          )
        ) {
          tell('Wunschkarte gespeichert. Dein Besitz wurde nicht verändert.');
          refreshWish();
        }
      },
      'secondary',
      'star',
    );
    const refreshWish = () => {
      wish.disabled = ctx.state.wishes.some((item) =>
        sameCard(item.card, chosenCard()),
      );
      wish.querySelector('span')!.textContent = wish.disabled
        ? 'Auf deiner Wunschliste'
        : 'Auf die Wunschliste';
    };
    detailsLanguage.addEventListener('change', refreshWish);
    refreshWish();
    const clearConfirmationError = () => {
      if (error.hidden) return;
      error.hidden = true;
      error.textContent = '';
    };
    for (const control of [
      confirm.input,
      finish,
      quantity,
      detailsLanguage,
      variant,
    ]) {
      control.addEventListener('change', clearConfirmationError);
      control.addEventListener('input', clearConfirmationError);
    }
    if (shot?.text)
      form.append(
        action(
          'Zurück zur Set- und Kartenprüfung',
          () => {
            selected = undefined;
            details.replaceChildren();
            sheet.dialog.classList.remove('w-scan-confirming');
            void renderScanReview(shot.text, shot.candidates);
          },
          'secondary',
        ),
      );
    form.append(
      el(
        'div',
        'w-confirm-card',
        ctx.images.artwork(card),
        el(
          'div',
          '',
          el('p', 'w-eyebrow', 'Genaue Ausgabe prüfen'),
          el('h3', '', card.name),
          el('p', '', `${card.setName} · ${card.number}`),
          el('p', 'w-muted', artist),
        ),
      ),
      note,
      el(
        'div',
        'w-form-grid',
        field('Sprache der Karte', detailsLanguage),
        field('Druckvariante', finish),
        field('Variante / Auflage / Stempel', variant),
        field('Gesamtmenge dieser Variante', quantity),
      ),
      confirm.row,
      error,
      el('div', 'w-action-row', submit, wish),
    );
    if (shot?.candidates.length && betaDiagnosticsAuthorized()) {
      form.append(
        action(
          'Erkennung falsch melden',
          () => {
            recordBetaEvent('scan_review', 'scan', 'reported_wrong', 'error', {
              candidate: publicCardKey(shot.candidates[0]),
              selected: publicCardKey(card),
            });
            tell(
              'Beta-Fehlermeldung erfasst. Keine Fotos oder OCR-Texte übertragen.',
            );
          },
          'text',
        ),
      );
    }
    finish.addEventListener('change', () => {
      const existing = ctx.state.holdings.find(
        (item) =>
          sameCard(item.card, card) &&
          item.finish === finish.value &&
          normalize(item.variantNote) === normalize(variant.value),
      );
      quantity.value = String(existing?.quantity ?? original?.quantity ?? 1);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      error.hidden = true;
      if (!finish.value) {
        error.textContent = 'Wähle die Druckvariante dieser Karte.';
        error.hidden = false;
        finish.focus();
        return;
      }
      if (!confirm.input.checked) {
        error.textContent =
          'Bitte prüfe die Angaben und bestätige das Kontrollkästchen.';
        error.hidden = false;
        confirm.input.focus();
        return;
      }
      const adopted = chosenCard();
      const previous =
        original ??
        ctx.state.holdings.find(
          (item) =>
            sameCard(item.card, adopted) &&
            item.finish === finish.value &&
            normalize(item.variantNote) === normalize(variant.value),
        );
      const ok = ctx.commit(
        original ? 'Ausgabe korrigiert' : 'Bestand bestätigt',
        (state) =>
          original
            ? correctHolding(
                state,
                original.id,
                {
                  card: adopted,
                  finish: finish.value as Finish,
                  variantNote: variant.value,
                  quantity: Number(quantity.value),
                },
                captureId,
              )
            : confirmHolding(
                state,
                {
                  card: adopted,
                  finish: finish.value as Finish,
                  variantNote: variant.value,
                  quantity: Number(quantity.value),
                  tradeQuantity: previous?.tradeQuantity ?? 0,
                  favorite: previous?.favorite ?? false,
                  notes: previous?.notes ?? '',
                },
                captureId,
              ),
      );
      if (ok) {
        if (shot) {
          sheet.dialog.classList.remove('w-scan-confirming', 'w-guided-scan');
          recordBetaEvent('scan_review', 'scan', 'card_confirmed', 'ok', {
            candidate: publicCardKey(shot.candidates[0]),
            selected: publicCardKey(adopted),
          });
          transientPhotos.delete(shot.id);
          alignedCaptures.delete(shot.id);
          ocrController?.abort();
          ocrController = undefined;
          captureId = ctx.state.captures.find(
            (item) => item.status === 'pending',
          )?.id;
          selected = undefined;
          details.replaceChildren();
          results.replaceChildren();
          showQueue();
          showCapture();
          tell(
            captureId
              ? 'Foto übernommen. Das nächste offene Foto ist ausgewählt.'
              : 'Foto übernommen. Du kannst die nächste Karte fotografieren oder weitere Fotos auswählen.',
          );
        } else sheet.close();
      }
    });
    details.replaceChildren(form);
    showCapture();
    details.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  function manualForm(): void {
    sheet.dialog.classList.remove('w-guided-scan', 'w-scan-confirming');
    scanSetChoice.replaceChildren();
    setFlowStage(1);
    interrupt();
    selected = undefined;
    results.replaceChildren();
    details.replaceChildren();
    const name = input();
    name.required = true;
    const set = input();
    set.required = true;
    const number = input();
    number.required = true;
    number.placeholder = 'z. B. 211/198';
    const artist = input();
    const confirmedArtist = check(
      'Ich habe den Illustrator-Credit auf der Karte abgelesen.',
    );
    const form = el(
      'form',
      'w-manual-form',
      el('h3', '', 'Ausgabe manuell erfassen'),
      message(
        'Unbekannte Angaben bleiben offen. Ein Illustrator wird nur mit deiner Bestätigung für Artist-Vorschläge verwendet.',
      ),
      el(
        'div',
        'w-form-grid',
        field('Kartenname', name),
        field('Set', set),
        field('Sammlernummer', number),
        field('Illustrator (optional)', artist),
      ),
      confirmedArtist.row,
    );
    const next = action('Angaben und Menge prüfen', () => undefined, 'primary');
    next.type = 'submit';
    form.append(next);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const manual: PersonalCard = {
        key: `manual:${normalize(set.value)}:${normalize(number.value)}:${language.value}`,
        name: name.value.trim(),
        setName: set.value.trim(),
        setId: '',
        number: number.value.trim(),
        language: language.value,
        image: '',
        source: 'manual',
        sourceId: '',
        artist: confirmedArtist.input.checked ? artist.value.trim() : '',
        artistSource:
          confirmedArtist.input.checked && artist.value.trim()
            ? 'manual'
            : 'unknown',
        evolvesFrom: '',
        stage: '',
        // 'unverified' is a holding state, not a fifth advertised printing.
        finishes: finishes.filter((printing) => printing !== 'unverified'),
      };
      choose(manual);
    });
    details.append(form);
    name.focus();
  }

  async function onlineSearch(reset = true): Promise<void> {
    const value = search.value.trim();
    if (value.length < 2 && !browser.hasFilters()) {
      results.replaceChildren();
      browser.pager.replaceChildren();
      return;
    }
    interrupt();
    const controller = new AbortController();
    searchController = controller;
    try {
      await browser.run(controller.signal, reset);
    } catch (error) {
      if (!controller.signal.aborted && !closed) tell(errorText(error), true);
    }
  }
  search.addEventListener('input', () => {
    sheet.dialog.classList.remove('w-guided-scan', 'w-scan-confirming');
    scanSetChoice.replaceChildren();
    interrupt();
    clearTimeout(debounce);
    if (search.value.trim().length >= 2) {
      renderChoices(
        ctx.catalog
          .filter((card) => matchesCard(card, search.value))
          .slice(0, 18),
      );
    } else {
      results.replaceChildren();
      browser.pager.replaceChildren();
    }
    if (search.value.trim().length >= 2 || browser.hasFilters())
      debounce = setTimeout(() => {
        void onlineSearch();
      }, 650);
  });
  language.addEventListener('change', () => {
    interrupt();
    browser.languageChanged();
  });
  showQueue();
  showCapture();
  if (selected) renderConfirmation();
  else if (capture()?.text)
    void renderScanReview(capture()!.text, capture()!.candidates);
  else results.replaceChildren();
  if (options.live) takePhoto.click();
  else if (options.photos) gallery.click();
  else if (options.browse || options.setId || options.artist) search.focus();
  else if (!options.card) scanBinder.focus({ preventScroll: true });
}
