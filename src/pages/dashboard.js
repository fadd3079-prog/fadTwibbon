import '../styles/dashboard.css';
import { el,link,button,field,status,message,busy,copy,confirmAction,number,date } from '../utils/ui.js';
import { supabase,rpc,edge } from '../services/supabase.js';
import { listCampaigns,getCampaign,saveCampaign,setStatus,publish,uploadTemplate } from '../services/campaigns.js';
import { slugify,validateCampaign } from '../utils/validation.js';
import { validateTemplate,loadTemplate,release } from '../editor/image-loader.js';
import { createEditor } from '../editor/editor.js';

const states = { draft:'Draft',published:'Terbit',disabled:'Dinonaktifkan',archived:'Arsip' };
export async function dashboardPage(path,viewer,navigate) {
  const global=path.startsWith('/superadmin'), base=global?'/superadmin':'/admin';
  const destinations=global ? [['Kampanye',base],['Admin',`${base}/users`],['Statistik',`${base}/statistics`],['Pengaturan',`${base}/settings`]] : [['Kampanye',base],['Statistik',`${base}/statistics`],['Pengaturan',`${base}/settings`]];
  const nav=el('nav',{ class:'dashboard-nav','aria-label':global?'Pengelolaan platform':'Pengelolaan kampanye' },destinations.map(([label,href]) => link(label,href)));
  for (const a of nav.children) if (path===a.getAttribute('href') || (a.getAttribute('href')===base && path.includes('/campaigns'))) a.setAttribute('aria-current','page');
  const root=el('div',{},nav);
  if (viewer.status==='pending') root.append(el('p',{ class:'account-note' },'Akun menunggu persetujuan. Anda dapat menyiapkan draft; publikasi tersedia setelah akun disetujui.'));
  let content;
  if (path===`${base}/statistics`) content=await statistics(global);
  else if (global && path===`${base}/users`) content=await users();
  else if (path===`${base}/settings`) content=await settings(viewer,global,navigate);
  else if (path===`${base}/campaigns/new`) content=await campaignForm(null,viewer,base,navigate);
  else if (new RegExp(`^${base}/campaigns/[0-9a-f-]{36}$`).test(path)) content=await campaignForm(path.split('/').at(-1),viewer,base,navigate);
  else if (path===base || path===`${base}/campaigns`) content=await campaigns(global,base);
  else content=el('div',{},el('h1',{},'Halaman tidak ditemukan'),link('Kembali ke kampanye',base));
  root.append(content.root || content);
  return { root,destroy:content.destroy || (() => {}) };
}

async function campaigns(global,base) {
  const root=el('section',{},el('div',{ class:'page-heading' },el('h1',{},global?'Kampanye platform':'Kampanye Anda'),link('Buat kampanye',`${base}/campaigns/new`,'button primary')));
  const feedback=status(), filter=field('Status kampanye','campaign-filter',{});
  const select=el('select',{ id:'campaign-filter' },el('option',{ value:'' },'Semua status'),Object.entries(states).map(([value,label]) => el('option',{ value },label)));
  filter.input.replaceWith(select); filter.wrap.classList.add('filter'); root.append(filter.wrap,feedback);
  const list=el('ul',{ class:'campaign-list' }), pager=el('div',{ class:'pagination' }); root.append(list,pager);
  let page=0,sequence=0,disposed=false;
  async function load() {
    const seq=++sequence; message(feedback,'Memuat kampanye…'); list.replaceChildren(); pager.replaceChildren();
    try {
      const { data,count }=await listCampaigns(page,select.value,global);
      if (disposed || seq!==sequence) return;
      message(feedback,'');
      if (!data.length) list.append(el('li',{ class:'empty-state' },el('h2',{},select.value?'Tidak ada kampanye dengan status ini.':'Belum ada kampanye.'),el('p',{},select.value?'Pilih status lain untuk melihat kampanye.':'Buat draft dan unggah template PNG untuk memulai.')));
      for (const c of data) {
        const actions=el('div',{ class:'actions' },link(global?'Kelola':'Edit',`${base}/campaigns/${c.id}`,'button'));
        if (c.status==='published') actions.append(button('Salin tautan',() => copy(`${location.origin}/c/${c.slug}`,feedback)),el('a',{ href:`/c/${c.slug}`,target:'_blank',rel:'noopener',class:'button' },'Buka'));
        list.append(el('li',{ class:'campaign-row' },el('div',{},el('h2',{},c.title),el('p',{},el('span',{ class:'row-status','data-status':c.status },states[c.status]),` · /c/${c.slug}`),el('small',{},`Diperbarui ${date(c.updated_at)}`)),actions));
      }
      if (count>12) {
        const prev=button('Sebelumnya',() => { page=Math.max(0,page-1); void load(); }),next=button('Berikutnya',() => { page++; void load(); }); prev.disabled=page===0; next.disabled=(page+1)*12>=count;
        pager.append(prev,el('span',{},`Halaman ${page+1} dari ${Math.ceil(count/12)}`),next);
      }
    } catch (error) { if (!disposed) { message(feedback,error.message?.includes('FORBIDDEN')?'Akses tidak tersedia.':'Daftar gagal dimuat. Coba lagi.',true); pager.append(button('Coba lagi',() => void load())); } }
  }
  select.addEventListener('change',() => { page=0; void load(); }); await load();
  try {
    const summary=await rpc('dashboard_stats',{ p_global:global });
    root.insertBefore(el('p',{ class:'hint' },`${number(summary.published)} kampanye terbit. ${number(summary.downloads)} aktivitas unduh tercatat.${global?` ${number(summary.users)} akun pengelola.`:''}`),filter.wrap);
  } catch { root.insertBefore(el('p',{ class:'hint' },'Ringkasan statistik gagal dimuat.'),filter.wrap); }
  return { root,destroy() { disposed=true; } };
}

async function campaignForm(id,viewer,base,navigate) {
  let current=id?await getCampaign(id):null, selectedFile=null, editor=null, disposed=false, previewSequence=0;
  const root=el('section',{},el('div',{ class:'page-heading' },el('h1',{},id?'Kelola kampanye':'Buat kampanye'),link('Kembali',base,'button')));
  const form=el('form',{ class:'campaign-form' }),fields=el('div',{}),preview=el('aside',{ class:'form-preview','aria-label':'Pratinjau' },el('h2',{},'Pratinjau template'));
  const inputs={};
  for (const [label,name,options] of [['Judul','title',{ required:true,maxlength:120 }],['Slug tautan','slug',{ required:true,minlength:3,maxlength:64,pattern:'[a-z0-9]+(-[a-z0-9]+)*',help:'Slug dikunci setelah publikasi pertama.' }],['Deskripsi','description',{ multiline:true,maxlength:2000 }],['Caption','caption',{ multiline:true,maxlength:5000 }]]) {
    const f=field(label,name,options); if (current) f.input.value=current[name]; inputs[name]=f.input; fields.append(f.wrap);
  }
  if (current?.published_at) inputs.slug.readOnly=true;
  let manualSlug=Boolean(current);
  inputs.slug.addEventListener('input',() => { manualSlug=true; });
  inputs.title.addEventListener('input',() => { if (!manualSlug) inputs.slug.value=slugify(inputs.title.value); });
  const feedback=status();
  const template=field(current?.template_id?'Ganti template PNG':'Template PNG','template-file',{ type:'file',accept:'image/png',help:'PNG transparan, maksimal 3 MB, 4.096 piksel per sisi dan 16 megapiksel. Minimal 1% area transparan. Berkas 8-bit, non-interlaced, tanpa animasi.' });
  template.input.disabled=current?.status==='published' || current?.status==='disabled'; fields.append(template.wrap);
  if (current?.status==='published') fields.append(el('p',{ class:'hint' },'Tarik publikasi terlebih dahulu untuk mengganti template. Teks dapat diperbarui tanpa mengganti aset.'));
  if (current?.disabled_reason) fields.append(el('p',{ class:'account-note' },`Alasan moderasi: ${current.disabled_reason}`));
  const previewBody=el('div',{},el('p',{ class:'hint' },'Pilih PNG untuk memeriksa area transparan dan posisi foto.')); preview.append(previewBody);
  async function setPreview(image,seq) {
    if (disposed || seq!==previewSequence) { release(image); return; }
    editor?.destroy(); editor=createEditor(image,{ preview:true }); previewBody.replaceChildren(editor.root);
  }
  template.input.addEventListener('change',async () => {
    const file=template.input.files[0]; if (!file) return;
    const seq=++previewSequence; message(feedback,'Memeriksa template…');
    try { const image=await validateTemplate(file); if (seq===previewSequence && !disposed) selectedFile=file; await setPreview(image,seq); message(feedback,'Template siap. Simpan untuk mengunggah.'); }
    catch (error) { template.input.value=''; selectedFile=null; message(feedback,error.message,true); }
  });
  const save=el('button',{ type:'submit',class:'primary' },'Simpan draft'), publishButton=button(current?.status==='published'?'Perbarui publikasi':'Publikasikan',() => void perform(publishButton,true));
  if (current?.status==='published') save.textContent='Simpan perubahan';
  fields.append(el('div',{ class:'actions' },save,publishButton),feedback); form.append(fields,preview); root.append(form);
  async function saveAll() {
    const values=Object.fromEntries(Object.entries(inputs).map(([key,input]) => [key,input.value]));
    try { validateCampaign(values); } catch (error) { error.friendly=true; throw error; }
    current=await saveCampaign(values,current);
    if (selectedFile) { current=await uploadTemplate(current,selectedFile); selectedFile=null; }
    return current;
  }
  async function perform(control,publishing=false) {
    save.disabled=true; publishButton.disabled=true; template.input.disabled=true;
    await busy(control,feedback,async () => {
      await saveAll();
      if (publishing) current=await publish(current);
      navigate(`${base}/campaigns/${current.id}`,true);
    });
    if (!disposed) { save.disabled=false; publishButton.disabled=false; template.input.disabled=['published','disabled'].includes(current?.status); }
  }
  form.addEventListener('submit',(event) => { event.preventDefault(); void perform(save); });
  if (current) {
    const actions=el('div',{ class:'campaign-actions' },el('h2',{},`Status: ${states[current.status]}`),el('div',{ class:'actions' }));
    const row=actions.lastChild;
    if (current.status==='published') row.append(button('Tarik publikasi',() => confirmAction('Tarik publikasi?','Kampanye tidak lagi tersedia untuk pengunjung baru. Halaman yang sudah terbuka dapat tetap digunakan.','Tarik publikasi',async () => { await setStatus(current,'draft'); navigate(`${base}/campaigns/${current.id}`,true); })),button('Salin tautan',() => copy(`${location.origin}/c/${current.slug}`,feedback)),el('a',{ class:'button',href:`/c/${current.slug}`,target:'_blank',rel:'noopener' },'Buka kampanye'));
    if (current.status!=='disabled' || viewer.role==='super_admin') row.append(button(current.status==='archived' || current.status==='disabled'?'Kembalikan ke draft':'Arsipkan',() => confirmAction('Ubah status kampanye?','Slug tetap tersimpan dan tidak dapat dipakai kampanye lain.','Ubah status',async () => { await setStatus(current,['archived','disabled'].includes(current.status)?'draft':'archived'); navigate(`${base}/campaigns/${current.id}`,true); })));
    if (viewer.role==='super_admin') {
      const reason=field('Alasan moderasi','moderation-reason',{ maxlength:500 }); actions.append(reason.wrap,button('Nonaktifkan kampanye',() => busy(save,feedback,async () => { if (!reason.input.value.trim()) throw Object.assign(new Error('Isi alasan moderasi.'),{ friendly:true }); await rpc('moderate_campaign',{ p_id:current.id,p_reason:reason.input.value.trim(),p_expected:current.updated_at }); navigate(`${base}/campaigns/${current.id}`,true); }), 'danger'));
    }
    root.append(actions);
  }
  if (current?.templateUrl) {
    const seq=++previewSequence;
    try { await setPreview(await loadTemplate(current.templateUrl),seq); }
    catch { message(feedback,'Pratinjau gagal dimuat. Muat ulang untuk mencoba lagi.',true); }
  }
  return { root,destroy() { disposed=true; previewSequence++; editor?.destroy(); } };
}

async function statistics(global) {
  const data=await rpc('dashboard_stats',{ p_global:global });
  if (!data || typeof data!=='object') throw Object.assign(new Error('Statistik gagal dimuat. Coba lagi.'),{ friendly:true });
  const root=el('section',{},el('h1',{},global?'Statistik platform':'Statistik kampanye'),el('p',{ class:'hint' },'Aktivitas unduh yang diterima server, bukan jumlah orang unik atau jaminan berkas tersimpan. Tanggal menggunakan UTC.'));
  const metrics=el('dl',{ class:'metrics' });
  for (const [label,value] of [['Total tercatat',data.downloads],['7 hari terakhir',data.last7],['30 hari terakhir',data.last30]]) metrics.append(el('div',{},el('dt',{},label),el('dd',{},number(value))));
  root.append(metrics);
  if (!data.campaigns) { root.append(el('p',{ class:'empty-state' },'Belum ada kampanye. Buat kampanye terlebih dahulu untuk melihat aktivitasnya.')); return root; }
  const ranking=el('section',{},el('h2',{},'Kampanye dengan aktivitas terbanyak'));
  const rows=Array.isArray(data.ranking)?data.ranking:[];
  const table=el('table',{ class:'data-table' },el('thead',{},el('tr',{},el('th',{ scope:'col' },'Kampanye'),el('th',{ scope:'col' },'Aktivitas unduh'))),el('tbody',{},rows.map((r) => el('tr',{},el('td',{},link(r.title,`${global?'/superadmin':'/admin'}/campaigns/${r.id}`)),el('td',{},number(r.downloads)))))); ranking.append(table);
  const daily=el('section',{},el('h2',{},'Aktivitas unduh per hari'));
  const range=el('select',{ 'aria-label':'Rentang hari' },el('option',{ value:'7' },'7 hari terakhir'),el('option',{ value:'30' },'30 hari terakhir'));
  const dailyTable=el('table',{ class:'data-table' }),head=el('thead',{},el('tr',{},el('th',{ scope:'col' },'Tanggal (UTC)'),el('th',{ scope:'col' },'Aktivitas unduh'))),body=el('tbody',{});
  const series=Array.isArray(data.series)?data.series:[];
  function draw() { body.replaceChildren(...series.slice(-Number(range.value)).map((r) => el('tr',{},el('td',{},date(r.day)),el('td',{},number(r.downloads))))); }
  range.addEventListener('change',draw); draw(); dailyTable.append(head,body); daily.append(range,dailyTable);
  root.append(el('div',{ class:'stats-layout' },ranking,daily)); return root;
}

async function users() {
  const root=el('section',{},el('h1',{},'Akun pengelola'),el('p',{ class:'hint' },'Persetujuan mengaktifkan publikasi. Penangguhan memblokir perubahan dan kampanye publik milik akun tersebut.'));
  const feedback=status(), filter=el('select',{ 'aria-label':'Status akun',class:'filter' },el('option',{ value:'' },'Semua akun'),el('option',{ value:'pending' },'Menunggu persetujuan'),el('option',{ value:'active' },'Aktif'),el('option',{ value:'suspended' },'Ditangguhkan'));
  const list=el('ul',{ class:'user-list' }),pager=el('div',{ class:'pagination' }); root.append(filter,feedback,list,pager);
  let page=0,disposed=false;
  async function load() {
    message(feedback,'Memuat akun…'); list.replaceChildren(); pager.replaceChildren();
    let query=(await supabase()).from('profiles').select('user_id,display_name,status,deletion_pending,created_at,user_roles(role)',{ count:'exact' }).order('created_at',{ ascending:false }).range(page*12,page*12+11);
    if (filter.value) query=query.eq('status',filter.value);
    const { data,error,count }=await query;
    if (disposed) return;
    if (error) { message(feedback,'Daftar akun gagal dimuat.',true); pager.append(button('Coba lagi',() => void load())); return; }
    message(feedback,'');
    if (!data.length) list.append(el('li',{ class:'empty-state' },'Tidak ada akun pada filter ini.'));
    for (const user of data) {
      const info=el('div',{},el('h2',{},user.display_name || 'Pengelola tanpa nama'),el('p',{},({ pending:'Menunggu persetujuan',active:'Aktif',suspended:'Ditangguhkan' })[user.status]),el('small',{},`ID: ${user.user_id}`));
      const row=el('li',{ class:'user-row' },info);
      if (user.deletion_pending) info.append(el('p',{ class:'hint' },'Penghapusan akun belum selesai. Pemilik akun dapat mencoba ulang melalui Pengaturan.'));
      else if (user.user_roles?.role!=='super_admin') {
        const active=user.status==='active';
        row.append(button(active?'Tangguhkan':user.status==='pending'?'Setujui':'Aktifkan',() => confirmAction(active?'Tangguhkan akun?':'Aktifkan akun?',active?'Kampanye akun ini akan disembunyikan. Data tidak dihapus.':'Akun ini dapat memublikasikan kampanye. Kampanye terbit yang sebelumnya tersembunyi karena penangguhan akan tersedia lagi.',active?'Tangguhkan':'Aktifkan',async () => { await rpc('moderate_account',{ p_user:user.user_id,p_status:active?'suspended':'active' }); await load(); }),active?'danger':''));
      } else info.append(el('p',{ class:'hint' },'Pemilik platform'));
      list.append(row);
    }
    if (count>12) { const prev=button('Sebelumnya',() => { page=Math.max(0,page-1); void load(); }),next=button('Berikutnya',() => { page++; void load(); }); prev.disabled=page===0; next.disabled=(page+1)*12>=count; pager.append(prev,el('span',{},`Halaman ${page+1}`),next); }
  }
  filter.addEventListener('change',() => { page=0; void load(); }); await load();
  return { root,destroy() { disposed=true; } };
}

async function settings(viewer,global,navigate) {
  const root=el('section',{},el('h1',{},global?'Pengaturan platform':'Pengaturan akun'),el('p',{},viewer.email));
  if (viewer.deletion_pending) { root.append(el('p',{ class:'account-note' },'Penghapusan sebelumnya belum selesai. Akun dibekukan agar tidak ada aset baru. Masukkan kata sandi dan coba ulang.'),deletionForm(viewer,navigate)); return root; }
  const feedback=status(),name=field('Nama pengelola','display-name',{ value:viewer.display_name,maxlength:100 });
  const profile=el('form',{ class:'settings-form' },name.wrap,el('button',{ type:'submit' },'Simpan nama'),feedback);
  profile.addEventListener('submit',(e) => { e.preventDefault(); void busy(profile.querySelector('button'),feedback,() => rpc('save_profile',{ p_name:name.input.value }),'Nama diperbarui.'); }); root.append(profile);
  const result=await (await supabase()).from('platform_settings').select('value').eq('key','quotas').single();
  if (result.error) throw result.error;
  const q=result.data.value;
  if (global) {
    const data=await rpc('dashboard_stats',{ p_global:true });
    root.append(el('h2',{},'Penyimpanan template'),el('p',{},`${number(data.storageBytes)} byte template privat tercatat. Aset publik menambah salinan untuk template yang pernah diterbitkan.`),el('p',{ class:'hint' },'Periksa kapasitas database, storage fisik, dan egress di dashboard Supabase. Angka ini bukan keseluruhan pemakaian paket.'));
    const quotas=el('form',{ class:'settings-form' }),inputs={};
    for (const [label,key,max,value] of [['Kampanye per akun','campaigns',100,q.campaigns],['Kampanye terbit per akun','published',100,q.published],['Penyimpanan privat per akun (MB)','storage',1024,q.storage_bytes/1048576]]) { const f=field(label,key,{ type:'number',required:true,min:key==='storage'?3:1,max,value,step:'1' }); inputs[key]=f.input; quotas.append(f.wrap); }
    const submit=el('button',{ type:'submit' },'Simpan kuota'),note=status(); quotas.append(submit,note); quotas.addEventListener('submit',(e) => { e.preventDefault(); void busy(submit,note,() => rpc('update_quotas',{ p_campaigns:Number(inputs.campaigns.value),p_published:Number(inputs.published.value),p_storage:Number(inputs.storage.value)*1048576 }),'Kuota diperbarui. Data yang sudah ada tidak dihapus.'); }); root.append(el('h2',{},'Kuota akun'),quotas);
    const cleanNote=status(),clean=button('Bersihkan aset versi lama',() => busy(clean,cleanNote,() => edge('campaign-assets',{ action:'cleanup' }),'Antrean pembersihan diproses.'));
    root.append(clean,cleanNote);
    const audits=await (await supabase()).from('audit_logs').select('action,target_type,created_at').order('created_at',{ ascending:false }).limit(20);
    if (audits.error) throw audits.error;
    root.append(el('h2',{},'Audit terakhir'),audits.data.length?el('ul',{},audits.data.map((a) => el('li',{},`${a.action} · ${a.target_type} · ${date(a.created_at)}`))):el('p',{},'Belum ada tindakan tercatat.'));
  } else {
    const data=await rpc('dashboard_stats');
    const used=data.storageBytes/q.storage_bytes;
    root.append(el('h2',{},'Kuota Anda'),el('p',{},`${number(data.campaigns)} / ${number(q.campaigns)} kampanye. ${number(data.published)} / ${number(q.published)} terbit. ${(data.storageBytes/1048576).toFixed(1)} / ${(q.storage_bytes/1048576).toFixed(0)} MB template privat.`));
    if (used>=.7) root.append(el('p',{ class:'account-note' },used>=.9?'Penyimpanan hampir penuh (90% atau lebih). Hubungi pengelola untuk menyesuaikan kuota.':'Penyimpanan sudah mencapai 70%. Pantau sebelum mengunggah template baru.'));
    root.append(deletionForm(viewer,navigate));
  }
  return root;
}

function deletionForm(viewer,navigate) {
  const password=field('Kata sandi untuk konfirmasi','delete-password',{ type:'password',autocomplete:'current-password',required:true });
  const deletion=el('form',{ class:'settings-form' },el('h2',{},'Hapus akun'),el('p',{},'Menghapus akun, kampanye, template, dan statistik aktif secara permanen. Salinan yang sudah diunduh orang lain dan backup penyedia tidak dapat ditarik kembali.'),password.wrap);
  const submit=el('button',{ type:'submit',class:'danger' },'Hapus akun dan kampanye'); deletion.append(submit);
  deletion.addEventListener('submit',(e) => { e.preventDefault(); confirmAction('Hapus akun secara permanen?','Semua kampanye Anda akan dihapus. Tindakan ini tidak dapat dibatalkan.','Hapus akun',async () => { const db=await supabase(); const login=await db.auth.signInWithPassword({ email:viewer.email,password:password.input.value }); if (login.error) throw login.error; await edge('delete-account',{ confirm:viewer.email }); await db.auth.signOut({ scope:'local' }); navigate('/',true); }); });
  return deletion;
}
