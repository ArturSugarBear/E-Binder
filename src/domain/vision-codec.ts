/** PP-OCRv4 recognition input: RGB, CHW, normalised to [-1, 1]. */
export function recognitionTensor(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const count = width * height;
  if (!Number.isInteger(count) || count < 1 || pixels.length !== count * 4)
    throw new Error('Ungültige Bilddaten.');
  const result = new Float32Array(count * 3);
  for (let channel = 0; channel < 3; channel++)
    for (let pixel = 0; pixel < count; pixel++)
      result[channel * count + pixel] =
        (pixels[pixel * 4 + channel]! / 255 - 0.5) / 0.5;
  return result;
}
/** CTC removes repeated labels and blanks; blank-separated repeats stay distinct. */
export function decodeRecognition(
  data: Float32Array,
  dims: readonly number[],
  dictionary: readonly string[],
): string {
  const [batch, time, classes] = dims;
  if (
    batch !== 1 ||
    !time ||
    !classes ||
    data.length !== time * classes ||
    dictionary.length !== classes
  )
    throw new Error(
      'Das Erkennungsmodell und sein Wörterbuch passen nicht zusammen.',
    );
  let result = '',
    previous = -1;
  for (let step = 0; step < time; step++) {
    let best = 0;
    for (let index = 1; index < classes; index++)
      if (data[step * classes + index]! > data[step * classes + best]!)
        best = index;
    if (best && best !== previous) result += dictionary[best]!;
    previous = best;
  }
  return result;
}
