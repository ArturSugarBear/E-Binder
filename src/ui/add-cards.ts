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
import { createRecognitionSession, recognizePhoto } from '../data/recognize';
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
import {
  combineLiveOcrText,
  LIVE_SCAN_MAX_OCR_PASSES,
  nextLiveHotZone,
  remainingLiveScanBudget,
  type LiveHotZone,
} from '../domain/live-ocr-policy';
import {
  requiresEditionStampReview,
  editionClaimFromNote,
  validateVintageEdition,
  type VintageEdition,
} from '../domain/vintage-edition';
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
  queue.id = `w-capture-queue-${uid()}`;
  const queueToggle = action(
    'Weitere Aufnahmen anzeigen',
    () => {
      const expanded = queue.classList.toggle('is-expanded');
      queueToggle.setAttribute('aria-expanded', String(expanded));
    },
    'secondary',
  );
  queueToggle.classList.add('w-scan-queue-toggle');
  queueToggle.setAttribute('aria-controls', queue.id);
  queueToggle.setAttribute('aria-expanded', 'false');
  queueToggle.hidden = true;
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
  let reviewingLiveQueue = false;
  const liveOcrAbort = new AbortController();
  let liveOcrSession: ReturnType<typeof createRecognitionSession> | undefined;
  let liveOcrQueue: Promise<void> = Promise.resolve();
  const liveOcrJobs = new Map<string, Promise<void>>();
  const liveOcrEvidence = new Map<string, string>();
  const liveReviewResults = new Map<
    string,
    {
      text: string;
      candidates: PersonalCard[];
      suggested?: PersonalCard;
      basis?: AutomaticScanResult['basis'];
    }
  >();
  const awaitingLiveReview = new Set<string>();
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
    liveOcrAbort.abort();
    liveOcrSession?.close();
    liveOcrJobs.clear();
    liveOcrEvidence.clear();
    liveReviewResults.clear();
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
    () => {
      prepareLiveOcr();
      openLiveScanner(
        async (file, aligned, onAnalysisState) => {
          const existing = new Set(ctx.state.captures.map((shot) => shot.id));
          // Only local photo queueing blocks capture; model inference does not.
          await addFiles([file], false, aligned, true);
          const shot = capture();
          if (shot && !existing.has(shot.id))
            startLiveOcr(shot.id, file, onAnalysisState);
        },
        () => camera.click(),
        () =>
          ctx.state.captures.filter((shot) => shot.status === 'pending').length,
        () => {
          sheet.close();
          ctx.openPageScan();
        },
        () => {
          reviewingLiveQueue = true;
          captureId = ctx.state.captures.find(
            (item) => item.status === 'pending',
          )?.id;
          showQueue();
          showCapture();
          const shot = capture();
          if (shot?.status === 'pending') {
            if (shot.text) void renderScanReview(shot.text, shot.candidates);
            else void runOcr();
          }
        },
      );
    },
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
    queueToggle,
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
      liveOcrEvidence.delete(id);
      liveReviewResults.delete(id);
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
    const pending = shots.filter((shot) => shot.status !== 'confirmed');
    queueToggle.hidden = pending.length < 2;
    queueToggle.textContent = `Aufnahmen wechseln (${pending.length} offen)`;
    if (pending.length < 2) queue.classList.remove('is-expanded');
    queueToggle.setAttribute(
      'aria-expanded',
      String(queue.classList.contains('is-expanded')),
    );
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
          queue.classList.remove('is-expanded');
          queueToggle.setAttribute('aria-expanded', 'false');
          sheet.dialog.classList.remove('w-guided-scan', 'w-scan-confirming');
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

  function prepareLiveOcr(): void {
    if (closed || liveOcrAbort.signal.aborted || liveOcrSession) return;
    try {
      liveOcrSession = createRecognitionSession(
        liveOcrAbort.signal,
        () => undefined,
        { fast: true, timeoutMs: 5600 },
      );
      liveOcrSession.warmup();
    } catch {
      liveOcrSession?.close();
      liveOcrSession = undefined;
    }
  }

  /**
   * Each physical scan has a single absolute 5.6-second window covering
   * worker queueing, up to three ACTUAL OCR hot-zone passes and a bounded
   * catalogue lookup. Recognition never blocks the live camera. Multiple
   * crops of one image are not independent confidence votes.
   */
  function startLiveOcr(
    id: string,
    photo: File,
    onAnalysisState: (active: boolean, detail?: string) => void,
  ): void {
    if (closed || liveOcrAbort.signal.aborted || liveOcrJobs.has(id)) return;
    const started = performance.now();
    onAnalysisState(true);
    onAnalysisState(true, 'Kartenmerkmale werden gelesen …');
    // Only serialize ONNX inference. A slow online catalogue lookup for
    // card N must not prevent the worker from reading card N+1.
    const previousOcr = liveOcrQueue;
    let releaseOcr: () => void = () => undefined;
    liveOcrQueue = new Promise<void>((resolve) => {
      releaseOcr = resolve;
    });
    const task = previousOcr
      .then(async () => {
        if (closed || !transientPhotos.has(id) || liveOcrAbort.signal.aborted)
          return;
        const remaining = () =>
          remainingLiveScanBudget(started, performance.now());
        let text = '';
        const tried: LiveHotZone[] = [];
        if (!liveOcrSession && remaining() > 300) prepareLiveOcr();
        if (liveOcrSession && remaining() > 300) {
          try {
            let attempts = 1;
            onAnalysisState(true, 'Set, Nummer und Name werden gelesen …');
            text = await liveOcrSession.recognize(
              photo,
              false,
              undefined,
              remaining(),
            );
            liveOcrEvidence.set(id, text);
            while (
              attempts < LIVE_SCAN_MAX_OCR_PASSES &&
              remaining() > 650 &&
              !liveOcrAbort.signal.aborted
            ) {
              const region = nextLiveHotZone(text, tried);
              if (!region) break;
              tried.push(region);
              attempts++;
              onAnalysisState(
                true,
                region.startsWith('footer')
                  ? 'Sammlernummer wird nochmals geprüft …'
                  : 'Vollständiger Kartenname wird geprüft …',
              );
              const extra = await liveOcrSession.recognize(
                photo,
                false,
                region,
                remaining(),
              );
              text = combineLiveOcrText(text, extra, region);
              liveOcrEvidence.set(id, text);
            }
          } catch {
            // Timeouts terminate the worker, but partial OCR evidence is
            // retained; the collector may correct the card manually.
            liveOcrSession?.close();
            liveOcrSession = undefined;
          }
        }
        // Subsequent photos can now use the warmed OCR worker while this
        // photo's catalogue requests continue in the background.
        releaseOcr();
        if (closed || liveOcrAbort.signal.aborted || !transientPhotos.has(id))
          return;
        const candidatesFromLocal = candidatesFromText(text, [
          ...ctx.catalog,
          ...ctx.state.holdings.map((item) => item.card),
        ]);
        let automatic: AutomaticScanResult | undefined;
        if (text.trim() && remaining() > 450) {
          onAnalysisState(true, 'Kartenkatalog wird abgeglichen …');
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            Math.max(1, remaining() - 100),
          );
          const cleanup = () => controller.abort();
          liveOcrAbort.signal.addEventListener('abort', cleanup, {
            once: true,
          });
          try {
            automatic = await resolvePhotoScan(
              photo,
              text,
              candidatesFromLocal,
              language.value,
              controller.signal,
            );
          } catch {
            // Remote catalogue access is advisory. Never spend beyond the
            // live scan deadline or fabricate a suggested printing.
          } finally {
            clearTimeout(timeout);
            liveOcrAbort.signal.removeEventListener('abort', cleanup);
          }
        }
        if (closed || liveOcrAbort.signal.aborted || !transientPhotos.has(id))
          return;
        const candidates = [
          ...new Map(
            [...(automatic?.candidates ?? []), ...candidatesFromLocal].map(
              (card) => [card.key, card],
            ),
          ).values(),
        ].slice(0, 24);
        liveOcrEvidence.set(id, text);
        liveReviewResults.set(id, {
          text,
          candidates,
          suggested: automatic?.suggested,
          basis: automatic?.basis,
        });
        recordBetaEvent(
          'scan_result',
          'scan',
          candidates.length
            ? 'live_candidate_ready'
            : text.trim()
              ? 'live_ocr_unresolved'
              : 'live_ocr_empty',
          candidates.length ? 'ok' : 'unknown',
          {
            candidate: publicCardKey(candidates[0]),
            metric: Math.min(
              200,
              Math.ceil((performance.now() - started) / 100),
            ),
          },
        );
      })
      .catch(() => {
        // On any unexpected failure the photo remains available for review.
        if (closed || liveOcrAbort.signal.aborted) return;
        liveReviewResults.set(id, {
          text: liveOcrEvidence.get(id) ?? '',
          candidates: [],
        });
        recordBetaEvent(
          'scan_result',
          'scan',
          'live_ocr_unresolved',
          'unknown',
        );
      })
      .finally(() => {
        // Release even if the photo was discarded or analysis aborted before
        // reaching the catalogue stage.
        releaseOcr();
        onAnalysisState(false);
        liveOcrJobs.delete(id);
      });
    liveOcrJobs.set(id, task);
  }

  async function addFiles(
    files: FileList | File[] | null,
    fromCamera = false,
    autoAligned = false,
    queuedLive = false,
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
        if (!queuedLive) {
          photoArea.scrollIntoView({ block: 'start' });
          tell(
            `${added} Aufnahmen geöffnet.${repeats ? ` ${repeats} identische Fotos waren bereits erfasst; Mengen wurden nicht erhöht.` : ''} Richte das Foto aus und starte die Erkennung oder suche die Ausgabe manuell.`,
          );
        }
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
    if (fromCamera && first && !closed && !queuedLive) await runOcr();
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
    if (!shot || shot.status === 'confirmed' || awaitingLiveReview.has(shot.id))
      return;
    awaitingLiveReview.add(shot.id);
    try {
      const liveJob = liveOcrJobs.get(shot.id);
      if (liveJob) {
        tell('Karte wird bereits geprüft · Ergebnis wird vorbereitet …');
        try {
          await liveJob;
        } catch {
          // Recover with the full, foreground OCR path on worker failure.
        }
      }
      const current = ctx.state.captures.find((item) => item.id === shot.id);
      if (
        closed ||
        shot.id !== captureId ||
        !current ||
        current.status === 'confirmed'
      )
        return;
      // The live camera has already completed its bounded OCR, targeted
      // retries and (when possible) the exact-print catalogue check.
      // Opening Review must NOT restart the same expensive recognition or
      // force a second capture after a failed attempt.
      const background = liveReviewResults.get(shot.id);
      if (background) {
        ctx.commit('Texterkennung abgeschlossen', (state) =>
          changeState(state, (next) => {
            const target = next.captures.find((item) => item.id === shot.id);
            if (target?.status === 'pending') {
              target.text = background.text.slice(0, 30000);
              target.candidates = background.candidates;
              target.error = '';
            }
          }),
        );
        showCapture();
        await renderScanReview(
          background.text,
          background.candidates,
          background.suggested,
          background.basis,
        );
        results.dataset.scanState = 'complete';
        return;
      }
      await resolveOcrReview(shot);
    } finally {
      awaitingLiveReview.delete(shot.id);
    }
  }

  async function resolveOcrReview(shot: Capture): Promise<void> {
    interrupt();
    const controller = new AbortController();
    ocrController = controller;
    selected = undefined;
    details.replaceChildren();
    results.replaceChildren();
    results.dataset.scanState = 'running';
    results.dataset.scanRankedKeys = '[]';
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
      // A raw camera photo without four trusted card edges still needs the
      // explicit alignment step; never treat its background text as a
      // verified exact printing.
      const prefilled = alignedCaptures.has(shot.id)
        ? liveOcrEvidence.get(shot.id)
        : undefined;
      const aligned =
        alignedCaptures.has(shot.id) || prefilled !== undefined
          ? photo
          : await alignPhoto(photo, controller.signal);
      if (!aligned || closed || controller.signal.aborted) {
        if (!closed && ocrController === controller)
          tell(
            'Ausrichtung abgebrochen. Die Aufnahme bleibt bis zum Schließen geöffnet.',
          );
        return;
      }
      // Reuse fast OCR ONLY when it found both a printed set+number and a
      // plausible full title. A lone number or partial energy/Trainer title
      // automatically triggers the fuller hot-zone OCR in Review without
      // asking the user to take another photo.
      const quickText = prefilled ?? '';
      const usableLive =
        prefilled !== undefined &&
        recognitionClues(quickText).some((clue) =>
          Boolean(clue.setId && clue.number),
        ) &&
        recognizedNameHints(quickText).length > 0;
      const text = usableLive
        ? prefilled
        : await recognizePhoto(
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
      // Privacy-safe beta triage: diagnose why a real scan has no result
      // without uploading OCR content, search text, images or arbitrary input.
      const readClues = recognitionClues(text);
      const readNames = recognizedNameHints(text);
      recordBetaEvent(
        'scan_result',
        'scan',
        !text.trim()
          ? 'ocr_empty'
          : !readClues.length && !readNames.length
            ? 'ocr_unreadable'
            : !readClues.length
              ? 'ocr_no_number'
              : !readClues.some((clue) => clue.setId) && !readNames.length
                ? 'ocr_number_only'
                : 'ocr_identity_clues',
        'unknown',
        { metric: readClues.length },
      );
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

  function confirmQuickScan(card: PersonalCard): void {
    const shot = capture();
    const variant = card.finishes.filter(
      (finish) =>
        finish === 'normal' || finish === 'holo' || finish === 'reverse',
    );
    if (
      card.source !== 'tcgdex' ||
      // Unstamped Base Set prints cannot be automatically identified as 1. Edition.
      requiresEditionStampReview(card) ||
      variant.length !== 1 ||
      !shot ||
      shot.status !== 'pending'
    ) {
      choose(card);
      return;
    }
    const existing = ctx.state.holdings.find(
      (holding) =>
        sameCard(holding.card, card) &&
        holding.finish === variant[0] &&
        !holding.variantNote,
    );
    if ((existing?.quantity ?? 0) >= 999) {
      choose(card);
      return;
    }
    const saved = ctx.commit('Gescannte Karte hinzugefügt', (state) =>
      confirmHolding(
        state,
        {
          card,
          finish: variant[0]!,
          variantNote: '',
          quantity: (existing?.quantity ?? 0) + 1,
          tradeQuantity: existing?.tradeQuantity ?? 0,
          favorite: existing?.favorite ?? false,
          notes: existing?.notes ?? '',
        },
        shot.id,
      ),
    );
    if (!saved) return;
    recordBetaEvent('scan_review', 'scan', 'card_confirmed', 'ok', {
      candidate: publicCardKey(shot.candidates[0]),
      selected: publicCardKey(card),
    });
    transientPhotos.delete(shot.id);
    alignedCaptures.delete(shot.id);
    liveOcrEvidence.delete(shot.id);
    liveReviewResults.delete(shot.id);
    interrupt();
    captureId = ctx.state.captures.find(
      (item) => item.status === 'pending',
    )?.id;
    selected = undefined;
    details.replaceChildren();
    results.replaceChildren();
    scanSetChoice.replaceChildren();
    sheet.dialog.classList.remove('w-guided-scan', 'w-scan-confirming');
    showQueue();
    showCapture();
    tell(
      captureId
        ? 'Karte hinzugefügt. Das nächste Foto kann geprüft werden.'
        : 'Karte hinzugefügt. Scanne die nächste Karte.',
    );
    if (
      reviewingLiveQueue &&
      captureId &&
      transientPhotos.has(captureId) &&
      alignedCaptures.has(captureId)
    )
      void runOcr();
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
    results.hidden = false;
    scanSetChoice.replaceChildren();
    browser.pager.replaceChildren();

    const evidence = scanEvidence(text, candidates);
    // Stable, read-only benchmark contract: the candidate ranking actually
    // offered to the collector, independent of the review card DOM layout.
    const first =
      suggested ??
      (evidence.kind === 'set-number' || evidence.kind === 'name-number'
        ? evidence.card
        : candidates[0]);
    const ranked = [
      ...new Map(
        [...(first ? [first] : []), ...candidates].map((card) => [
          card.key,
          card,
        ]),
      ).values(),
    ];
    results.dataset.scanResultContract = '1';
    results.dataset.scanRankedKeys = JSON.stringify(
      ranked.map((card) => card.key),
    );
    const knownNumber = recognitionClues(text)[0]?.number ?? '';
    const matchCard = el('div', 'w-scan-match-card');
    matchCard.setAttribute('aria-live', 'polite');
    let activeCardKey = '';

    const showPrint = (card: PersonalCard, explanation: string) => {
      if (closed || request !== setChoiceRequest) return;
      scanSetChoice.replaceChildren();
      results.hidden = false;
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
        action(
          card.source === 'tcgdex' &&
            card.finishes.filter(
              (finish) =>
                finish === 'normal' ||
                finish === 'holo' ||
                finish === 'reverse',
            ).length === 1
            ? 'Karte hinzufügen'
            : 'Diese Ausgabe prüfen',
          () => confirmQuickScan(card),
          'primary',
          'check',
        ),
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
      activeCardKey = card.key;
      matchCard.dataset.cardKey = card.key;
      matchCard.replaceChildren(ctx.images.artwork(card), copy);
      // Keep the alternatives mounted (and the disclosure expanded) when
      // the collector selects a different print for comparison.
      if (!results.contains(matchCard)) results.replaceChildren(matchCard);
      results
        .querySelectorAll<HTMLButtonElement>('.w-scan-alternative-grid button')
        .forEach((button) =>
          button.setAttribute(
            'aria-pressed',
            String(button.dataset.cardKey === activeCardKey),
          ),
        );
    };

    const showSetChooser = async () => {
      if (closed || request !== setChoiceRequest) return;
      // Keep the existing matched print and alternatives mounted while
      // the collector verifies set/number. A correction must be reversible,
      // not restart OCR or erase already-present candidate choices.
      results.hidden = true;
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
          activeCardKey
            ? action(
                'Zurück zu den Treffern',
                () => {
                  scanSetChoice.replaceChildren();
                  results.hidden = false;
                  results.scrollIntoView({ block: 'nearest' });
                },
                'secondary',
              )
            : null,
          action(
            'Stattdessen Karte manuell suchen',
            () => {
              sheet.dialog.classList.remove('w-guided-scan');
              scanSetChoice.replaceChildren();
              results.hidden = false;
              results.replaceChildren();
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
        button.dataset.cardKey = card.key;
        button.setAttribute('aria-pressed', String(card.key === activeCardKey));
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
      other.append(
        grid,
        action(
          'Anderes Set oder andere Nummer prüfen',
          () => {
            void showSetChooser();
          },
          'secondary',
        ),
      );
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
      const fallback = el(
        'details',
        'w-scan-fallback-settings',
        el('summary', '', 'Karte anhand von Set und Nummer suchen'),
      );
      fallback.append(
        action(
          'Set-Suche öffnen',
          () => {
            void showSetChooser();
          },
          'secondary',
        ),
      );
      scanSetChoice.replaceChildren(
        el(
          'div',
          'w-scan-set-panel',
          el('p', 'w-eyebrow', 'Erkennung unvollständig'),
          el('h3', '', 'Noch kein sicherer Kartentreffer'),
          el(
            'p',
            'w-muted',
            'Wir konnten aus diesem Foto noch keine vollständige Kartenausgabe bestimmen. Versuche eine neue, gut beleuchtete Aufnahme der ganzen Karte.',
          ),
          action(
            'Neues Foto aufnehmen',
            () => camera.click(),
            'primary',
            'camera',
          ),
          action(
            'Karte nach Namen suchen',
            () => {
              sheet.dialog.classList.remove('w-guided-scan');
              scanSetChoice.replaceChildren();
              searchLine.scrollIntoView({ block: 'start' });
              search.focus();
            },
            'secondary',
          ),
          fallback,
        ),
      );
    }
  }

  function renderChoices(cards: PersonalCard[]): void {
    setFlowStage(1);
    results.classList.remove('w-text-results', 'w-scan-result-stack');
    delete results.dataset.scanResultContract;
    delete results.dataset.scanRankedKeys;
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
    const vintageReview = requiresEditionStampReview(card);
    const edition = vintageReview
      ? select(
          [
            ['unknown', 'Auflage nicht bestimmt'],
            ['unlimited', 'Unlimited – kein Editionsstempel'],
            ['first', '1. Edition – Editionsstempel vorhanden'],
          ],
          editionClaimFromNote(original?.variantNote ?? ''),
        )
      : undefined;
    const stampCheck = vintageReview
      ? check(
          'Ich habe den Editionsstempel auf dieser Karte persönlich geprüft.',
        )
      : undefined;
    const syncEditionStamp = () => {
      if (!stampCheck) return;
      const claimed = editionClaimFromNote(variant.value) === 'first';
      const needStamp = edition?.value === 'first' || claimed;
      stampCheck.row.hidden = !needStamp;
      if (!needStamp) stampCheck.input.checked = false;
    };
    if (edition) {
      // Explicit manual action: neither a catalog image nor a scan assigns
      // a valuable first-edition variant.
      edition.addEventListener('change', () => {
        const value = edition.value as VintageEdition;
        variant.value =
          value === 'first'
            ? '1. Edition'
            : value === 'unlimited'
              ? 'Unlimited'
              : '';
        syncEditionStamp();
      });
      variant.addEventListener('input', syncEditionStamp);
      syncEditionStamp();
    }
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
      ...(edition ? [edition] : []),
      ...(stampCheck ? [stampCheck.input] : []),
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
        ...(edition ? [field('Auflage (Basis-Set)', edition)] : []),
        edition
          ? el(
              'details',
              'w-vintage-extra-details',
              el('summary', '', 'Weitere Druckdetails'),
              field('Zusatzangabe', variant),
            )
          : field('Variante / Auflage / Stempel', variant),
        field('Gesamtmenge dieser Variante', quantity),
      ),
      ...(edition
        ? [
            el(
              'p',
              'w-muted',
              'Wichtig: Holo, Kartennummer und Referenzbild beweisen keine 1. Edition. Prüfe den schwarzen Editionsstempel auf der physischen Karte.',
            ),
          ]
        : []),
      ...(stampCheck ? [stampCheck.row] : []),
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
      const vintageError = validateVintageEdition(
        adopted,
        variant.value,
        stampCheck?.input.checked ?? false,
        edition?.value as VintageEdition | undefined,
      );
      if (vintageError) {
        error.textContent = vintageError;
        error.hidden = false;
        if (
          edition?.value === 'first' &&
          stampCheck &&
          !stampCheck.input.checked
        )
          stampCheck.input.focus();
        else edition?.focus();
        return;
      }
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
          if (
            reviewingLiveQueue &&
            captureId &&
            transientPhotos.has(captureId) &&
            alignedCaptures.has(captureId)
          )
            void runOcr();
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
      action(
        'Zurück zu den Scanoptionen',
        () => {
          details.replaceChildren();
          results.replaceChildren();
          sheet.dialog.classList.remove('w-guided-scan', 'w-scan-confirming');
          captureStart.hidden = false;
          setFlowStage(0);
          showQueue();
          showCapture();
          captureStart.scrollIntoView({ block: 'nearest' });
          takePhoto.focus({ preventScroll: true });
        },
        'secondary',
        'undo',
      ),
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
