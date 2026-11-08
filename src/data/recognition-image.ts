/** Local OCR inputs only. Original photos are never overwritten. */
export function footerVariants(
  source: ImageBitmap,
  region: 'footer' | 'title' | 'identifier' = 'footer',
): HTMLCanvasElement[] {
  const footer = region === 'footer';
  const identifier = region === 'identifier';
  const left = source.width * (identifier ? 0.055 : 0.025);
  const top = source.height * (identifier ? 0.937 : footer ? 0.865 : 0.015);
  const width = source.width * (identifier ? 0.44 : footer ? 0.95 : 0.76);
  const height = source.height * (identifier ? 0.045 : footer ? 0.13 : 0.11);
  const scale = Math.min(8, (identifier ? 1200 : 2000) / width);
  const padding = 24;
  const raw = document.createElement('canvas');
  raw.width = Math.round(width * scale) + padding * 2;
  raw.height = Math.round(height * scale) + padding * 2;
  const context = raw.getContext('2d', { willReadFrequently: true });
  if (!context)
    throw new Error(
      'Bildvorverarbeitung wird in diesem Browser nicht unterstützt.',
    );
  context.fillStyle = '#fff';
  context.fillRect(0, 0, raw.width, raw.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source,
    left,
    top,
    width,
    height,
    padding,
    padding,
    raw.width - padding * 2,
    raw.height - padding * 2,
  );
  const pixels = context.getImageData(0, 0, raw.width, raw.height);
  const gray = new Uint8Array(raw.width * raw.height);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    const value = Math.round(
      0.299 * pixels.data[p]! +
        0.587 * pixels.data[p + 1]! +
        0.114 * pixels.data[p + 2]!,
    );
    gray[i] = value;
    histogram[value] = histogram[value]! + 1;
  }
  let weighted = 0;
  for (let i = 0; i < 256; i++) weighted += i * histogram[i]!;
  let below = 0,
    sum = 0,
    best = -1,
    threshold = 128;
  for (let i = 0; i < 256; i++) {
    below += histogram[i]!;
    if (!below) continue;
    const above = gray.length - below;
    if (!above) break;
    sum += i * histogram[i]!;
    const difference = sum / below - (weighted - sum) / above;
    const variance = below * above * difference * difference;
    if (variance > best) {
      best = variance;
      threshold = i;
    }
  }
  const integral = new Float64Array((raw.width + 1) * (raw.height + 1));
  const stride = raw.width + 1;
  for (let y = 0; y < raw.height; y++) {
    let row = 0;
    for (let x = 0; x < raw.width; x++) {
      row += gray[y * raw.width + x]!;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1]! + row;
    }
  }
  const variant = (
    mode: 'contrast' | 'threshold' | 'adaptive' | 'inverted',
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = raw.width;
    canvas.height = raw.height;
    const target = canvas.getContext('2d')!;
    const output = target.createImageData(raw.width, raw.height);
    for (let y = 0; y < raw.height; y++)
      for (let x = 0; x < raw.width; x++) {
        const index = y * raw.width + x;
        const value = gray[index]!;
        let result: number;
        if (mode === 'contrast' || mode === 'inverted') {
          result = Math.max(0, Math.min(255, (value - 128) * 1.8 + 128));
          if (mode === 'inverted') result = 255 - result;
        } else if (mode === 'threshold') result = value > threshold ? 255 : 0;
        else {
          const radius = 20;
          const x1 = Math.max(0, x - radius),
            y1 = Math.max(0, y - radius),
            x2 = Math.min(raw.width, x + radius + 1),
            y2 = Math.min(raw.height, y + radius + 1);
          const mean =
            (integral[y2 * stride + x2]! -
              integral[y1 * stride + x2]! -
              integral[y2 * stride + x1]! +
              integral[y1 * stride + x1]!) /
            ((x2 - x1) * (y2 - y1));
          result = value > mean - 12 ? 255 : 0;
        }
        const p = index * 4;
        output.data[p] = result;
        output.data[p + 1] = result;
        output.data[p + 2] = result;
        output.data[p + 3] = 255;
      }
    target.putImageData(output, 0, 0);
    return canvas;
  };
  if (identifier)
    return [
      raw,
      variant('contrast'),
      variant('inverted'),
      variant('threshold'),
      variant('adaptive'),
    ];
  return footer
    ? [raw, variant('contrast'), variant('threshold'), variant('adaptive')]
    : [raw];
}
