import { suggestPageCorners } from '../domain/page-outline';
import { nextCardLock } from '../domain/live-card-lock';
import { action, el, errorText, modal } from './workspace-dom';

/** The same real-camera capture principle as single-card scanning, but sized
 * for a complete physical 3x3 sleeve. Only the user can import the results. */
export function openLivePageScanner(
  onCapture: (file: File) => void,
  onFallback: () => void,
): void {
  const sheet = modal('Binderseite live scannen', true);
  sheet.dialog.classList.add('w-live-scan-dialog w-live-page-dialog');
  const video = el('video', 'w-live-video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('aria-label', 'Live-Kamerabild der gesamten Binderseite');
  const guide = el('div', 'w-live-page-guide');
  guide.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 9; i++) guide.append(el('span', 'w-live-page-cell'));
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
  const stage = el(
    'div',
    'w-live-stage w-live-page-stage',
    video,
    guide,
    outline,
  );
  const status = el('p', 'w-live-status', 'Kamera wird gestartet …');
  status.setAttribute('role', 'status');
  const progress = el('progress', 'w-progress w-live-progress');
  progress.max = 3;
  progress.value = 0;
  progress.setAttribute('aria-label', 'Stabile Binderseiten-Ausrichtung');
  const help = el(
    'p',
    'w-muted w-live-help',
    'Halte die gesamte 3×3-Binderseite samt Rand im Rahmen. Vermeide Reflexionen. Bei erkannten stabilen Seitenrändern wird automatisch fotografiert; du kannst jederzeit selbst auslösen. Die neun Karten werden erst anschließend einzeln geprüft.',
  );
  const shutter = action(
    'Seite jetzt aufnehmen',
    () => void capture(),
    'primary',
    'camera',
  );
  shutter.disabled = true;
  const retry = action(
    'Kamera wieder starten',
    () => void start(),
    'secondary',
    'camera',
  );
  retry.hidden = true;
  const fallback = action(
    'Stattdessen Foto auswählen',
    () => {
      sheet.close();
      onFallback();
    },
    'secondary',
    'upload',
  );
  sheet.body.append(stage, progress, help);
  sheet.footer.append(status, shutter, retry, fallback);

  let closed = false;
  let busy = false;
  let active: MediaStream | null = null;
  let generation = 0;
  let animation = 0;
  let sampled = 0;
  let last: ReturnType<typeof suggestPageCorners> = null;
  let observations = 0;
  const sample = document.createElement('canvas');
  sample.width = 192;
  sample.height = 256;

  function stop(): void {
    generation++;
    cancelAnimationFrame(animation);
    active?.getTracks().forEach((track) => track.stop());
    active = null;
    video.srcObject = null;
    shutter.disabled = true;
  }
  function drawVisible(canvas: HTMLCanvasElement): void {
    const targetRatio = canvas.width / canvas.height;
    const sourceRatio = video.videoWidth / video.videoHeight;
    const cropWidth =
      sourceRatio > targetRatio
        ? video.videoHeight * targetRatio
        : video.videoWidth;
    const cropHeight =
      sourceRatio > targetRatio
        ? video.videoHeight
        : video.videoWidth / targetRatio;
    canvas
      .getContext('2d', { willReadFrequently: true })!
      .drawImage(
        video,
        (video.videoWidth - cropWidth) / 2,
        (video.videoHeight - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
  }
  async function capture(): Promise<void> {
    if (closed || busy || !active || !video.videoWidth || !video.videoHeight)
      return;
    busy = true;
    shutter.disabled = true;
    status.textContent = 'Binderseite wird fotografiert …';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      drawVisible(canvas);
      const photo = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error('Kamerafoto konnte nicht erstellt werden.')),
          'image/jpeg',
          0.94,
        ),
      );
      if (closed) return;
      stop();
      sheet.close();
      onCapture(
        new File([photo], `Binderseite-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        }),
      );
    } catch (error) {
      if (!closed) {
        stop();
        status.textContent = `Foto fehlgeschlagen: ${errorText(error)}`;
        retry.hidden = false;
      }
    } finally {
      busy = false;
    }
  }
  function inspectFrame(time: number): void {
    if (closed || !active) return;
    animation = requestAnimationFrame(inspectFrame);
    if (document.hidden || time - sampled < 300 || video.readyState < 2) return;
    sampled = time;
    let corners: ReturnType<typeof suggestPageCorners> = null;
    try {
      drawVisible(sample);
      const pixels = sample
        .getContext('2d', { willReadFrequently: true })!
        .getImageData(0, 0, sample.width, sample.height);
      corners = suggestPageCorners(pixels.data, sample.width, sample.height);
    } catch {
      // Missing frame must not automatically trigger a photo.
    }
    const lock = nextCardLock(
      { corners: last, stableFrames: observations },
      corners,
      sample.width,
      sample.height,
    );
    if (!lock.corners) {
      last = null;
      observations = 0;
      progress.value = 0;
      polygon.removeAttribute('points');
      stage.classList.remove('has-card-outline');
      status.textContent = 'Gesamte Binderseite im Rahmen ausrichten';
      return;
    }
    last = lock.corners;
    observations = lock.stableFrames;
    progress.value = observations;
    stage.classList.add('has-card-outline');
    polygon.setAttribute(
      'points',
      lock.corners
        .map((corner) => `${corner.x * 100},${corner.y * 100}`)
        .join(' '),
    );
    status.textContent =
      observations >= 2
        ? 'Seitenränder erkannt · ruhig halten'
        : 'Binderseite erkannt · Ausrichtung prüfen';
    if (observations >= 3) void capture();
  }
  async function start(): Promise<void> {
    if (closed || busy) return;
    stop();
    const current = generation;
    retry.hidden = true;
    progress.value = 0;
    observations = 0;
    last = null;
    sampled = 0;
    stage.classList.remove('has-card-outline');
    polygon.removeAttribute('points');
    status.textContent = 'Kamera wird gestartet …';
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent =
        'Live-Kamera nicht verfügbar. Wähle stattdessen ein Kamerafoto.';
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
      if (closed || current !== generation || document.hidden) {
        opened.getTracks().forEach((track) => track.stop());
        return;
      }
      active = opened;
      video.srcObject = opened;
      await video.play();
      if (closed || current !== generation || document.hidden) {
        stop();
        return;
      }
      shutter.disabled = false;
      status.textContent = 'Kamera bereit · gesamte 3×3-Seite ausrichten';
      animation = requestAnimationFrame(inspectFrame);
    } catch (error) {
      if (closed || current !== generation) return;
      stop();
      status.textContent = `Kamera nicht verfügbar: ${errorText(error)}`;
      retry.hidden = false;
    }
  }
  const backgrounded = () => {
    if (!document.hidden) return;
    stop();
    if (!closed) {
      status.textContent =
        'Kamera pausiert. Starte sie erneut oder wähle ein Foto.';
      retry.hidden = false;
    }
  };
  document.addEventListener('visibilitychange', backgrounded);
  sheet.onClose(() => {
    closed = true;
    stop();
    document.removeEventListener('visibilitychange', backgrounded);
  });
  void start();
}
