/**
 * Only verified transient TCGdex metadata HTTP responses may use the artwork
 * release gate's recent, clean, committed snapshot. Never allow local image
 * failures, invalid provider data, 4xx except 429, or other API hosts.
 */
const transientSetMetadata =
  /^Set metadata unavailable \((en|de):([a-z0-9.+_-]+)\): Error: (?:429|5[0-9]{2}): https:\/\/api\.tcgdex\.net\/v2\/\1\/sets\/\2$/i;
const transientMepCardMetadata =
  /^Promo artwork audit failed: Error: (?:429|5[0-9]{2}): https:\/\/api\.tcgdex\.net\/v2\/en\/cards\/mep-[a-z0-9.+_-]+$/i;

export function isTransientArtworkUpstreamFailure(message) {
  return (
    typeof message === 'string' &&
    (transientSetMetadata.test(message) ||
      transientMepCardMetadata.test(message))
  );
}

/**
 * The audit can fail before writing audit.json when the initial DE/EN set
 * listing is temporarily unavailable. Only the exact TCGdex list endpoint
 * and one unambiguous transient HTTP error are eligible for snapshot reuse.
 */
export function isTransientArtworkBootstrapFailure(stderr) {
  if (typeof stderr !== 'string') return false;
  const errors = stderr.match(/^Error: [^\r\n]+$/gm) ?? [];
  return (
    errors.length === 1 &&
    /^Error: (?:429|5[0-9]{2}): https:\/\/api\.tcgdex\.net\/v2\/(?:en|de)\/sets$/.test(
      errors[0],
    )
  );
}

/**
 * The Classic Collection cross-check requires its TCGdex set-detail record.
 * When that exact metadata request returns 429/5xx, the legacy card mapping
 * cannot be reverified, even if the committed index is still intact.
 * The release gate separately verifies every cached mapping and image.
 */
export function isTransientClassicCollectionDependency(message, errors) {
  return (
    message ===
      'Classic Collection artwork audit failed: Error: Classic Collection catalogue / mapping mismatch' &&
    Array.isArray(errors) &&
    errors.some(
      (error) =>
        typeof error === 'string' &&
        /^Set metadata unavailable \((?:en|de):30th-c\): Error: (?:429|5[0-9]{2}): https:\/\/api\.tcgdex\.net\/v2\/(?:en|de)\/sets\/30th-c$/i.test(
          error,
        ),
    )
  );
}
