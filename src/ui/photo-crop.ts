import { cardProjection, type Quad } from '../domain/photo-geometry';
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

/** Only this temporary, aligned copy goes to OCR; storage keeps the original. */
export async function alignPhoto(
  photo: Blob,
  signal: AbortSignal,
): Promise<Blob | undefined> {
  const image = new Image();
  const url = URL.createObjectURL(photo);
  try {
    image.src = url;
    await image.decode();
    if (signal.aborted) return;
    return await new Promise((resolve) => {
      const sheet = modal('Karte ausrichten');
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
      let points: Quad;
      let dragging = -1;
      let result: Blob | undefined;
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
        points = [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ];
        controls();
      }
      canvas.setAttribute(
        'aria-label',
        'Kartenecken im Foto; alternativ Ecke und Position über die Felder darunter einstellen',
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
          points[Number(corner.value)] = {
            x: Number(x.value) / 1000,
            y: Number(y.value) / 1000,
          };
          draw();
        });
      orientation.addEventListener('change', reset);
      const use = action(
        'Ausschnitt erkennen',
        () => {
          error.hidden = true;
          try {
            const project = cardProjection(points);
            const pixels = source
              .getContext('2d')!
              .getImageData(0, 0, source.width, source.height);
            const output = el('canvas');
            output.width = 630;
            output.height = 880;
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
            output.toBlob((blob) => {
              if (blob) {
                result = blob;
                sheet.close();
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
      sheet.body.append(
        message(
          'Drehe die Karte aufrecht. Ziehe die vier nummerierten Punkte auf ihre Ecken. Der untere Kartenrand muss vollständig im Rahmen liegen.',
        ),
        field('Ausrichtung', orientation),
        canvas,
        field('Ecke auswählen', corner),
        field('Position waagerecht', x),
        field('Position senkrecht', y),
        error,
      );
      sheet.footer.append(
        action('Zurück zum Foto', sheet.close, 'secondary'),
        use,
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
