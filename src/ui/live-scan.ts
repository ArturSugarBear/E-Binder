import { recordBetaEvent } from '../data/beta-diagnostics';
import { cardProjection, type Quad } from '../domain/photo-geometry';
import { suggestPageCorners } from '../domain/page-outline';
import { nextCardLock } from '../domain/live-card-lock';
import { action, el, errorText, modal } from './workspace-dom';

type CaptureHandler = (file: File, aligned: boolean) => Promise<void>;

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
): void {
  const sheet = modal('Karte live scannen', true);
  sheet.dialog.classList.add('w-live-scan-dialog');
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
  const status = el('p', 'w-live-status', 'Kamera wird gestartet …');
  status.setAttribute('role', 'status');
  const progress = el('progress', 'w-progress w-live-progress');
  progress.max = 3;
  progress.value = 0;
  progress.setAttribute('aria-label', 'Stabile Kartenausrichtung');
  const help = el(
    'p',
    'w-muted w-live-help',
    'Halte die ganze Karte aufrecht in den Rahmen. Vermeide Spiegelungen auf der Folie und sorge für gleichmäßiges Licht. Die grüne Umrandung zeigt erkannte Ecken, noch keine bestätigte Kartenausgabe.',
  );
  const trigger = action(
    'Jetzt aufnehmen',
    () => {
      void captureCard();
    },
    'primary',
    'camera',
  );
  const next = action(
    'Nächste Karte scannen',
    () => {
      void startCamera();
    },
    'primary',
    'camera',
  );
  next.hidden = true;
  const finish = action(
    'Ergebnisse prüfen',
    () => sheet.close(),
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
    reviewSummary.textContent = `${pending} ${pending === 1 ? 'offene Aufnahme' : 'offene Aufnahmen'} · erst nach deiner Bestätigung im Bestand.`;
    finish.querySelector('span')!.textContent =
      `Ergebnisse prüfen (${pending})`;
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
  mode.firstElementChild!.setAttribute('aria-pressed', 'true');
  mode.lastElementChild!.setAttribute('aria-pressed', 'false');
  sheet.body.append(mode, stage, progress, help);
  sheet.footer.append(status, reviewSummary, trigger, next, finish, fallback);
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
  let last: Quad | null = null;
  let reliable: Quad | null = null;
  let sampled = 0;
  const sample = document.createElement('canvas');
  sample.width = 192;
  sample.height = 256;

  function stopCamera(): void {
    cameraGeneration++;
    running = false;
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

  async function captureCard(): Promise<void> {
    if (!running || busy || !video.videoWidth || !video.videoHeight) return;
    busy = true;
    trigger.disabled = true;
    const aligned = reliable !== null;
    const chosen = reliable;
    status.textContent = aligned
      ? 'Karte eingerahmt · Foto wird ausgerichtet …'
      : 'Foto wird aufgenommen · Ecken anschließend prüfen …';
    try {
      const blob = await snapshot(video, chosen);
      if (closed) return;
      stopCamera();
      status.textContent =
        'Aufnahme gesichert · OCR und Katalogabgleich laufen …';
      progress.value = 3;
      await onCapture(
        new File([blob], `Live-Scan-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        }),
        aligned,
      );
      if (!closed) {
        status.textContent =
          'Aufnahme verarbeitet. Prüfe die Kartenausgabe oder scanne die nächste Karte.';
        next.hidden = false;
        refreshReview();
        trigger.hidden = true;
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
    if (document.hidden || time - sampled < 280 || video.readyState < 2) return;
    sampled = time;
    if (!video.videoWidth || !video.videoHeight) return;
    let corners: Quad | null = null;
    try {
      drawVisible(video, sample);
      const pixels = sample
        .getContext('2d', { willReadFrequently: true })!
        .getImageData(0, 0, sample.width, sample.height);
      corners = suggestPageCorners(pixels.data, sample.width, sample.height);
    } catch {
      // A temporarily missing camera frame must never trigger a shutter.
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
      status.textContent = 'Karte in den Rahmen halten · Ecken werden gesucht';
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
    progress.value = observations;
    status.textContent =
      observations >= 2
        ? 'Kartenecken erkannt · bitte kurz ruhig halten'
        : 'Kartenumriss gefunden · Stabilität wird geprüft';
    if (observations >= 3) void captureCard();
  }

  async function startCamera(): Promise<void> {
    if (closed || busy) return;
    stopCamera();
    const generation = cameraGeneration;
    next.hidden = true;
    next.querySelector('span')!.textContent = 'Nächste Karte scannen';
    refreshReview();
    trigger.hidden = false;
    trigger.disabled = true;
    observations = 0;
    last = null;
    reliable = null;
    progress.value = 0;
    sampled = 0;
    stage.classList.remove('has-card-outline');
    polygon.removeAttribute('points');
    status.textContent = 'Kamera wird gestartet …';
    if (!navigator.mediaDevices?.getUserMedia) {
      recordBetaEvent('scan_result', 'scan', 'camera_unavailable', 'error');
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
      trigger.disabled = false;
      status.textContent = 'Kamera bereit · Karte in den Rahmen halten';
      frameId = requestAnimationFrame(inspectFrame);
    } catch (error) {
      if (closed || generation !== cameraGeneration) return;
      stopCamera();
      recordBetaEvent('scan_result', 'scan', 'camera_start_failed', 'error');
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
