import { execFileSync } from 'node:child_process';

const env={ ...process.env,VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-public-key',PLAYWRIGHT_PRODUCTION:'1' };
try {
  execFileSync('npm',['run','build'],{ env,stdio:'inherit' });
  execFileSync('npm',['run','test:e2e'],{ env,stdio:'inherit' });
} finally { execFileSync('npm',['run','build'],{ stdio:'inherit' }); }
