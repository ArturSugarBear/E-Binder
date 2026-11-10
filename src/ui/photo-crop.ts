import { cardProjection, type Quad } from '../domain/photo-geometry';
import { suggestPageCorners } from '../domain/page-outline';
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

/** Only a temporary aligned copy goes to OCR; no photo is persisted. */
export async function alignPhoto(
  photo: Blob,
  signal: AbortSignal,
  mode: 'card' | 'page' = 'card',
): Promise<Blob | undefined> {
  const image = new Image();
  const url = URL.createObjectURL(photo);
  try {
    image.src = url;
    await image.decode();
    if (signal.aborted) return;
    return await new Promise((resolve) => {
      const sheet = modal(
        mode === 'page' ? 'Binderseite ausrichten' : 'Karte ausrichten',
      );
      sheet.dialog.classList.add('w-crop-dialog');
      const canvas = el('canvas', 'w-crop-canvas');
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim();
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      const orientation = select(
        [
          ['0', 'Aufrecht'],
          ['1', '90° nach rechts'],
          ['2', '180° drehen'],
          ['3', '90° nach links'],
        ],
        '0',
      );
      const corner = select(
        [
          ['0', 'Oben links'],
          ['1', 'Oben rechts'],
          ['2', 'Unten rechts'],
          ['3', 'Unten links'],
        ],
        '0',
      );
      const x = input('range'),
        y = input('range');
      for (const slider of [x, y]) {
        slider.min = '0';
        slider.max = '1000';
        slider.step = '1';
      }
      const error = message('', 'error');
      error.hidden = true;
      const geometryHint = el('p', 'w-muted');
      geometryHint.hidden = mode !== 'page';
      let points: Quad;
      let dragging = -1;
      let result: Blob | undefined;
      let prepared: Blob | undefined;
      let revision = 0;
      const review = el('section', 'w-crop-review');
      review.hidden = true;
      review.tabIndex = -1;
      const source = el('canvas');
      function draw(): void {
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        context.strokeStyle = accent;
        context.lineWidth = 3;
        context.beginPath();
        points.forEach((p, i) => {
          if (i) context.lineTo(p.x * canvas.width, p.y * canvas.height);
          else context.moveTo(p.x * canvas.width, p.y * canvas.height);
        });
        context.closePath();
        context.stroke();
        points.forEach((p, i) => {
          context.beginPath();
          context.arc(
            p.x * canvas.width,
            p.y * canvas.height,
            12,
            0,
            Math.PI * 2,
          );
          context.fillStyle = i === Number(corner.value) ? accent : '#02070a';
          context.fill();
          context.stroke();
          context.fillStyle =
            i === Number(corner.value) ? '#02070a' : '#f2f6fa';
          context.font = 'bold 14px sans-serif';
          context.textAlign = 'center';
          context.fillText(
            String(i + 1),
            p.x * canvas.width,
            p.y * canvas.height + 5,
          );
        });
      }
      function controls(): void {
        const p = points[Number(corner.value)]!;
        x.value = String(p.x * 1000);
        y.value = String(p.y * 1000);
        draw();
      }
      function invalidate(): void {
        revision++;
        prepared = undefined;
        review.hidden = true;
        start.hidden = true;
        editor.hidden = false;
        use.hidden = false;
        use.disabled = false;
      }
      function reset(): void {
        const rotation = Number(orientation.value);
        const width = rotation % 2 ? image.naturalHeight : image.naturalWidth;
        const height = rotation % 2 ? image.naturalWidth : image.naturalHeight;
        const scale = Math.min(1, 2000 / Math.max(width, height));
        source.width = Math.round(width * scale);
        source.height = Math.round(height * scale);
        const ctx = source.getContext('2d')!;
        ctx.translate(source.width / 2, source.height / 2);
        ctx.rotate((rotation * Math.PI) / 2);
        ctx.drawImage(
          image,
          (-image.naturalWidth * scale) / 2,
          (-image.naturalHeight * scale) / 2,
          image.naturalWidth * scale,
          image.naturalHeight * scale,
        );
        canvas.width = Math.round(400 * Math.min(1, width / height));
        canvas.height = Math.round(400 * Math.min(1, height / width));
        let proposed: Quad | null = null;
        if (mode === 'page') {
          // The detector sees a small temporary image, never the full photo.
          const small = document.createElement('canvas');
          const reduction = Math.min(
            1,
            256 / Math.max(source.width, source.height),
          );
          small.width = Math.max(48, Math.round(source.width * reduction));
          small.height = Math.max(48, Math.round(source.height * reduction));
          const smallContext = small.getContext('2d', {
            willReadFrequently: true,
          });
          if (smallContext) {
            smallContext.drawImage(source, 0, 0, small.width, small.height);
            proposed = suggestPageCorners(
              smallContext.getImageData(0, 0, small.width, small.height).data,
              small.width,
              small.height,
            );
          }
          geometryHint.textContent = proposed
            ? 'Ecken automatisch vorgeschlagen. Kontrolliere alle neun Fächer und korrigiere die Punkte bei Bedarf.'
            : 'Außenkante nicht eindeutig erkannt. Verschiebe die vier Punkte manuell an die Binderseiten-Ecken.';
        }
        points = proposed ?? [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ];
        invalidate();
        controls();
      }
      canvas.setAttribute(
        'aria-label',
        mode === 'page'
          ? 'Binderseiten-Ecken im Foto; alternativ Position über die Felder einstellen'
          : 'Kartenecken im Foto; alternativ Ecke und Position über die Felder darunter einstellen',
      );
      function pointer(event: PointerEvent): void {
        const bounds = canvas.getBoundingClientRect();
        const p = {
          x: Math.max(
            0,
            Math.min(1, (event.clientX - bounds.left) / bounds.width),
          ),
          y: Math.max(
            0,
            Math.min(1, (event.clientY - bounds.top) / bounds.height),
          ),
        };
        if (event.type === 'pointerdown') {
          dragging = points
            .map((v, i) => ({ i, distance: Math.hypot(v.x - p.x, v.y - p.y) }))
            .sort((a, b) => a.distance - b.distance)[0]!.i;
          canvas.setPointerCapture(event.pointerId);
          corner.value = String(dragging);
        }
        if (dragging < 0) return;
        points[dragging] = p;
        if (mode === 'page')
          geometryHint.textContent = 'Ecken manuell angepasst. Prüfe die neun Fächer in der Vorschau.';
        invalidate();
        controls();
      }
      canvas.addEventListener('pointerdown', pointer);
      canvas.addEventListener('pointermove', pointer);
      canvas.addEventListener('pointerup', () => {
        dragging = -1;
      });
      canvas.addEventListener('pointercancel', () => {
        dragging = -1;
      });
      corner.addEventListener('change', controls);
      for (const slider of [x, y])
        slider.addEventListener('input', () => {
          invalidate();
          points[Number(corner.value)] = {
            x: Number(x.value) / 1000,
            y: Number(y.value) / 1000,
          };
          if (mode === 'page')
            geometryHint.textContent = 'Ecken manuell angepasst. Prüfe die neun Fächer in der Vorschau.';
          draw();
        });
      orientation.addEventListener('change', reset);
      const use = action(
        'Ausschnitt prüfen',
        () => {
          error.hidden = true;
          try {
            const project = cardProjection(points);
            const pixels = source
              .getContext('2d')!
              .getImageData(0, 0, source.width, source.height);
            const output = el('canvas');
            output.width = mode === 'page' ? 1260 : 630;
            output.height = mode === 'page' ? 1760 : 880;
            const out = output.getContext('2d')!;
            const aligned = out.createImageData(output.width, output.height);
            for (let row = 0; row < output.height; row++)
              for (let col = 0; col < output.width; col++) {
                const p = project(
                  col / (output.width - 1),
                  row / (output.height - 1),
                );
                const sx = Math.max(
                  0,
                  Math.min(source.width - 1, p.x * (source.width - 1)),
                );
                const sy = Math.max(
                  0,
                  Math.min(source.height - 1, p.y * (source.height - 1)),
                );
                const left = Math.floor(sx),
                  top = Math.floor(sy),
                  fx = sx - left,
                  fy = sy - top;
                const dest = (row * output.width + col) * 4;
                for (let channel = 0; channel < 3; channel++) {
                  const at = (xx: number, yy: number) =>
                    pixels.data[(yy * source.width + xx) * 4 + channel]!;
                  const right = Math.min(left + 1, source.width - 1),
                    bottom = Math.min(top + 1, source.height - 1);
                  aligned.data[dest + channel] =
                    at(left, top) * (1 - fx) * (1 - fy) +
                    at(right, top) * fx * (1 - fy) +
                    at(left, bottom) * (1 - fx) * fy +
                    at(right, bottom) * fx * fy;
                }
                aligned.data[dest + 3] = 255;
              }
            out.putImageData(aligned, 0, 0);
            use.disabled = true;
            const version = revision;
            output.toBlob((blob) => {
              if (version !== revision || !sheet.dialog.open || signal.aborted)
                return;
              if (blob) {
                prepared = blob;
                const left = el('canvas', 'w-crop-footer-preview');
                const right = el('canvas', 'w-crop-footer-preview');
                for (const strip of [left, right]) {
                  strip.width = 378;
                  strip.height = 132;
                }
                left.setAttribute(
                  'aria-label',
                  'Vergrößerter unterer Kartenrand links',
                );
                right.setAttribute(
                  'aria-label',
                  'Vergrößerter unterer Kartenrand rechts',
                );
                left
                  .getContext('2d')!
                  .drawImage(output, 0, 748, 378, 132, 0, 0, 378, 132);
                right
                  .getContext('2d')!
                  .drawImage(output, 252, 748, 378, 132, 0, 0, 378, 132);
                output.className = 'w-crop-card-preview';
                const preview =
                  mode === 'page'
                    ? el('div', 'w-page-crop-preview', output)
                    : output;
                if (mode === 'page') {
                  const guides = el('div', 'w-page-crop-guides');
                  guides.setAttribute('aria-hidden', 'true');
                  for (let slot = 0; slot < 9; slot++)
                    guides.append(
                      el('span', '', String(slot + 1).padStart(2, '0')),
                    );
                  preview.append(guides);
                }
                output.setAttribute(
                  'aria-label',
                  'Der ausgerichtete Ausschnitt für die Erkennung',
                );
                review.replaceChildren(
                  el(
                    'h3',
                    '',
                    mode === 'page'
                      ? 'So wird deine Binderseite gelesen'
                      : 'So wird deine Karte gelesen',
                  ),
                  message(
                    mode === 'page'
                      ? 'Der Ausschnitt soll genau die komplette 3×3-Seite umfassen, ohne die Buchringe. Prüfe, ob alle neun Karten vollständig sichtbar sind. Starke Reflexionen und unleserliche Nummern erfordern eine neue Aufnahme.'
                      : 'Siehst du nur die gedruckte Karte? Kunststoffrand, Etikett und Hintergrund gehören außerhalb des Ausschnitts. Prüfe besonders Name und Sammlernummer. Wenn sie verschwommen oder von Reflexionen verdeckt sind, hilft eine neue Aufnahme.',
                  ),
                  preview,
                  ...(mode === 'page'
                    ? []
                    : [
                        el('h4', '', 'Unterer Kartenrand, vergrößert'),
                        left,
                        right,
                      ]),
                  action(
                    'Ecken nachbessern',
                    () => {
                      invalidate();
                      canvas.scrollIntoView({ block: 'center' });
                      corner.focus({ preventScroll: true });
                    },
                    'secondary',
                  ),
                );
                editor.hidden = true;
                use.hidden = true;
                start.hidden = false;
                review.hidden = false;
                review.focus({ preventScroll: true });
                review.scrollIntoView({ block: 'start' });
              } else {
                error.textContent =
                  'Der Ausschnitt konnte nicht erstellt werden.';
                error.hidden = false;
                use.disabled = false;
              }
            }, 'image/png');
          } catch (failure) {
            error.textContent = errorText(failure);
            error.hidden = false;
          }
        },
        'primary',
      );
      const start = action(
        mode === 'page' ? 'Neun Fächer auswerten' : 'Texterkennung starten',
        () => {
          if (!prepared || signal.aborted) return;
          result = prepared;
          sheet.close();
        },
        'primary',
      );
      start.hidden = true;
      const editor = el(
        'div',
        'w-crop-editor',
        message(
          mode === 'page'
            ? 'Richte die ganze Binderseite aufrecht aus. Ziehe die vier Punkte auf ihre äußeren Ecken (ohne Buchringe). Alle neun Karten müssen innerhalb der Markierung liegen.'
            : 'Drehe die Karte aufrecht. Ziehe die vier nummerierten Punkte genau auf die Ecken der gedruckten Karte – nicht auf die Schutzhülle. Name und unterer Kartenrand müssen vollständig innerhalb der Punkte liegen.',
        ),
        field('Ausrichtung', orientation),
        geometryHint,
        canvas,
        field('Ecke auswählen', corner),
        field('Position waagerecht', x),
        field('Position senkrecht', y),
        error,
      );
      sheet.body.append(editor, review);
      sheet.footer.append(
        action('Zurück zum Foto', sheet.close, 'secondary'),
        use,
        start,
      );
      const abort = () => sheet.close();
      signal.addEventListener('abort', abort, { once: true });
      sheet.onClose(() => {
        signal.removeEventListener('abort', abort);
        resolve(result);
      });
      reset();
    });
  } catch {
    throw new Error(
      'Dieses Bildformat konnte der Browser nicht öffnen. Nutze ein JPG, PNG oder WebP. Die Aufnahme bleibt bis zum Schließen geöffnet.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
