import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'tests/e2e',
  timeout:30000,
  use:{ baseURL:'http://127.0.0.1:4174',viewport:{ width:390,height:844 },acceptDownloads:true },
  webServer:{ command:process.env.PLAYWRIGHT_PRODUCTION?'node scripts/static-preview.js':'npm exec vite -- --host 127.0.0.1 --port 4174 --strictPort',url:'http://127.0.0.1:4174',reuseExistingServer:false,env:{ VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-public-key' } },
});
