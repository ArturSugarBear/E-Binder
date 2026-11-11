/**
 * Public-source schema audit; no user collection data or credentials.
 * This is a build-tool exploration, never imported into the browser.
 */
const sources = {
  products:
    'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json',
  prices:
    'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json',
};
const load = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(80000) });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
};
const products = await load(sources.products);
console.log('products keys:', Object.keys(products));
console.log('product count:', products.products?.length);
console.log('sample:', JSON.stringify(products.products?.[0]));
const knownIds = new Set([918949,918876,918832,895886]);
console.log('verified-product-ids:', JSON.stringify(products.products?.filter((p) => knownIds.has(p.idProduct))));
console.log('possible Groudon products:', JSON.stringify(products.products?.filter((p) => /Groudon/i.test(p.name)).slice(-20)));
console.log('DLR set-marked products:', JSON.stringify(products.products?.filter((p) => /\[DLR\s*\d+/i.test(p.name)).slice(0,28)));
console.log('PBL set-marked products:', JSON.stringify(products.products?.filter((p) => /\[PBL\s*\d+/i.test(p.name)).slice(0,12)));

const interesting = products.products?.filter((p) =>
  /Delta Reign|Delta-Herrschaft|Pitch Black|Dunkelnacht|30 Years|30th|Nebel der Sagen|Shrouded Fable|Eternal Rivals|Destined Rivals/i.test(p.expansionName ?? ''),
) ?? [];
const matches = interesting.filter((p) =>
  (/^(0?53|106|111|113|124|140|088|089|090|101|109)$/i.test(String(p.number ?? ''))) ||
  /Groudon|Growlithe|Fukano|Slowbro|Greninja|Gardevoir/i.test(p.name ?? ''),
);
console.log('matching catalog rows:', interesting.length);
console.log('catalog examples:', JSON.stringify(matches.slice(0,35)));
const guide = await load(sources.prices);
console.log('price keys:', Object.keys(guide));
console.log('guide updated:', guide.createdAt);
console.log('guide count:', guide.priceGuides?.length);
const index = new Map(guide.priceGuides?.map((p) => [p.idProduct, p]));
console.log('matching priceguide rows:', JSON.stringify(matches.slice(0,18).map((p) => ({
  idProduct: p.idProduct, name: p.name, expansionName: p.expansionName, number: p.number,
  price: index.get(p.idProduct)
}))));
for (const id of ['me06-111', 'me06-106', 'me05-101']) {
  const response = await fetch(`https://api.tcgdex.net/v2/en/cards/${id}`, {
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) {
    console.log('TCGdex', id, 'unavailable', response.status);
    continue;
  }
  const card = await response.json();
  console.log('TCGdex', JSON.stringify({
    id: card.id, name: card.name, localId: card.localId,
    rarity: card.rarity, set: card.set?.name,
    cardmarket: card.pricing?.cardmarket
  }));
}
