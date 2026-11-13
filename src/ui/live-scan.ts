import { manualCaptureAvailable } from '../domain/live-capture-ui';
import { scanProgress } from './scan-progress';
import { recordBetaEvent } from '../data/beta-diagnostics';
import {
  VISUAL_BETA_REFERENCE_COUNT,
  visualBetaEnabled,
} from '../data/visual-beta';
import { cardProjection, type Quad } from '../domain/photo-geometry';
import { suggestCardCorners } from '../domain/card-outline';
import { nextCardLock, plausibleCardQuad } from '../domain/live-card-lock';
import { updateCaptureLatch } from '../domain/scan-capture-latch';
import {
  MAX_PENDING_SCAN_CAPTURES,
  type LiveCaptureOutcome,
} from '../domain/scan-session-guardrails';
import { action, el, errorText, modal } from './workspace-dom';

type CaptureHandler = (
  file: File,
  aligned: boolean,
  onAnalysisState: (active: boolean, detail?: string) => void,
) => Promise<LiveCaptureOutcome>;

function visibleCrop(video: HTMLVideoElement, width: number, height: number) {
  const ratio = width / height;
  const videoRatio = video.videoWidth / video.videoHeight;
  if (videoRatio > ratio) {
    const cropWidth = video.videoHeight * ratio;
    return {
      x: (video.videoWidth - cropWidth) / 2,
      y: 0,
      width: cropWidth,
      height: video.videoHeight,
    };
  }
  const cropHeight = video.videoWidth / ratio;
  return {
    x: 0,
    y: (video.videoHeight - cropHeight) / 2,
    width: video.videoWidth,
    height: cropHeight,
  };
}

/** Draw only the actually visible camera area; detection and OCR share coordinates. */
function drawVisible(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  const crop = visibleCrop(video, canvas.width, canvas.height);
  canvas
    .getContext('2d', { willReadFrequently: true })!
    .drawImage(
      video,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
}

/**
 * Project the detected physical corners to OCR's 630×880 scan size.
 * Without reliable corners, return the unaligned frame for manual review.
 * All buffers are short lived and stay on the device.
 */
async function snapshot(
  video: HTMLVideoElement,
  corners: Quad | null,
): Promise<Blob> {
  const source = document.createElement('canvas');
  source.width = 756;
  source.height = 1008;
  drawVisible(video, source);
  let output: HTMLCanvasElement = source;
  if (corners) {
    const project = cardProjection(corners);
    const pixels = source
      .getContext('2d', { willReadFrequently: true })!
      .getImageData(0, 0, source.width, source.height);
    output = document.createElement('canvas');
    output.width = 630;
    output.height = 880;
    const out = output.getContext('2d')!;
    const result = out.createImageData(output.width, output.height);
    for (let y = 0; y < output.height; y++) {
      for (let x = 0; x < output.width; x++) {
        const point = project(x / (output.width - 1), y / (output.height - 1));
        const px = Math.max(
          0,
          Math.min(source.width - 1, Math.round(point.x * (source.width - 1))),
        );
        const py = Math.max(
          0,
          Math.min(
            source.height - 1,
            Math.round(point.y * (source.height - 1)),
          ),
        );
        const offset = (py * source.width + px) * 4;
        const destination = (y * output.width + x) * 4;
        result.data[destination] = pixels.data[offset]!;
        result.data[destination + 1] = pixels.data[offset + 1]!;
        result.data[destination + 2] = pixels.data[offset + 2]!;
        result.data[destination + 3] = 255;
      }
    }
    out.putImageData(result, 0, 0);
  } else {
    // The on-screen guide supplies a usable crop when edge detection fails.
    // This does not verify the physical corners or the card identity.
    const guideWidth = source.width * 0.73;
    const guideHeight = guideWidth * (88 / 63);
    const framed = document.createElement('canvas');
    framed.width = 630;
    framed.height = 880;
    framed
      .getContext('2d')!
      .drawImage(
        source,
        (source.width - guideWidth) / 2,
        (source.height - guideHeight) / 2,
        guideWidth,
        guideHeight,
        0,
        0,
        framed.width,
        framed.height,
      );
    output = framed;
  }
  return new Promise((resolve, reject) => {
    output.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Der Kameraschnappschuss ist fehlgeschlagen.')),
      'image/jpeg',
      0.9,
    );
  });
}

/**
 * Camera-first on-device scanner. Only the actual detection result turns
 * the frame lime; three stable observations trigger automatic capture.
 * Recognition always returns to the existing human confirmation workflow.
 */
export function openLiveScanner(
  onCapture: CaptureHandler,
  onFileCamera: () => void,
  pendingCaptures: () => number,
  onSwitchToPage?: () => void,
  onReview?: () => void,
): void {
  const sheet = modal('Karte live scannen', true);
  sheet.dialog.classList.add('w-live-scan-dialog');
  const parent = Array.from(
    document.querySelectorAll<HTMLDialogElement>('dialog.w-dialog[open]'),
  ).find((dialog) => dialog !== sheet.dialog);
  // Render only one visible scanner surface. The add-card sheet retains its
  // in-memory photos and reappears intact after closing the camera.
  if (parent) {
    parent.classList.add('w-scan-parent-suspended');
    parent.inert = true;
  }
  sheet.onClose(() => {
    if (!parent) return;
    parent.classList.remove('w-scan-parent-suspended');
    parent.inert = false;
  });
  const video = el('video', 'w-live-video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('aria-label', 'Live-Kamerabild der Kartenaufnahme');
  const frame = el('div', 'w-live-frame-guide');
  frame.setAttribute('aria-hidden', 'true');
  const outline = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  outline.classList.add('w-live-outline');
  outline.setAttribute('viewBox', '0 0 100 100');
  outline.setAttribute('preserveAspectRatio', 'none');
  outline.setAttribute('aria-hidden', 'true');
  const polygon = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'polygon',
  );
  polygon.setAttribute('fill', 'none');
  polygon.setAttribute('stroke', 'var(--accent)');
  polygon.setAttribute('stroke-width', '0.8');
  polygon.setAttribute('vector-effect', 'non-scaling-stroke');
  outline.append(polygon);
  const stage = el('div', 'w-live-stage', video, frame, outline);
  const stageLabel = el(
    'span',
    'w-live-stage-label',
    'Karte mittig ausrichten',
  );
  stage.append(stageLabel);
  const analysisCaption = el(
    'span',
    'w-live-analysis-caption',
    'Kartendetails werden lokal geprüft …',
  );
  const analysis = el(
    'div',
    'w-live-analysis',
    el('span', 'w-live-analysis-line'),
    analysisCaption,
  );
  analysis.setAttribute('role', 'status');
  analysis.hidden = true;
  const resultStatus = el('p', 'w-muted w-live-last-result');
  resultStatus.setAttribute('role', 'status');
  resultStatus.hidden = true;

  let ongoingAnalysis = 0;
  const onAnalysisState = (active: boolean, detail?: string) => {
    if (closed) return;
    // Status text changes come from actual OCR/retry/catalogue work;
    // they do not increase the number of pending recognitions.
    if (detail) {
      if (active) analysisCaption.textContent = detail;
      else {
        resultStatus.textContent = detail;
        resultStatus.hidden = false;
      }
      return;
    }
    ongoingAnalysis = Math.max(0, ongoingAnalysis + (active ? 1 : -1));
    analysis.hidden = ongoingAnalysis === 0;
    // Previous-photo recognition must never hide this card's shutter.
    stage.classList.toggle('is-analyzing', ongoingAnalysis > 0);
    if (!ongoingAnalysis)
      analysisCaption.textContent = 'Kartendetails werden lokal geprüft …';
  };
  const journey = scanProgress();
  const status = el('p', 'w-live-status', 'Kamera wird gestartet …');
  status.setAttribute('role', 'status');
  const visionStatus = el(
    'p',
    'w-muted w-live-vision-state',
    visualBetaEnabled()
      ? `DINOv2-Pilot aktiviert · ${VISUAL_BETA_REFERENCE_COUNT} Referenzkarten · Modellverfügbarkeit wird beim Scan geprüft`
      : `DINOv2 nicht aktiv · optionaler Test mit ${VISUAL_BETA_REFERENCE_COUNT} Karten unter Profil`,
  );
  const progress = el('progress', 'w-progress w-live-progress');
  progress.max = 3;
  progress.value = 0;
  progress.setAttribute('aria-label', 'Stabile Kartenausrichtung');
  const help = el(
    'p',
    'w-muted w-live-help',
    'Karte aufrecht halten, Spiegelungen vermeiden. Die Umrandung zeigt erkannte Ecken. Jede Aufnahme bleibt bis zu deiner Bestätigung offen.',
  );
  const trigger = action(
    'Manuell aufnehmen',
    () => {
      void captureCard();
    },
    'secondary',
    'camera',
  );
  const next = action(
    'Nächste Karte scannen',
    () => {
      if (running && waitingForRemoval) {
        armForNextCard();
      } else {
        void startCamera();
      }
    },
    'primary',
    'camera',
  );
  next.hidden = true;
  const finish = action(
    'Ergebnisse prüfen',
    () => {
      sheet.close();
      onReview?.();
    },
    'secondary',
    'check',
  );
  finish.hidden = true;
  const reviewSummary = el('p', 'w-live-review-summary');
  reviewSummary.setAttribute('role', 'status');
  reviewSummary.hidden = true;
  function refreshReview(): void {
    const pending = pendingCaptures();
    reviewSummary.hidden = pending === 0;
    finish.hidden = pending === 0;
    sheet.dialog.classList.toggle('has-pending-scans', pending > 0);
    reviewSummary.textContent = `${pending} ${pending === 1 ? 'offene Aufnahme' : 'offene Aufnahmen'} · erst nach deiner Bestätigung im Bestand.`;
    finish.querySelector('span')!.textContent =
      `Ergebnisse prüfen (${pending})`;
  }
  function pauseForReview(): void {
    // Stop camera tracks rather than recording a photo that the bounded
    // queue would reject. Existing captures and their OCR remain intact.
    stopCamera();
    refreshReview();
    stage.dataset.scanPhase = 'queue-full';
    stageLabel.textContent = 'Aufnahmen jetzt prüfen';
    status.textContent =
      'Der Scan-Puffer ist voll. Prüfe deine Aufnahmen und starte danach eine neue Scanrunde.';
    trigger.hidden = true;
    next.hidden = true;
    journey.update('review', 'Aufnahme-Puffer voll · Prüfung erforderlich');
    recordBetaEvent('scan_result', 'scan', 'scan_queue_full', 'unknown');
  }
  const fallback = action(
    'Stattdessen Kamerafoto verwenden',
    () => {
      sheet.close();
      onFileCamera();
    },
    'secondary',
    'camera',
  );
  const mode = el(
    'div',
    'w-scan-mode-toggle',
    action('Zurück', () => sheet.close(), 'text', 'undo'),
    action('Einzelkarte', () => undefined, 'secondary'),
    action(
      'Binderseite',
      () => {
        sheet.close();
        onSwitchToPage?.();
      },
      'secondary',
    ),
  );
  mode.setAttribute('role', 'group');
  mode.setAttribute('aria-label', 'Scanmodus wählen');
  mode.children[1]!.setAttribute('aria-pressed', 'true');
  mode.lastElementChild!.setAttribute('aria-pressed', 'false');
  const options = el(
    'details',
    'w-live-options',
    el('summary', '', 'Tipps & Kamerafoto'),
    help,
    fallback,
  );
  const cameraFallback = action(
    'Kamerafoto aufnehmen',
    () => {
      sheet.close();
      onFileCamera();
    },
    'primary',
    'camera',
  );
  cameraFallback.classList.add('w-live-fallback-primary');
  cameraFallback.hidden = true;
  // Camera, status, shutter, review: everything else is optional.
  trigger.hidden = true;
  trigger.classList.add('w-live-manual-capture', 'w-live-shutter');
  next.classList.add('w-live-next');
  finish.classList.add('w-live-review');
  sheet.dialog.classList.add('w-live-scan-minimal');
  sheet.body.append(
    mode,
    stage,
    status,
    analysis,
    resultStatus,
    visionStatus,
    journey.element,
    progress,
    options,
  );
  sheet.footer.append(reviewSummary, trigger, next, finish, cameraFallback);

  // A sticky review footer can occlude a status overlay inside the camera
  // stage on short iPhone viewports. For camera-denied/error states, move the
  // *same live status node* ahead of the pending-review controls. This keeps
  // screen-reader announcements and the original capture lifecycle intact.
  const showCameraAlert = () => {
    if (status.parentElement !== sheet.footer) sheet.footer.prepend(status);
    stage.classList.add('has-camera-alert');
    sheet.dialog.classList.add('has-camera-alert');
  };
  const restoreCameraStatus = () => {
    if (status.parentElement !== sheet.body)
      sheet.body.insertBefore(status, analysis);
    stage.classList.remove('has-camera-alert');
    sheet.dialog.classList.remove('has-camera-alert');
  };
  let stream: MediaStream | null = null;
  // Track every granted stream, even when a late permission/play response races
  // with closing or restarting the scanner.
  const acquiredStreams = new Set<MediaStream>();
  let cameraGeneration = 0;
  let frameId = 0;
  let running = false;
  let busy = false;
  let closed = false;
  let observations = 0;
  let waitingForRemoval = false;
  let missingFrames = 0;
  let last: Quad | null = null;
  let reliable: Quad | null = null;
  let sampled = 0;
  let cameraReadyAt = 0;
  let frameFailures = 0;
  const sample = document.createElement('canvas');
  sample.width = 192;
  sample.height = 256;

  function stopCamera(): void {
    cameraGeneration++;
    running = false;
    trigger.hidden = true;
    stage.dataset.scanPhase = 'paused';
    cancelAnimationFrame(frameId);
    for (const acquired of acquiredStreams) {
      for (const track of acquired.getTracks()) track.stop();
    }
    acquiredStreams.clear();
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    video.srcObject = null;
  }

  function armForNextCard(): void {
    if (!running || closed || busy) return;
    waitingForRemoval = false;
    missingFrames = 0;
    frameFailures = 0;
    observations = 0;
    last = null;
    reliable = null;
    polygon.removeAttribute('points');
    stage.classList.remove('has-card-outline');
    stage.dataset.scanPhase = 'ready';
    stageLabel.textContent = 'Nächste Karte ausrichten';
    status.textContent = 'Karte in den Rahmen halten · Ecken werden gesucht';
    trigger.hidden = true;
    next.hidden = true;
    progress.value = 0;
    cameraReadyAt = performance.now();
  }

  async function captureCard(): Promise<void> {
    if (
      !running ||
      busy ||
      waitingForRemoval ||
      !video.videoWidth ||
      !video.videoHeight
    )
      return;
    if (pendingCaptures() >= MAX_PENDING_SCAN_CAPTURES) {
      pauseForReview();
      return;
    }
    busy = true;
    resultStatus.hidden = true;
    trigger.hidden = true;
    trigger.disabled = true;
    journey.update('capture', 'Aufnahme wird ausgerichtet …', 0);
    stage.dataset.scanPhase = 'capture';
    const aligned = reliable !== null;
    const chosen = reliable;
    status.textContent = aligned
      ? 'Karte eingerahmt · Foto wird ausgerichtet …'
      : 'Foto wird aufgenommen · Ecken anschließend prüfen …';
    try {
      const blob = await snapshot(video, chosen);
      if (closed || !running || document.hidden) return;
      status.textContent = 'Foto wird lokal vorgemerkt …';
      progress.value = 3;
      journey.update('capture', 'Foto erfasst · Identität später prüfen');
      stage.dataset.scanPhase = 'capture';
      stageLabel.textContent = 'Foto erfasst';
      const outcome = await onCapture(
        new File([blob], `Live-Scan-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        }),
        aligned,
        onAnalysisState,
      );
      if (closed) return;
      if (outcome === 'limit') {
        pauseForReview();
        return;
      }
      if (outcome === 'error')
        throw new Error(
          'Foto konnte nicht zur Scan-Sitzung hinzugefügt werden.',
        );
      if (!closed && running) {
        // The image is queued WITHOUT waiting for OCR, model loads or
        // TCGdex network requests. Continue from the same MediaStream
        // once the physical card is removed, HoloGem-style.
        waitingForRemoval = true;
        missingFrames = 0;
        observations = 0;
        last = null;
        reliable = null;
        polygon.removeAttribute('points');
        stage.classList.remove('has-card-outline');
        status.textContent =
          outcome === 'duplicate'
            ? 'Diese Aufnahme ist bereits vorhanden · Karte wechseln'
            : 'Foto erfasst · OCR läuft im Hintergrund · nächste Karte einlegen';
        journey.update('review', 'Foto vorgemerkt · noch nicht hinzugefügt', 1);
        stage.dataset.scanPhase = 'queued';
        stageLabel.textContent =
          outcome === 'duplicate' ? 'Bereits erfasst' : 'Karte wechseln';
        next.hidden = false;
        refreshReview();
        trigger.hidden = true;
        if (pendingCaptures() >= MAX_PENDING_SCAN_CAPTURES) {
          pauseForReview();
          return;
        }
        progress.value = 0;
      }
    } catch (error) {
      if (!closed) {
        stopCamera();
        recordBetaEvent(
          'scan_result',
          'scan',
          'camera_capture_failed',
          'error',
        );
        journey.update('error', 'Scan nicht abgeschlossen · erneut versuchen');
        stage.dataset.scanPhase = 'error';
        stageLabel.textContent = 'Scan bitte wiederholen';
        options.open = true;
        cameraFallback.hidden = false;
        showCameraAlert();
        status.textContent = `Scan fehlgeschlagen: ${errorText(error)}`;
        next.hidden = false;
        refreshReview();
        trigger.hidden = true;
      }
    } finally {
      busy = false;
      trigger.disabled = false;
    }
  }

  function inspectFrame(time: number): void {
    if (!running || closed) return;
    frameId = requestAnimationFrame(inspectFrame);
    trigger.hidden = !manualCaptureAvailable({
      running,
      busy,
      analyzing: ongoingAnalysis > 0,
      waitingForRemoval,
      stableFrames: observations,
      elapsedMs: time - cameraReadyAt,
    });
    if (busy || document.hidden || time - sampled < 280) return;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      if (time - cameraReadyAt > 3000)
        status.textContent =
          'Warte auf ein Kamerabild · Kamera und Berechtigung prüfen';
      return;
    }
    sampled = time;
    let corners: Quad | null = null;
    try {
      drawVisible(video, sample);
      const pixels = sample
        .getContext('2d', { willReadFrequently: true })!
        .getImageData(0, 0, sample.width, sample.height);
      corners = suggestCardCorners(pixels.data, sample.width, sample.height);
      frameFailures = 0;
    } catch {
      // A temporarily missing camera frame must never trigger a shutter.
      frameFailures++;
    }
    if (waitingForRemoval) {
      const latch = updateCaptureLatch(
        { waitingForRemoval, missingFrames },
        Boolean(
          corners && plausibleCardQuad(corners, sample.width, sample.height),
        ),
      );
      waitingForRemoval = latch.waitingForRemoval;
      missingFrames = latch.missingFrames;
      if (!waitingForRemoval) armForNextCard();
      return;
    }
    const lock = nextCardLock(
      { corners: last, stableFrames: observations },
      corners,
      sample.width,
      sample.height,
    );
    if (!lock.corners) {
      observations = 0;
      last = null;
      reliable = null;
      stage.classList.remove('has-card-outline');
      polygon.removeAttribute('points');
      progress.value = 0;
      stage.dataset.scanPhase = 'ready';
      stageLabel.textContent = 'Karte ausrichten';
      status.textContent =
        frameFailures >= 3
          ? 'Ecken nicht erkennbar · jetzt manuell aufnehmen'
          : time - cameraReadyAt > 4500
            ? 'Ecken werden gesucht · du kannst jederzeit manuell aufnehmen'
            : 'Karte in den Rahmen halten · Ecken werden gesucht';
      return;
    }
    observations = lock.stableFrames;
    last = lock.corners;
    reliable = observations >= 2 ? lock.corners : null;
    polygon.setAttribute(
      'points',
      lock.corners
        .map((point) => `${point.x * 100},${point.y * 100}`)
        .join(' '),
    );
    stage.classList.add('has-card-outline');
    stage.dataset.scanPhase = observations >= 2 ? 'stable' : 'detected';
    progress.value = observations;
    stageLabel.textContent =
      observations >= 2 ? 'Kurz ruhig halten' : 'Karte gefunden';
    status.textContent =
      observations >= 2
        ? 'Kartenecken erkannt · bitte kurz ruhig halten'
        : 'Kartenumriss gefunden · Stabilität wird geprüft';
    if (observations >= 3) void captureCard();
  }

  async function startCamera(): Promise<void> {
    if (closed || busy) return;
    if (pendingCaptures() >= MAX_PENDING_SCAN_CAPTURES) {
      pauseForReview();
      return;
    }
    restoreCameraStatus();
    stopCamera();
    const generation = cameraGeneration;
    waitingForRemoval = false;
    missingFrames = 0;
    cameraFallback.hidden = true;
    next.hidden = true;
    next.querySelector('span')!.textContent = 'Nächste Karte scannen';
    refreshReview();
    trigger.hidden = true;
    trigger.disabled = true;
    observations = 0;
    last = null;
    reliable = null;
    progress.value = 0;
    sampled = 0;
    frameFailures = 0;
    stage.classList.remove('has-card-outline');
    polygon.removeAttribute('points');
    journey.update('ready', 'Karte in den Rahmen halten', 0);
    stage.dataset.scanPhase = 'ready';
    stageLabel.textContent = 'Karte mittig ausrichten';
    status.textContent = 'Kamera wird gestartet …';
    if (!navigator.mediaDevices?.getUserMedia) {
      recordBetaEvent('scan_result', 'scan', 'camera_unavailable', 'error');
      stage.dataset.scanPhase = 'error';
      options.open = true;
      cameraFallback.hidden = false;
      trigger.hidden = true;
      showCameraAlert();
      status.textContent =
        'Der Browser bietet keine Live-Kamera. Nutze stattdessen ein Kamerafoto.';
      return;
    }
    try {
      const opened = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1920 },
        },
      });
      acquiredStreams.add(opened);
      if (closed || document.hidden || generation !== cameraGeneration) {
        for (const track of opened.getTracks()) track.stop();
        acquiredStreams.delete(opened);
        return;
      }
      stream = opened;
      video.srcObject = opened;
      await video.play();
      if (closed || document.hidden || generation !== cameraGeneration) {
        stopCamera();
        return;
      }
      running = true;
      cameraReadyAt = performance.now();
      trigger.disabled = false;
      status.textContent = 'Kamera bereit · automatisch oder manuell aufnehmen';
      frameId = requestAnimationFrame(inspectFrame);
    } catch (error) {
      if (closed || generation !== cameraGeneration) return;
      stopCamera();
      recordBetaEvent('scan_result', 'scan', 'camera_start_failed', 'error');
      stage.dataset.scanPhase = 'error';
      options.open = true;
      cameraFallback.hidden = false;
      trigger.hidden = true;
      stageLabel.textContent = 'Kamera nicht verfügbar';
      showCameraAlert();
      status.textContent = `Live-Kamera nicht verfügbar: ${errorText(error)}`;
      help.textContent =
        'Prüfe die Kameraberechtigung in Safari oder verwende die Fotoaufnahme als Rückfallmöglichkeit.';
    }
  }

  const backgrounded = () => {
    if (document.hidden) {
      stopCamera();
      if (!closed && !busy) {
        status.textContent =
          'Kamera pausiert. Tippe auf „Kamera wieder starten“.';
        next.hidden = false;
        trigger.hidden = true;
        next.querySelector('span')!.textContent = 'Kamera wieder starten';
      }
    }
  };
  document.addEventListener('visibilitychange', backgrounded);
  sheet.onClose(() => {
    closed = true;
    stopCamera();
    document.removeEventListener('visibilitychange', backgrounded);
  });
  void startCamera();
}
