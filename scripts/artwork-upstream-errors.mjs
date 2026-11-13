/**
 * Only verified transient TCGdex metadata HTTP responses may use the artwork
 * release gate's recent, clean, committed snapshot. Never allow local image
 * failures, invalid provider data, 4xx except 429, or other API hosts.
 */
const transientSetMetadata =
  /^Set metadata unavailable \((en|de):([a-z0-9.+_-]+)\): Error: (?:429|5[0-9]{2}): https:\/\/api\.tcgdex\.net\/v2\/\1\/sets\/\2$/i;
const transientCatalogList =
  /^Set catalogue unavailable \((en|de)\): Error: (?:429|5[0-9]{2}): https:\/\/api\.tcgdex\.net\/v2\/\1\/sets$/i;
const transientMepCardMetadata =
  /^Promo artwork audit failed: Error: (?:429|5[0-9]{2}): https:\/\/api\.tcgdex\.net\/v2\/en\/cards\/mep-[a-z0-9.+_-]+$/i;

export function isTransientArtworkUpstreamFailure(message) {
  return (
    typeof message === 'string' &&
    (transientSetMetadata.test(message) ||
      transientCatalogList.test(message) ||
      transientMepCardMetadata.test(message))
  );
}
