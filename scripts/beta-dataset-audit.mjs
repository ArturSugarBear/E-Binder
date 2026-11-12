import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    'Dataset audit requires private SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets.',
  );
  process.exit(1);
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const states = ['pending', 'accepted', 'rejected'];
const counts = Object.fromEntries(
  await Promise.all(
    states.map(async (state) => {
      const { count, error } = await client
        .from('beta_scan_samples')
        .select('id', { count: 'exact', head: true })
        .eq('review_status', state);
      if (error) throw error;
      return [state, count ?? 0];
    }),
  ),
);
const markdown = [
  '## Private beta dataset audit',
  '',
  '| Stage | Images |',
  '| --- | ---: |',
  ...states.map((state) => '| ' + state + ' | ' + counts[state] + ' |'),
  '',
  'No photos, account identifiers, OCR transcripts or private object paths are exported.',
  'Pending samples are never eligible for automatic model training.',
  'Reviewed samples still require rights checks and a sealed hold-out.',
  '',
].join('\n');
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
}
const { data: consents, error: consentError } = await client
  .from('beta_scan_consents')
  .select('user_id')
  .eq('enabled', true)
  .eq('consent_version', '2026-11-photo-v1');
if (consentError) throw new Error('Current consent cannot be verified');
let eligible = 0;
if (consents.length) {
  const { count, error } = await client
    .from('beta_scan_samples')
    .select('id', { count: 'exact', head: true })
    .eq('review_status', 'accepted')
    .eq('human_verified', true)
    .eq('review_method', 'human-visual-catalog')
    .in(
      'user_id',
      consents.map((c) => c.user_id),
    );
  if (error) throw new Error('Human review eligibility cannot be verified');
  eligible = count ?? 0;
}
console.log(
  `Human-verified, currently consented samples: ${eligible}. Pending and assisted labels are excluded from training.`,
);
if (eligible < 200)
  console.log(
    'Training gate: BLOCKED, fewer than 200 independently human-reviewed and currently consented samples.',
  );
else
  console.log(
    'Count gate reached; rights, sealed hold-out, and benchmark gates still block automatic training.',
  );
