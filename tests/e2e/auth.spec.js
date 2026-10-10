import { test,expect } from '@playwright/test';

const user={ id:'f1bb0e7a-e1a1-437f-a28a-983b38c8e364',email:'uji@example.invalid',email_confirmed_at:'2026-10-10T00:00:00Z',aud:'authenticated',role:'authenticated' };
const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({ sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated' })).toString('base64url'),'fixture'].join('.');
const session={ access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user };

async function viewerRoute(page,role='admin',status='active') {
  await page.route('**/rest/v1/rpc/viewer_context',(route) => route.fulfill({ json:{ user_id:user.id,display_name:'Pengelola uji',status,verified:true,role } }));
}

test('registration validates inputs and sends only ordinary account metadata',async ({ page }) => {
  let sent;
  await page.route('**/auth/v1/signup**',(route) => { sent=route.request().postDataJSON(); return route.fulfill({ json:{ user:{ id:'f1bb0e7a-e1a1-437f-a28a-983b38c8e364',email:'uji@example.invalid' },session:null } }); });
  await page.goto('/register'); await page.getByRole('button',{ name:'Daftar',exact:true }).click();
  expect(sent).toBeUndefined();
  await page.getByLabel('Nama',{ exact:true }).fill('Pengelola uji'); await page.getByLabel('Email',{ exact:true }).fill('uji@example.invalid'); await page.getByLabel('Password',{ exact:true }).fill('Katasandi!123456'); await page.getByRole('checkbox').check();
  await page.getByRole('button',{ name:'Daftar',exact:true }).click();
  await expect(page.getByRole('heading',{ name:'Cek Email Kamu' })).toBeVisible();
  await expect(page.getByText('uji@example.invalid',{ exact:true })).toBeVisible();
  expect(sent.data).toEqual({ display_name:'Pengelola uji' }); expect(sent.data.role).toBeUndefined();
});

test('login failure, verification resend and password recovery give useful feedback',async ({ page }) => {
  await page.route('**/auth/v1/token**',(route) => route.fulfill({ status:400,json:{ message:'Invalid login credentials',code:'invalid_credentials' } }));
  await page.route('**/auth/v1/resend**',(route) => route.fulfill({ json:{} }));
  await page.route('**/auth/v1/recover**',(route) => route.fulfill({ json:{} }));
  await page.goto('/login'); await page.getByLabel('Email',{ exact:true }).fill('uji@example.invalid'); await page.getByLabel('Password',{ exact:true }).fill('Katasandi!123456');
  await page.getByRole('button',{ name:'Tampilkan' }).click(); await expect(page.getByLabel('Password',{ exact:true })).toHaveAttribute('type','text'); await page.getByRole('button',{ name:'Sembunyikan' }).click();
  await page.getByRole('button',{ name:'Masuk',exact:true }).click(); await expect(page.getByText('Email atau kata sandi tidak cocok.')).toBeVisible();
  await page.getByRole('link',{ name:'Lupa Password?' }).click(); await page.getByLabel('Email',{ exact:true }).fill('uji@example.invalid'); await page.getByRole('button',{ name:'Kirim Link',exact:true }).click(); await expect(page.getByText('Kalau email terdaftar, link pemulihan akan dikirim.')).toBeVisible();
  await page.goto('/auth/callback?error=expired'); await expect(page.getByRole('heading',{ name:'Link Tidak Berlaku' })).toBeVisible();
});

test('login establishes context and redirects by role without another click',async ({ page }) => {
  await viewerRoute(page,'super_admin');
  await page.route('**/auth/v1/token**',(route) => route.fulfill({ json:session }));
  await page.route('**/auth/v1/user',(route) => route.fulfill({ json:user }));
  await page.goto('/login');
  await page.getByLabel('Email',{ exact:true }).fill(user.email);
  await page.getByLabel('Password',{ exact:true }).fill('Katasandi!123456');
  await page.getByRole('button',{ name:'Masuk',exact:true }).click();
  await expect(page).toHaveURL(/\/superadmin$/);
  await expect(page.getByRole('heading',{ name:'Semua Kampanye' })).toBeVisible();
});

test('verification callback exchanges PKCE code once and redirects pending admin',async ({ page }) => {
  let exchanges=0;
  await viewerRoute(page,'admin','pending');
  await page.addInitScript(() => localStorage.setItem('sb-test-auth-token-code-verifier','test-code-verifier'));
  await page.route('**/auth/v1/token**',(route) => { exchanges++; return route.fulfill({ json:session }); });
  await page.route('**/auth/v1/user',(route) => route.fulfill({ json:user }));
  await page.goto('/auth/callback?code=verification-code');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Akun menunggu persetujuan.')).toBeVisible();
  expect(exchanges).toBe(1);
});

test('verification in another browser gives secure sign-in fallback',async ({ page }) => {
  await page.route('**/auth/v1/token**',(route) => route.fulfill({ status:400,json:{ message:'PKCE code verifier not found' } }));
  await page.goto('/auth/callback?code=verification-code');
  await expect(page.getByRole('heading',{ name:'Verifikasi Selesai' })).toBeVisible();
  await expect(page.getByRole('link',{ name:'Masuk' })).toBeVisible();
});
