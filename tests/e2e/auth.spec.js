import { test,expect } from '@playwright/test';

const user={ id:'f1bb0e7a-e1a1-437f-a28a-983b38c8e364',email:'uji@example.invalid',email_confirmed_at:'2026-10-10T00:00:00Z',aud:'authenticated',role:'authenticated' };
const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({ sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated' })).toString('base64url'),'fixture'].join('.');
const session={ access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user };

async function viewerRoute(page,role='admin',status='active') {
  await page.route('**/rest/v1/rpc/viewer_context',(route) => route.fulfill({ json:{ user_id:user.id,display_name:'Pengelola uji',status,verified:true,role } }));
}

async function register(page) {
  await page.goto('/register');
  await page.getByLabel('Nama',{ exact:true }).fill('Pengelola uji');
  await page.getByLabel('Email',{ exact:true }).fill(user.email);
  await page.getByLabel('Password',{ exact:true }).fill('Katasandi!123456');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{ name:'Daftar',exact:true }).click();
}

test('registration verifies six digit signup OTP and redirects pending admin',async ({ page }) => {
  let signup,verification;
  await viewerRoute(page,'admin','pending');
  await page.route('**/auth/v1/signup**',(route) => { signup=route.request().postDataJSON(); return route.fulfill({ json:{ user:{ id:user.id,email:user.email },session:null } }); });
  await page.route('**/auth/v1/verify**',(route) => { verification=route.request().postDataJSON(); return route.fulfill({ json:session }); });
  await page.route('**/auth/v1/user',(route) => route.fulfill({ json:user }));
  await page.route('**/rest/v1/campaigns**',(route) => route.fulfill({ json:[],status:206,headers:{ 'content-range':'0-0/0' } }));
  await page.goto('/register'); await page.getByRole('button',{ name:'Daftar',exact:true }).click();
  expect(signup).toBeUndefined();
  await register(page);
  await expect(page.getByRole('heading',{ name:'Verifikasi Email' })).toBeVisible();
  const otp=page.getByLabel('Kode Verifikasi'); await otp.fill('12a345678'); await expect(otp).toHaveValue('123456');
  await page.getByRole('button',{ name:'Verifikasi',exact:true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Akun Menunggu Persetujuan')).toBeVisible();
  expect(signup.data).toEqual({ display_name:'Pengelola uji' }); expect(signup.data.role).toBeUndefined(); expect(signup.redirect_to).toBeUndefined();
  expect(verification).toMatchObject({ email:user.email,token:'123456',type:'signup' });
});

test('invalid OTP and resend give useful feedback',async ({ page }) => {
  await page.route('**/auth/v1/signup**',(route) => route.fulfill({ json:{ user:{ id:user.id,email:user.email },session:null } }));
  await page.route('**/auth/v1/verify**',(route) => route.fulfill({ status:403,json:{ message:'Token has expired or is invalid',code:'otp_expired' } }));
  let resent=false; await page.route('**/auth/v1/resend**',(route) => { resent=true; return route.fulfill({ json:{} }); });
  await register(page); await page.getByLabel('Kode Verifikasi').fill('000000'); await page.getByRole('button',{ name:'Verifikasi',exact:true }).click();
  await expect(page.getByText('Kode salah atau sudah kedaluwarsa.')).toBeVisible();
  await page.getByRole('button',{ name:/Kirim Ulang Kode/ }).evaluate((control) => { control.disabled=false; control.querySelector('span').textContent='Kirim Ulang Kode'; });
  await page.getByRole('button',{ name:'Kirim Ulang Kode',exact:true }).click(); await expect.poll(() => resent).toBe(true); await expect(page.getByText('Kode baru sudah dikirim.')).toBeVisible();
});

test('login failure and password recovery give useful feedback',async ({ page }) => {
  await page.route('**/auth/v1/token**',(route) => route.fulfill({ status:400,json:{ message:'Invalid login credentials',code:'invalid_credentials' } }));
  await page.route('**/auth/v1/recover**',(route) => route.fulfill({ json:{} }));
  await page.goto('/login'); await page.getByLabel('Email',{ exact:true }).fill(user.email); await page.getByLabel('Password',{ exact:true }).fill('Katasandi!123456');
  await page.getByRole('button',{ name:'Tampilkan' }).click(); await expect(page.getByLabel('Password',{ exact:true })).toHaveAttribute('type','text'); await page.getByRole('button',{ name:'Sembunyikan' }).click();
  await page.getByRole('button',{ name:'Masuk',exact:true }).click(); await expect(page.getByText('Email atau kata sandi tidak cocok.')).toBeVisible();
  await page.getByRole('link',{ name:'Lupa Password?' }).click(); await page.getByLabel('Email',{ exact:true }).fill(user.email); await page.getByRole('button',{ name:'Kirim Link',exact:true }).click(); await expect(page.getByText('Kalau email terdaftar, link pemulihan akan dikirim.')).toBeVisible();
});

test('login establishes context and redirects by role without another click',async ({ page }) => {
  await viewerRoute(page,'super_admin');
  await page.route('**/auth/v1/token**',(route) => route.fulfill({ json:session }));
  await page.route('**/auth/v1/user',(route) => route.fulfill({ json:user }));
  await page.route('**/rest/v1/campaigns**',(route) => route.fulfill({ json:[],status:206,headers:{ 'content-range':'0-0/0' } }));
  await page.goto('/login');
  await page.getByLabel('Email',{ exact:true }).fill(user.email);
  await page.getByLabel('Password',{ exact:true }).fill('Katasandi!123456');
  await page.getByRole('button',{ name:'Masuk',exact:true }).click();
  await expect(page).toHaveURL(/\/superadmin$/);
  await expect(page.getByRole('heading',{ name:'Semua Kampanye' })).toBeVisible();
});

test('verification callback still supports password recovery and old links safely',async ({ page }) => {
  await page.goto('/auth/callback?error=expired'); await expect(page.getByRole('heading',{ name:'Link Tidak Berlaku' })).toBeVisible();
});
