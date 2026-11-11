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

const independent = await load('https://raw.githubusercontent.com/ZyzyThePizi/pokemon-price-data/main/catalog/pokellector_en.json');
console.log('independent mapping keys:', Object.keys(independent));
console.log('mapping set fields:', JSON.stringify(independent.setFields));
console.log('mapping card fields:', JSON.stringify(independent.cardFields));
const relevantSets = (independent.sets ?? []).filter((set) =>
  JSON.stringify(set).match(/Delta.Reign|Pitch.Black|Dusk.Raid|30.Years|Shrouded.Fable/i),
);
console.log('independent sets:', JSON.stringify(relevantSets.slice(0,12)));
for (const set of relevantSets.slice(0,10)) {
  const cards = independent.cards?.[set[0]] ?? [];
  console.log('mapping relevant', set[0], cards.length,
    JSON.stringify(cards.filter((card) => /^(0?53|088|090|101|106|111|113|124|140)$/i.test(String(card[0]))).slice(0,20)));
}

for (const [expansionId, slug] of [[6704,'Delta-Reign-Expansion'],[6569,'Pitch-Black-Expansion']]) {
  const market = products.products.filter((p)=>p.idExpansion===expansionId)
    .sort((a,b)=>a.idProduct-b.idProduct);
  const local = independent.cards?.[slug]??[];
  const simplify = v => String(v).toLowerCase().split('[')[0].replace(/[^a-z0-9]/g,'');
  const matches = Math.min(market.length,local.length);
  const aligned = Array.from({length:matches},(_,i)=>simplify(market[i]?.name)===simplify(local[i]?.[1])).filter(Boolean).length;
  console.log('EXPANSION',expansionId,slug,'market',market.length,'local',local.length,'indexNameAgree',aligned,'of',matches);
  console.log('START SAMPLE',JSON.stringify(Array.from({length:14},(_,i)=>({i:i+1,marketId:market[i]?.idProduct,mName:market[i]?.name,n:local[i]?.[0],lName:local[i]?.[1],match:simplify(market[i]?.name)===simplify(local[i]?.[1])}))));
  console.log('SECRET SAMPLE',JSON.stringify(Array.from({length:18},(_,i)=>{let index=93+i;return {i:index+1,marketId:market[index]?.idProduct,mName:market[index]?.name,n:local[index]?.[0],lName:local[index]?.[1]};})));
}
