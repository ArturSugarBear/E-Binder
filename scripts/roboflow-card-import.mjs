/**
 * Authorized, read-only Roboflow fork importer for RF-DETR card localization.
 *
 * Data and every image stay outside the public repository. Only 1 class,
 * "card", is exported. A card bounding box does NOT provide an exact
 * Pokemon print, language, set, number, or an image embedding.
 *
 * Usage: ROBOFLOW_API_KEY=... node scripts/roboflow-card-import.mjs \
 *   <workspace>/<project> /absolute/private/output [--limit=1000]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverProjects } from './roboflow-projects.mjs';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const PAGE_SIZE = 50;
const ALLOWED_CLASS = new Set([
  'card',
  'cards',
  'pokemon-card',
  'pokemon-cards',
  'trading-card',
  'trading-cards',
]);

export function normalizeCardBoxes(raw, width, height) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 16 ||
    height < 16
  )
    throw new Error('Missing valid image dimensions');
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.annotations)
      ? raw.annotations
      : Array.isArray(raw?.boxes)
        ? raw.boxes
        : null;
  if (!list)
    throw new Error('Unsupported Roboflow annotation schema; no boxes assumed');
  const boxes = [];
  for (const item of list) {
    const label = String(
      item.class ?? item.class_name ?? item.className ?? item.label ?? '',
    )
      .toLowerCase()
      .trim();
    // Do not silently turn name/number/energy region boxes into cards.
    if (!ALLOWED_CLASS.has(label)) continue;
    const b = item.box && typeof item.box === 'object' ? item.box : item;
    const x = Number(b.x),
      y = Number(b.y);
    const w = Number(b.width),
      h = Number(b.height);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0)
      throw new Error('Invalid card box');
    // Roboflow annotations use center coordinates in pixels. Small rounding
    // excursions at the image edge are clipped, not guessed into identities.
    let left = x - w / 2,
      top = y - h / 2;
    let right = x + w / 2,
      bottom = y + h / 2;
    if (left < -1 || top < -1 || right > width + 1 || bottom > height + 1)
      throw new Error('Card box lies outside image');
    left = Math.max(0, left);
    top = Math.max(0, top);
    right = Math.min(width, right);
    bottom = Math.min(height, bottom);
    if (right - left < 2 || bottom - top < 2)
      throw new Error('Card box is too small');
    boxes.push([left, top, right - left, bottom - top]);
  }
  return boxes;
}

export function stableSplit(hash) {
  if (!/^[0-9a-f]{64}$/.test(hash))
    throw new Error('Split requires an actual image SHA-256');
  const percentile = parseInt(hash.slice(0, 8), 16) / 4294967296;
  return percentile < 0.8 ? 'train' : percentile < 0.9 ? 'valid' : 'test';
}

export function imageKind(bytes) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return { ext: 'jpg', mime: 'image/jpeg' };
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  )
    return { ext: 'png', mime: 'image/png' };
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return { ext: 'webp', mime: 'image/webp' };
  throw new Error('Unknown or unsupported image bytes');
}

function privateOutput(directory) {
  if (!isAbsolute(directory))
    throw new Error('Use an absolute private output directory');
  const base = resolve(directory);
  const cwd = resolve(process.cwd());
  const r = relative(cwd, base);
  if (!r || (!r.startsWith('..' + sep) && r !== '..' && !isAbsolute(r)))
    throw new Error(
      'Refusing to write Roboflow images inside this public checkout',
    );
  return base;
}

function jsonResponse(response) {
  if (!response.ok)
    throw new Error(`Roboflow API returned HTTP ${response.status}`);
  return response.json();
}

async function rfRequest(path, key, body) {
  const url = new URL('https://api.roboflow.com/' + path);
  url.searchParams.set('api_key', key);
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  return jsonResponse(response);
}

function locateImageURL(source) {
  const object =
    source?.image && typeof source.image === 'object' ? source.image : source;
  for (const value of [
    object?.urls?.original,
    object?.original_url,
    object?.originalUrl,
    object?.url,
    source?.url,
    source?.image?.url,
  ]) {
    if (typeof value !== 'string') continue;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('Unexpected image URL');
    if (url.searchParams.has('api_key'))
      throw new Error('Media URL contains an API credential');
    return url.href;
  }
  throw new Error('Roboflow image details have no original media URL');
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Original image HTTP ${response.status}`);
  const len = Number(response.headers.get('content-length'));
  if (len > MAX_IMAGE_BYTES) throw new Error('Image exceeds the 12MB cap');
  const array = new Uint8Array(await response.arrayBuffer());
  if (!array.length || array.length > MAX_IMAGE_BYTES)
    throw new Error('Image size invalid');
  return Buffer.from(array);
}

export async function importFork(source, directory, limit) {
  const match = /^([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/.exec(source);
  if (!match) throw new Error('Source must be <workspace>/<project>');
  const key = process.env.ROBOFLOW_API_KEY;
  if (!key)
    throw new Error('ROBOFLOW_API_KEY is required; never commit an API key');
  if (!Number.isInteger(limit) || limit < 1 || limit > 2000)
    throw new Error('Limit must be 1–2000');
  const output = privateOutput(directory);
  let slug = match[2];
  if (slug === 'auto') {
    const projects = await discoverProjects(match[1], key);
    // Fork A was previously reported as ~430 source images. Never guess when
    // multiple candidates meet the range or source image counts changed.
    const candidates = projects.filter(
      (item) =>
        item.images !== null && item.images >= 300 && item.images <= 600,
    );
    if (candidates.length !== 1) {
      throw new Error(
        'Roboflow auto selection is ambiguous; run scripts/roboflow-projects.mjs and specify the exact project slug.',
      );
    }
    slug = candidates[0].project;
  }
  const root = `${match[1]}/${slug}`;
  // Finish authentication and schema discovery before creating output dirs.
  const project = await rfRequest(root, key);
  const license = project?.license ?? project?.project?.license ?? 'unknown';
  const records = [];
  for (let offset = 0; offset < limit; offset += PAGE_SIZE) {
    const data = await rfRequest(root + '/search', key, {
      offset,
      limit: Math.min(PAGE_SIZE, limit - offset),
      in_dataset: true,
      fields: [
        'id',
        'name',
        'annotations',
        'labels',
        'split',
        'url',
        'width',
        'height',
      ],
    });
    if (!Array.isArray(data.results))
      throw new Error('Invalid Roboflow search page');
    records.push(...data.results);
    if (data.results.length < Math.min(PAGE_SIZE, limit - offset)) break;
  }
  if (!records.length) throw new Error('Source project contains no images');
  const unique = new Set(records.map((row) => row.id));
  if (
    unique.size !== records.length ||
    records.some((row) => typeof row.id !== 'string')
  )
    throw new Error('Search returned duplicate or invalid image ids');
  const datasets = Object.fromEntries(
    ['train', 'valid', 'test'].map((split) => [
      split,
      {
        images: [],
        annotations: [],
        categories: [{ id: 1, name: 'card', supercategory: 'trading-card' }],
      },
    ]),
  );
  const provenance = [];
  const hashes = new Set();
  let annId = 0;
  let duplicates = 0;
  let missingCardBoxes = 0;
  let index = 0;
  await mkdir(output, { recursive: true, mode: 0o700 });
  for (const row of records) {
    const details = await rfRequest(
      root + '/images/' + encodeURIComponent(row.id),
      key,
    );
    const image =
      details.image && typeof details.image === 'object'
        ? details.image
        : details;
    const annotation =
      image.annotation ??
      image.annotations ??
      details.annotation ??
      details.annotations ??
      row.annotations;
    const width = Number(image.annotation?.width ?? image.width ?? row.width);
    const height = Number(
      image.annotation?.height ?? image.height ?? row.height,
    );
    const boxes = normalizeCardBoxes(annotation, width, height);
    if (!boxes.length) {
      missingCardBoxes++;
      continue;
    }
    const bytes = await download(locateImageURL(details));
    const kind = imageKind(bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hashes.has(hash)) {
      duplicates++;
      continue;
    }
    hashes.add(hash);
    const split = stableSplit(hash);
    const name = hash + '.' + kind.ext;
    await mkdir(join(output, split), { recursive: true, mode: 0o700 });
    await writeFile(join(output, split, name), bytes, {
      mode: 0o600,
      flag: 'wx',
    });
    const imageId = ++index;
    datasets[split].images.push({
      id: imageId,
      file_name: name,
      width,
      height,
    });
    for (const bbox of boxes) {
      datasets[split].annotations.push({
        id: ++annId,
        image_id: imageId,
        category_id: 1,
        bbox: bbox.map((n) => Number(n.toFixed(4))),
        area: Number((bbox[2] * bbox[3]).toFixed(4)),
        iscrowd: 0,
      });
    }
    provenance.push({
      imageId,
      roboflowImageId: row.id,
      sha256: hash,
      split,
      boxes: boxes.length,
    });
  }
  if (!index) throw new Error('No images with usable card boxes');
  for (const [split, dataset] of Object.entries(datasets)) {
    await mkdir(join(output, split), { recursive: true, mode: 0o700 });
    await writeFile(
      join(output, split, '_annotations.coco.json'),
      JSON.stringify(dataset, null, 2) + '\n',
      { mode: 0o600 },
    );
  }
  const report = {
    kind: 'roboflow-card-localization-only',
    source: root,
    declaredLicense: license,
    searchedImages: records.length,
    savedImages: index,
    exactByteDuplicates: duplicates,
    skippedWithoutCardBoxes: missingCardBoxes,
    detectedBoxes: annId,
    counts: Object.fromEntries(
      Object.entries(datasets).map(([split, data]) => [
        split,
        { images: data.images.length, boxes: data.annotations.length },
      ]),
    ),
    limitation:
      'Bounding boxes only. No exact card identity, language, finish, or validated image-level rights implied.',
  };
  await writeFile(
    join(output, 'private-provenance.json'),
    JSON.stringify({ ...report, provenance }, null, 2) + '\n',
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [project, output, limitArg] = process.argv.slice(2);
  if (!project || !output) {
    console.error(
      'Usage: ROBOFLOW_API_KEY=... node scripts/roboflow-card-import.mjs <workspace>/<project> /absolute/private/output [--limit=1000]',
    );
    process.exitCode = 2;
  } else {
    const limit = limitArg
      ? Number(/^--limit=(\d+)$/.exec(limitArg)?.[1])
      : 2000;
    await importFork(project, output, limit);
  }
}
