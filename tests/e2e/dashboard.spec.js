import { test,expect } from '@playwright/test';
import { png } from '../helpers/png.js';

const userId='840d8240-19ab-4189-a1e0-dafc6e14ad46',campaignId='d0f5a59a-4ac7-4420-a66a-c262e439d144',templateId='aceb5cd8-4854-42b4-8a21-dc174cf058ea';
async function dashboard(page,role='admin') {
  const user={ id:userId,email:'uji@example.invalid',email_confirmed_at:'2026-10-08T00:00:00Z',aud:'authenticated',role:'authenticated' };
  const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({ sub:userId,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated' })).toString('base64url'),'fixture'].join('.');
  await page.addInitScript(({ user,token }) => localStorage.setItem('sb-test-auth-token',JSON.stringify({ access_token:token,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user })),{ user,token });
  await page.route('**/auth/v1/**',(route) => route.fulfill({ json:route.request().method()==='POST'?{ access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user }:user }));
  let c=null,t=null,clock=0; const calls=[];
  const updated=() => new Date(Date.UTC(2026,9,8,12,0,clock++)).toISOString();
  const stats=() => ({ campaigns:c?1:0,published:c?.status==='published'?1:0,downloads:2,last7:2,last30:2,storageBytes:t?10000:0,users:role==='super_admin'?2:null,ranking:c?[{ id:c.id,title:c.title,slug:c.slug,downloads:2 }]:[],series:Array.from({ length:30 },(_,i) => ({ day:new Date(Date.UTC(2026,8,10+i)).toISOString(),downloads:i===29?2:0 })) });
  await page.route('**/rest/v1/**',async (route) => {
    const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').at(-1),body=req.postDataJSON();
    if (req.method()==='POST') calls.push({ name,body });
    let result;
    if (name==='viewer_context') result={ user_id:userId,display_name:'Pengelola uji',status:'active',verified:true,role };
    else if (name==='dashboard_stats') result=stats();
    else if (name==='save_campaign') { c={ id:campaignId,owner_id:userId,status:c?.status || 'draft',template_id:c?.template_id || null,published_at:c?.published_at || null,title:body.p_title,slug:body.p_slug,description:body.p_description,caption:body.p_caption,updated_at:updated() }; result=c; }
    else if (name==='set_campaign_status') { c.status=body.p_status; c.updated_at=updated(); result=c; }
    else if (name==='campaigns') result=url.searchParams.has('id')?c:c?[c]:[];
    else if (name==='templates') result=t;
    else if (name==='platform_settings') result={ value:{ campaigns:10,published:5,storage_bytes:31457280 } };
    else if (name==='profiles') result=[{ user_id:'63b7c304-b959-440f-90d0-75e880b3d795',display_name:'Admin uji',status:'pending',created_at:'2026-10-08',user_roles:{ role:'admin' } }];
    else if (name==='audit_logs') result=[];
    else result=null;
    await route.fulfill({ json:result,headers:{ 'Content-Range':`0-0/${Array.isArray(result)?result.length:1}` } });
  });
  await page.route('**/functions/v1/campaign-assets',async (route) => {
    const req=route.request();
    calls.push({ name:'campaign-assets',contentType:req.headers()['content-type'] });
    if (req.headers()['content-type'].startsWith('multipart/')) { t={ id:templateId,storage_path:`${userId}/${campaignId}/${templateId}.png`,width:1080,height:720 }; c.template_id=templateId; }
    else if (req.postDataJSON().action==='publish') { c.status='published'; c.published_at=updated(); }
    c && (c.updated_at=updated()); await route.fulfill({ json:c || { success:true } });
  });
  await page.route('**/storage/v1/object/sign/**',(route) => route.fulfill({ json:{ signedURL:'/object/sign/templates/test.png?token=fixture' } }));
  await page.route('**/storage/v1/object/sign/templates/test.png?*',(route) => route.fulfill({ body:png(1080,720,true),contentType:'image/png' }));
  return calls;
}

test('admin creates, previews, publishes, shares, edits, unpublishes and archives',async ({ page }) => {
  const errors=[]; page.on('pageerror',(e) => errors.push(e.message));
  const calls=await dashboard(page); await page.goto('/admin');
  await expect(page.locator('body')).not.toContainText(/(^|\s)null(\s|$)/);
  await expect(page.getByRole('heading',{ name:'Belum Ada Kampanye' })).toBeVisible();
  await page.setViewportSize({ width:1280,height:900 }); await page.screenshot({ path:'test-results/admin-empty-desktop.png',fullPage:true });
  await page.getByRole('link',{ name:'Statistik',exact:true }).click(); await expect(page.getByRole('heading',{ name:'Belum Ada Data' })).toBeVisible();
  await page.getByRole('link',{ name:'Kampanye',exact:true }).click(); await page.getByRole('link',{ name:'Buat Kampanye' }).click();
  await page.setViewportSize({ width:390,height:844 }); await page.screenshot({ path:'test-results/campaign-form-mobile.png',fullPage:true });
  await page.getByLabel('Judul',{ exact:true }).fill('Kampanye uji lengkap'); await expect(page.getByLabel('Slug link')).toHaveValue('kampanye-uji-lengkap');
  await page.getByLabel('Caption',{ exact:true }).fill('Caption uji');
  await expect(page.getByRole('button',{ name:'Terbitkan',exact:true })).toBeDisabled();
  await page.getByLabel('Template PNG',{ exact:true }).setInputFiles({ name:'opaque.png',mimeType:'image/png',buffer:png(80,80,false) });
  await expect(page.getByText('Template perlu area transparan minimal 1% untuk foto dan bingkai yang terlihat.')).toBeVisible();
  await expect(page.getByRole('button',{ name:'Terbitkan',exact:true })).toBeDisabled();
  await page.getByLabel('Template PNG',{ exact:true }).setInputFiles({ name:'template.png',mimeType:'image/png',buffer:png(1080,720,true) });
  await expect(page.getByText('Template siap.',{ exact:false })).toBeVisible();
  await expect(page.getByRole('button',{ name:'Terbitkan',exact:true })).toBeEnabled();
  await page.getByRole('button',{ name:'Simpan',exact:true }).evaluate((control) => { control.click(); control.click(); }); await expect(page).toHaveURL(new RegExp(campaignId));
  expect(calls.filter((call) => call.name==='campaign-assets')).toHaveLength(1);
  await page.getByRole('button',{ name:'Terbitkan',exact:true }).click(); await expect(page.getByRole('heading',{ name:'Status: Terbit' })).toBeVisible();
  await expect(page.getByLabel('Slug link')).toHaveAttribute('readonly','');
  await page.addInitScript(() => Object.defineProperty(navigator,'clipboard',{ value:{ writeText:() => Promise.reject(new Error('denied')) } }));
  await page.getByRole('button',{ name:'Salin Link' }).click();
  await page.getByLabel('Judul',{ exact:true }).fill('Kampanye diperbarui'); await page.getByRole('button',{ name:'Simpan perubahan' }).click();
  await page.getByRole('button',{ name:'Tarik Publikasi',exact:true }).click(); await page.getByRole('dialog').getByRole('button',{ name:'Batal' }).click();
  await page.getByRole('button',{ name:'Tarik Publikasi',exact:true }).click(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{ name:'Tarik Publikasi',exact:true }).click(); await page.getByRole('dialog').getByRole('button',{ name:'Tarik Publikasi' }).click(); await expect(page.getByRole('heading',{ name:'Status: Draft' })).toBeVisible();
  await page.getByRole('button',{ name:'Arsipkan' }).click(); await page.getByRole('dialog').getByRole('button',{ name:'Arsipkan' }).click(); await expect(page.getByRole('heading',{ name:'Status: Arsip' })).toBeVisible();
  await page.getByRole('button',{ name:'Kembalikan' }).click(); await page.getByRole('dialog').getByRole('button',{ name:'Kembalikan' }).click();
  await page.evaluate(() => { document.querySelector('.dashboard-shell').dataset.persist='yes'; });
  await page.getByRole('link',{ name:'Statistik',exact:true }).click(); await expect(page.locator('.dashboard-shell')).toHaveAttribute('data-persist','yes');
  await expect(page.getByRole('heading',{ name:'Aktivitas Download' })).toBeVisible();
  await expect(page.getByRole('heading',{ name:'Kampanye Teratas' })).toBeVisible();
  await expect(page.getByText('Kampanye Terbit')).toBeVisible();
  await page.getByRole('button',{ name:'30 Hari' }).click(); await expect(page.getByRole('button',{ name:'30 Hari' })).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('heading',{ name:'Aktivitas Per Hari' })).toBeVisible();
  await page.setViewportSize({ width:1280,height:900 }); await page.screenshot({ path:'test-results/statistics-desktop.png',fullPage:true });
  await page.getByRole('button',{ name:'Gunakan Tema Gelap' }).click(); await page.screenshot({ path:'test-results/statistics-dark.png',fullPage:true });
  await page.setViewportSize({ width:390,height:844 }); await page.screenshot({ path:'test-results/statistics-mobile.png',fullPage:true });
  await page.getByRole('link',{ name:'Pengaturan',exact:true }).click(); await expect(page.locator('.dashboard-shell')).toHaveAttribute('data-persist','yes'); await page.getByLabel('Nama pengelola').fill('Nama uji baru'); await page.getByRole('button',{ name:'Simpan',exact:true }).first().click(); await expect(page.getByText('Nama diperbarui.')).toBeVisible();
  await page.getByRole('button',{ name:'Buka Menu' }).click(); await page.getByRole('button',{ name:'Keluar' }).click(); await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test('superadmin approval, quotas and cleanup controls are functional',async ({ page }) => {
  const calls=await dashboard(page,'super_admin'); await page.goto('/superadmin/users');
  await expect(page.getByRole('heading',{ name:'Akun pengelola' })).toBeVisible();
  await page.setViewportSize({ width:1280,height:900 }); await page.screenshot({ path:'test-results/superadmin-users-desktop.png',fullPage:true });
  await page.getByRole('button',{ name:'Setujui' }).click(); await page.getByRole('dialog').getByRole('button',{ name:'Aktifkan' }).click();
  await expect.poll(() => calls.some((c) => c.name==='moderate_account')).toBe(true);
  await page.getByRole('link',{ name:'Pengaturan',exact:true }).click(); await page.getByRole('button',{ name:'Simpan',exact:true }).nth(1).click(); await expect(page.getByText('Kuota diperbarui.',{ exact:false })).toBeVisible();
  await page.getByRole('button',{ name:'Bersihkan' }).click(); await expect(page.getByText('Aset lama dibersihkan.')).toBeVisible();
  await page.getByRole('link',{ name:'Statistik',exact:true }).click(); await expect(page.getByRole('heading',{ name:'Statistik' })).toBeVisible(); await expect(page.getByRole('heading',{ name:'Belum Ada Data' })).toBeVisible();
  for (const theme of ['light','dark']) {
    const current=await page.locator('html').getAttribute('data-theme');
    if (current!==theme) await page.getByRole('button',{ name:theme==='dark'?'Gunakan Tema Gelap':'Gunakan Tema Terang' }).click();
    for (const width of [320,700,1280]) { await page.setViewportSize({ width,height:900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
    await page.evaluate(() => document.activeElement?.blur());
    await page.screenshot({ path:`test-results/dashboard-${theme}.png`,fullPage:true });
  }
});
