/** Exact product joins only. No name search, adjacent print or stamp guessing. */
const numberKey = (value) =>
  String(value)
    .toUpperCase()
    .replace(/^0+(?=\d)/, '');
const nameKey = (value) =>
  value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'");
export const promoGroup = {
  categoryId: 3,
  groupId: 24451,
  abbreviation: 'MEP',
  name: 'ME: Mega Evolution Promo',
};
export const jumboGroup = { categoryId: 3, groupId: 1528, name: 'Jumbo Cards' };
export function validatePromoGroup(groups) {
  return (
    Array.isArray(groups) &&
    groups.filter(
      (group) =>
        group.groupId === promoGroup.groupId &&
        group.categoryId === promoGroup.categoryId &&
        group.abbreviation === promoGroup.abbreviation &&
        group.name === promoGroup.name,
    ).length === 1
  );
}
// Reviewed 2026-11-12 against each returned image's printed name, MEP set
// mark and number. TCGdex currently omits market product IDs for these cards.
// These mappings select preview artwork only, never prices or ownership.
const reviewedProducts = {
  'mep-055': 709969,
  'mep-056': 709970,
  'mep-057': 709971,
  'mep-058': 709972,
  'mep-059': 709973,
  'mep-060': 709974,
  'mep-061': 709975,
  'mep-062': 709976,
  'mep-063': 709977,
};
export function promoArtwork(card, products) {
  if (
    card.set?.id !== 'mep' ||
    card.id !== `mep-${card.localId}` ||
    typeof card.name !== 'string'
  )
    return;
  const ids = new Set(
    ['normal', 'holofoil'].flatMap((kind) => {
      const id = card.pricing?.tcgplayer?.[kind]?.productId;
      return Number.isSafeInteger(id) && id > 0 ? [id] : [];
    }),
  );
  for (const variant of card.variants_detailed ?? []) {
    if (variant.stamp?.length) continue;
    const id = variant.thirdParty?.tcgplayer;
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  }
  if (!ids.size && reviewedProducts[card.id])
    ids.add(reviewedProducts[card.id]);
  const candidates = products.filter((product) => {
    if (
      !ids.has(product.productId) ||
      product.categoryId !== promoGroup.categoryId
    )
      return false;
    const numbers =
      product.extendedData?.filter((field) => field.name === 'Number') ?? [];
    // TCGdex's explicit jumbo product mapping, not a numbered standard card.
    const museum =
      card.id === 'mep-Museum' &&
      product.productId === 678659 &&
      product.groupId === jumboGroup.groupId &&
      card.variants_detailed?.some(
        (variant) =>
          variant.size === 'jumbo' &&
          variant.thirdParty?.tcgplayer === product.productId,
      ) &&
      numbers.length === 0 &&
      product.name === 'Pikachu at the Museum';
    if (
      !museum &&
      (product.groupId !== promoGroup.groupId ||
        numbers.length !== 1 ||
        numberKey(numbers[0].value) !== numberKey(card.localId))
    )
      return false;
    const name = nameKey(product.name ?? '');
    const base = nameKey(card.name);
    // Qualifiers are accepted only after an authoritative product-ID join.
    if (
      name !== base &&
      !name.startsWith(`${base} - `) &&
      !name.startsWith(`${base} (`)
    )
      return false;
    // Use the provider-returned URL, never derive another card/size URL.
    return (
      product.imageUrl ===
      `https://tcgplayer-cdn.tcgplayer.com/product/${product.productId}_200w.jpg`
    );
  });
  if (candidates.length !== 1) return;
  const product = candidates[0];
  return {
    url: product.imageUrl,
    language: 'en',
    providerId: `tcgplayer:${product.productId}`,
  };
}
