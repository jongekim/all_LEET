import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  const userId = requiredEnv('USER_ID');
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const inPath = path.resolve(process.cwd(), 'supabase/seed/example-history.json');
  if (!fs.existsSync(inPath)) {
    throw new Error(`Seed file not found: ${inPath}. Run: npm run gen:example-history`);
  }

  const raw = fs.readFileSync(inPath, 'utf8');
  const value = JSON.parse(raw);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const key = `history:${userId}`;
  const { error } = await supabase.from('kv_store_cd835c22').upsert({ key, value });
  if (error) throw new Error(error.message);

  console.log(`Upserted ${Array.isArray(value) ? value.length : 0} records into kv_store_cd835c22 for key=${key}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
