import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { png } from '../helpers/png.js';

const campaignId='b1672a13-c65a-4e5a-8d7d-18c7fa9144d9';
async function campaign(page,analyticsStatus=202) {
  const template=png(1080,720,true);
  await page.route('**/functions/v1/public-campaign?*',(route) => route.fulfill({ json:{ id:campaignId,title:'Kampanye uji editor',slug:'uji-editor',caption:'Caption uji\nBaris kedua',templateUrl:'https://test.supabase.co/template.png',templateWidth:1080,templateHeight:720 } }));
  await page.route('**/template.png',(route) => route.fulfill({ body:template,contentType:'image/png',headers:{ 'Access-Control-Allow-Origin':'*' } }));
  await page.route('**/functions/v1/record-download',(route) => route.fulfill({ status:analyticsStatus,json:{ status:'accepted' } }));
  await page.goto('/c/uji-editor'); await expect(page.getByRole('button',{ name:'Pilih Foto' })).toBeVisible();
}
test('local photo, transform, fixed template, original-resolution export and privacy',async ({ page }) => {
  const errors=[],uploads=[]; page.on('pageerror',(e) => errors.push(e.message));
  page.on('request',(r) => { if (r.method()!=='GET') uploads.push({ url:r.url(),body:r.postData() }); });
  await campaign(page,503);
  await expect(page.getByRole('button',{ name:'Unduh Twibbon' })).toBeDisabled();
  await page.locator('#photo-file').setInputFiles({ name:'photo.png',mimeType:'image/png',buffer:png(900,1200) });
  await expect(page.getByRole('button',{ name:'Ganti Foto' })).toBeVisible();
  await page.setViewportSize({ width:390,height:844 }); await page.screenshot({ path:'test-results/editor-photo-mobile.png',fullPage:true });
  await page.getByRole('button',{ name:'Perbesar' }).click();
  await page.getByRole('button',{ name:'Putar Kanan' }).click();
  await page.locator('canvas').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('+');
  const box=await page.locator('canvas').boundingBox(); await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+box.width/2+50,box.y+box.height/2+30); await page.mouse.up();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{ name:'Unduh Twibbon' }).click()]);
  const data=await readFile(await download.path()); expect(data.readUInt32BE(16)).toBe(1080); expect(data.readUInt32BE(20)).toBe(720);
  expect(download.suggestedFilename()).toBe('fadTwibbon-uji-editor.png');
  const pixels=await page.evaluate(async () => { const image=new Image(); image.src=document.querySelector('.save-result').href; await image.decode(); const canvas=document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height; const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0); const border=[...ctx.getImageData(0,0,1,1).data],center=[...ctx.getImageData(540,360,1,1).data]; image.src=''; return { border,center }; });
  expect(pixels.border).toEqual([245,200,30,255]); expect(pixels.center).toEqual([210,40,70,255]);
  await expect(page.getByText('PNG siap.',{ exact:false })).toBeVisible();
  await expect.poll(() => uploads.length).toBe(1);
  expect(JSON.parse(uploads[0].body)).toEqual({ campaignId,eventToken:expect.any(String) });
  expect(uploads[0].url).toContain('record-download'); expect(errors).toEqual([]);
  await page.getByRole('button',{ name:'Atur Ulang' }).click();
  await expect(page.getByRole('slider',{ name:'Perbesaran foto' })).toHaveValue('100');
});
test('unsupported photos preserve controls and show an actionable error',async ({ page }) => {
  await campaign(page);
  await page.locator('#photo-file').setInputFiles({ name:'photo.heic',mimeType:'image/heic',buffer:Buffer.from('not an image') });
  await expect(page.getByText('Format tidak didukung.',{ exact:false })).toBeVisible();
  await expect(page.getByRole('button',{ name:'Unduh Twibbon' })).toBeDisabled();
});
test('caption clipboard fallback remains selectable',async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator,'clipboard',{ value:{ writeText:() => Promise.reject(new Error('denied')) } }); });
  await campaign(page); await page.getByRole('button',{ name:'Salin Caption' }).click();
  await expect(page.getByRole('textbox',{ name:'Teks untuk disalin' })).toHaveValue('Caption uji\nBaris kedua');
});
test('pinch changes only the photo and keyboard controls remain reachable',async ({ page }) => {
  await campaign(page); await page.locator('#photo-file').setInputFiles({ name:'photo.png',mimeType:'image/png',buffer:png(1080,720) });
  await expect(page.getByRole('button',{ name:'Ganti Foto' })).toBeVisible();
  await page.evaluate(() => { const canvas=document.querySelector('canvas'),rect=canvas.getBoundingClientRect(); canvas.setPointerCapture=() => {}; const dispatch=(type,id,x,y) => canvas.dispatchEvent(new PointerEvent(type,{ pointerId:id,pointerType:'touch',clientX:rect.left+x,clientY:rect.top+y,bubbles:true })); dispatch('pointerdown',1,100,100); dispatch('pointerdown',2,200,100); dispatch('pointermove',2,280,100); dispatch('pointerup',2,280,100); dispatch('pointerup',1,100,100); });
  await expect(page.getByRole('slider')).not.toHaveValue('100');
  await page.locator('canvas').focus(); await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name:'Ganti Foto' })).toBeFocused();
});
test('mobile, tablet, desktop and 200% text reflow have no horizontal overflow',async ({ page }) => {
  await campaign(page);
  for (const theme of ['light','dark']) {
    const current=await page.locator('html').getAttribute('data-theme');
    if (current!==theme) await page.getByRole('button',{ name:theme==='dark'?'Gunakan Tema Gelap':'Gunakan Tema Terang' }).click();
    for (const width of [320,390,700,900,1280]) {
    await page.setViewportSize({ width,height:900 });
    const layout=await page.evaluate(() => ({ width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right>innerWidth+1).map((e) => [e.tagName,e.className,Math.round(e.getBoundingClientRect().right)]) }));
    expect(layout.scroll,JSON.stringify(layout)).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width:1280,height:900 });
    await page.screenshot({ path:`test-results/editor-${theme}.png`,fullPage:true });
  }
  await page.setViewportSize({ width:320,height:900 }); await page.evaluate(() => { document.documentElement.style.fontSize='200%'; }); expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('theme selection persists and follows system when requested',async ({ page }) => {
  await page.emulateMedia({ colorScheme:'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('button',{ name:'Gunakan Tema Gelap' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{ name:'Gunakan Tema Terang' }).click(); await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
test('home, login, registration, recovery, legal pages, unknown campaign and protected routes',async ({ page }) => {
  await page.route('**/functions/v1/public-campaign?*',(route) => route.fulfill({ status:404,json:{ error:'NOT_FOUND' } }));
  await page.goto('/'); await page.setViewportSize({ width:1280,height:900 }); await page.screenshot({ path:'test-results/home-desktop.png',fullPage:true });
  await page.getByLabel('Slug kampanye').fill('uji-editor'); await page.getByRole('button',{ name:'Buka kampanye' }).click(); await expect(page).toHaveURL(/\/c\/uji-editor$/); await page.goBack();
  await page.getByRole('link',{ name:'Masuk',exact:true }).last().click(); await expect(page.getByRole('heading',{ name:'Masuk',exact:true })).toBeVisible(); await page.screenshot({ path:'test-results/login-desktop.png',fullPage:true });
  await page.getByRole('link',{ name:'Daftar',exact:true }).click(); await expect(page.getByRole('heading',{ name:'Daftar',exact:true })).toBeVisible();
  await page.setViewportSize({ width:390,height:844 }); await page.screenshot({ path:'test-results/register-mobile.png',fullPage:true });
  await page.getByRole('link',{ name:'Ketentuan',exact:true }).first().click(); await expect(page.getByRole('heading',{ name:'Ketentuan penggunaan' })).toBeVisible();
  await page.getByRole('link',{ name:'Privasi',exact:true }).click(); await expect(page.getByRole('heading',{ name:'Privasi',exact:true })).toBeVisible();
  await page.goto('/forgot-password'); await expect(page.getByRole('button',{ name:'Kirim tautan',exact:true })).toBeVisible();
  await page.route('**/auth/v1/user',(route) => route.fulfill({ status:401,json:{ message:'no session' } }));
  await page.goto('/admin'); await expect(page).toHaveURL(/\/login$/);
  await page.goto('/c/not-found'); await expect(page.getByRole('heading',{ name:'Kampanye tidak ditemukan.' })).toBeVisible();
  await page.goto('/unknown'); await expect(page.getByRole('heading',{ name:'Halaman tidak ditemukan' })).toBeVisible();
  await page.screenshot({ path:'test-results/not-found-mobile.png',fullPage:true });
});
