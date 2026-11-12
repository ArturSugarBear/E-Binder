import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error('Private beta retention requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const client = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let deleted = 0;
for (const [state, days] of [
  ['pending', 30],
  ['rejected', 30],
  ['accepted', 90],
]) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  for (let batch = 0; batch < 20; batch++) {
    const { data, error } = await client
      .from('beta_scan_samples')
      .select('id, object_path')
      .eq('review_status', state)
      .lt('created_at', cutoff)
      .limit(50);
    if (error) throw error;
    if (!data?.length) break;
    const paths = data.map((item) => item.object_path);
    const { error: storageError } = await client.storage
      .from('beta-scan-donations')
      .remove(paths);
    if (storageError) throw storageError;
    const { error: rowError } = await client
      .from('beta_scan_samples')
      .delete()
      .in('id', data.map((item) => item.id));
    if (rowError) throw rowError;
    deleted += data.length;
    if (data.length < 50) break;
  }
}
console.log('Private beta retention: ' + deleted + ' expired files and records removed.');
