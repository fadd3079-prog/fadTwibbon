import { test,expect } from '@playwright/test';

test('registration validates inputs and sends only ordinary account metadata',async ({ page }) => {
  let sent;
  await page.route('**/auth/v1/signup**',(route) => { sent=route.request().postDataJSON(); return route.fulfill({ json:{ user:{ id:'f1bb0e7a-e1a1-437f-a28a-983b38c8e364',email:'uji@example.invalid' },session:null } }); });
  await page.goto('/register'); await page.getByRole('button',{ name:'Daftar sebagai admin' }).click();
  expect(sent).toBeUndefined();
  await page.getByLabel('Nama pengelola').fill('Pengelola uji'); await page.getByLabel('Email',{ exact:true }).fill('uji@example.invalid'); await page.getByLabel('Kata sandi',{ exact:true }).fill('Katasandi!123456'); await page.getByRole('checkbox').check();
  await page.getByRole('button',{ name:'Daftar sebagai admin' }).click();
  await expect(page.getByText('Periksa email Anda untuk verifikasi.',{ exact:false })).toBeVisible();
  expect(sent.data).toEqual({ display_name:'Pengelola uji' }); expect(sent.data.role).toBeUndefined();
});

test('login failure, verification resend and password recovery give useful feedback',async ({ page }) => {
  await page.route('**/auth/v1/token**',(route) => route.fulfill({ status:400,json:{ message:'Invalid login credentials',code:'invalid_credentials' } }));
  await page.route('**/auth/v1/resend**',(route) => route.fulfill({ json:{} }));
  await page.route('**/auth/v1/recover**',(route) => route.fulfill({ json:{} }));
  await page.goto('/login'); await page.getByLabel('Email',{ exact:true }).fill('uji@example.invalid'); await page.getByLabel('Kata sandi',{ exact:true }).fill('Katasandi!123456');
  await page.getByRole('button',{ name:'Masuk',exact:true }).click(); await expect(page.getByText('Email atau kata sandi tidak cocok.')).toBeVisible();
  await page.getByRole('button',{ name:'Kirim ulang verifikasi' }).click(); await expect(page.getByText('Jika akun belum terverifikasi, email verifikasi akan dikirim.')).toBeVisible();
  await page.getByRole('link',{ name:'Lupa kata sandi?' }).click(); await page.getByLabel('Email',{ exact:true }).fill('uji@example.invalid'); await page.getByRole('button',{ name:'Kirim tautan pemulihan' }).click(); await expect(page.getByText('Jika email terdaftar, tautan pemulihan akan dikirim.',{ exact:false })).toBeVisible();
  await page.goto('/auth/callback?error=expired'); await expect(page.getByRole('heading',{ name:'Tautan tidak berlaku' })).toBeVisible();
});
