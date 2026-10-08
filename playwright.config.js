import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'tests/e2e',
  timeout:30000,
  use:{ baseURL:'http://127.0.0.1:3000',viewport:{ width:390,height:844 },acceptDownloads:true },
  webServer:{ command:'npm run dev',url:'http://127.0.0.1:3000',reuseExistingServer:!process.env.CI,env:{ VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-public-key' } },
});
