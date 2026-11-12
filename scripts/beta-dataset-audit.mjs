import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Dataset audit requires private SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets.');
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
if (counts.accepted < 200) {
  console.log('Training gate: BLOCKED, fewer than 200 independently reviewed samples.');
} else {
  console.log('Sample count gate reached; rights and benchmark checks are still mandatory.');
}
