import { numberKey, normalize, type PersonalCard } from '../domain/personal';

const requests = new Map<
  string,
  { until: number; value: Promise<Record<string, unknown>> }
>();
async function json(url: string): Promise<Record<string, unknown>> {
  const cached = requests.get(url);
  let request = cached && cached.until > Date.now() ? cached.value : undefined;
  if (!request) {
    request = fetch(url, { signal: AbortSignal.timeout(12000) }).then(
      async (r) => {
        if (!r.ok) throw new Error(`Catalog ${r.status}`);
        return r.json();
      },
    );
    if (requests.size >= 500) requests.delete(requests.keys().next().value!);
    requests.set(url, { until: Date.now() + 300000, value: request });
    void request.catch(() => requests.delete(url));
  }
  return request;
}

/** TCGplayer's public product metadata must independently confirm the Japanese printing. */
export async function japanesePrinting(card: PersonalCard) {
  if (
    card.source !== 'tcgdex' ||
    (card.language !== 'ja' &&
      !/^(?:M1L|M1S)$/i.test(card.setId)) ||
    !card.sourceId.startsWith(`${card.setId}-`) ||
    numberKey(card.sourceId.slice(card.setId.length + 1)) !==
      numberKey(card.number).split('/')[0]
  )
    return;
  const raw = await json(
    `https://api.tcgdex.net/v2/ja/cards/${encodeURIComponent(card.sourceId)}`,
  );
  const set = raw.set as
    { id?: string; cardCount?: { official?: number } } | undefined;
  if (
    raw.id !== card.sourceId ||
    set?.id !== card.setId ||
    (card.number.includes('/')
      ? numberKey(`${raw.localId}/${set.cardCount?.official}`) !==
        numberKey(card.number)
      : numberKey(String(raw.localId)) !== numberKey(card.number))
  )
    return;
  const details = raw.variants_detailed as
    { thirdParty?: { tcgplayer?: number } }[] | undefined;
  const productIds = [
    ...new Set(
      [
        (raw.thirdParty as { tcgplayer?: number } | undefined)?.tcgplayer,
        ...(details ?? []).map((v) => v.thirdParty?.tcgplayer),
      ].filter((id): id is number => typeof id === 'number'),
    ),
  ];
  const productId = productIds.length === 1 ? productIds[0] : undefined;
  if (!Number.isSafeInteger(productId) || !productId || productId <= 0) return;
  const product = await json(
    `${import.meta.env?.BASE_URL ?? '/'}catalog-products/tcgplayer/${productId}.json`,
  );
  const attributes = product.customAttributes as
    { number?: string } | undefined;
  // Imported Japanese printings may carry a verified English display name
  // (e.g. Riolu) while TCGdex stores リオル. Accept that alias only when
  // independently present in the *same* TCGplayer product identity.
  const providerName = String(product.productName ?? '')
    .replace(/\s*-\s*\d+\s*\/\s*\d+.*$/, '')
    .trim();
  const nameMatches =
    raw.name === card.name ||
    (/^(?:M1L|M1S)$/i.test(card.setId) &&
      normalize(providerName) === normalize(card.name));
  if (
    !nameMatches ||
    product.productId !== productId ||
    product.productLineName !== 'Pokemon Japan' ||
    product.productTypeName !== 'Cards' ||
    product.sealed !== false ||
    typeof product.setCode !== 'string' ||
    product.setCode.toUpperCase() !== card.setId.toUpperCase() ||
    numberKey(attributes?.number ?? '') !==
      numberKey(`${raw.localId}/${set.cardCount?.official}`)
  )
    return;
  return { raw, product, productId };
}

/** A name equivalence is not a printing equivalence and is never used for artwork or pricing. */
export async function germanCardName(
  card: PersonalCard,
): Promise<string | undefined> {
  try {
    const verified = await japanesePrinting(card);
    if (!verified) return;
    const ids = verified.raw.dexId;
    if (!Array.isArray(ids) || ids.length !== 1 || !Number.isInteger(ids[0]))
      return;
    const title = String(verified.product.productName).replace(
      /\s*-\s*\d+\/\d+.*$/,
      '',
    );
    const response = await fetch(
      `https://api.tcgdex.net/v2/en/cards?dexId=eq:${ids[0]}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) return;
    const candidates = (await response.json()) as {
      id: string;
      name: string;
    }[];
    const matches = candidates
      .filter((c) => normalize(c.name) === normalize(title))
      .slice(0, 8);
    const names = await Promise.all(
      matches.map(async (c) => {
        const de = await json(
          `https://api.tcgdex.net/v2/de/cards/${encodeURIComponent(c.id)}`,
        ).catch(() => ({}) as Record<string, unknown>);
        if (
          de.id !== c.id ||
          JSON.stringify(de.dexId) !== JSON.stringify(ids) ||
          String(de.suffix).toLowerCase() !==
            String(verified.raw.suffix).toLowerCase() ||
          typeof de.name !== 'string'
        )
          return;
        return de.name;
      }),
    );
    const unique = [...new Set(names.filter((n): n is string => !!n))];
    return unique.length === 1 ? unique[0] : undefined;
  } catch {
    return;
  }
}
const names = new Map<string, Promise<string | undefined>>();
export function localizedCardName(card: PersonalCard): HTMLElement {
  const label = document.createElement('span');
  label.textContent = card.name;
  if (card.language !== 'ja') return label;
  const key = JSON.stringify([
    card.sourceId,
    card.setId,
    card.number,
    card.name,
  ]);
  if (!names.has(key)) names.set(key, germanCardName(card));
  void names.get(key)!.then((name) => {
    if (name) label.textContent = `${card.name} (${name})`;
    else names.delete(key); // retry after an outage, never cache a missing translation forever
  });
  return label;
}
