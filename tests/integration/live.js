import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { png } from '../helpers/png.js';

const ref=process.env.SUPABASE_PROJECT_REF || 'brumpzehrkbnnjsrpcxt';
if (!/^[a-z]{20}$/.test(ref)) throw new Error('Invalid project reference');
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',ref,'--output','json'],{ encoding:'utf8' }));
const url=`https://${ref}.supabase.co`,anon=keys.find((k) => k.name==='anon').api_key,serviceKey=keys.find((k) => k.name==='service_role').api_key;
const client=(key) => createClient(url,key,{ auth:{ persistSession:false,autoRefreshToken:false } });
const service=client(serviceKey),created=[],passed=[];
const check=(name,value=true) => { assert.ok(value,name); passed.push(name); };
const must=(result) => { if (result.error) throw new Error(result.error.message); return result.data; };
let paths=[];
try {
  const accounts={};
  for (const role of ['a','b','super','unverified']) {
    const email=`fadtwibbon-test-${crypto.randomUUID()}@example.invalid`,password=`Aa!${crypto.randomUUID()}`;
    const user=must(await service.auth.admin.createUser({ email,password,email_confirm:role!=='unverified',user_metadata:{ display_name:`Akun uji ${role}`,role:'super_admin' } })).user;
    created.push(user.id); accounts[role]={ user,email,password,db:client(anon) };
    if (role!=='unverified') must(await accounts[role].db.auth.signInWithPassword({ email,password }));
  }
  const rejected=await accounts.unverified.db.auth.signInWithPassword({ email:accounts.unverified.email,password:accounts.unverified.password });
  check('unverified email cannot sign in',Boolean(rejected.error));
  const { a,b,super:owner }=accounts;
  assert.match(owner.user.id,/^[a-f0-9-]{36}$/);
  execFileSync('supabase',['db','query','--linked','--project-ref',ref,`update public.user_roles set role='super_admin' where user_id='${owner.user.id}'; update public.profiles set status='active' where user_id='${owner.user.id}';`],{ encoding:'utf8' });
  const viewer=must(await a.db.rpc('viewer_context')); check('editable metadata cannot provision superadmin',viewer.role==='admin' && viewer.status==='pending');
  must(await owner.db.rpc('moderate_account',{ p_user:a.user.id,p_status:'active' })); must(await owner.db.rpc('moderate_account',{ p_user:b.user.id,p_status:'active' }));
  const roster=must(await owner.db.from('profiles').select('user_id,user_roles(role)').eq('user_id',a.user.id).single());
  check('superadmin roster joins authoritative role',roster.user_roles.role==='admin');
  let campaign=must(await a.db.rpc('save_campaign',{ p_id:null,p_title:'Kampanye integrasi sementara',p_slug:`uji-${crypto.randomUUID()}`,p_description:'',p_caption:'Caption integrasi',p_expected:null }));
  check('authenticated campaign draft created',campaign.status==='draft');
  const cross=await b.db.from('campaigns').select('*').eq('id',campaign.id); check('tenant B cannot read tenant A',!cross.error && cross.data.length===0);
  const slug=campaign.slug,origin='https://fadtwibbon.vercel.app',endpoint=`${url}/functions/v1/campaign-assets`;
  const session=must(await a.db.auth.getSession()).session;
  const preflight=await fetch(endpoint,{ method:'OPTIONS',headers:{ Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type' } });
  check('production preflight allows configured origin',preflight.status===204 && preflight.headers.get('access-control-allow-origin')===origin);
  const invoke=async (body) => {
    const headers={ apikey:anon,Authorization:`Bearer ${session.access_token}`,Origin:origin };
    let requestBody=body;
    if (!(body instanceof FormData)) { headers['Content-Type']='application/json'; requestBody=JSON.stringify(body); }
    const response=await fetch(endpoint,{ method:'POST',headers,body:requestBody });
    check('actual edge response includes CORS',response.headers.get('access-control-allow-origin')===origin);
    const data=await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'SERVICE_UNAVAILABLE'),{ status:response.status });
    return data;
  };
  const stale=campaign;
  campaign=must(await a.db.rpc('save_campaign',{ p_id:campaign.id,p_title:campaign.title,p_slug:campaign.slug,p_description:'Versi baru',p_caption:campaign.caption,p_expected:campaign.updated_at }));
  const staleForm=new FormData(); staleForm.set('campaignId',stale.id); staleForm.set('expected',stale.updated_at); staleForm.set('file',new Blob([png(1080,720,true)],{ type:'image/png' }),'stale.png');
  let staleRefused=false; try { await invoke(staleForm); } catch (error) { staleRefused=error.message==='CONFLICT' && error.status===409; } check('stale template upload is rejected',staleRefused);
  const withoutTemplate=must(await a.db.rpc('save_campaign',{ p_id:null,p_title:'Tanpa template',p_slug:`tanpa-${crypto.randomUUID()}`,p_description:'',p_caption:'',p_expected:null }));
  let missingRefused=false; try { await invoke({ action:'publish',campaignId:withoutTemplate.id,expected:withoutTemplate.updated_at }); } catch (error) { missingRefused=['MISSING_TEMPLATE','VALIDATION_ERROR'].includes(error.message); } check('publication without template is rejected',missingRefused);
  const invalid=new FormData(); invalid.set('campaignId',campaign.id); invalid.set('expected',campaign.updated_at); invalid.set('file',new Blob(['not-png'],{ type:'image/png' }),'invalid.png');
  let refused=false; try { await invoke(invalid); } catch { refused=true; } check('server rejects forged PNG template',refused);
  const form=new FormData(); form.set('campaignId',campaign.id); form.set('expected',campaign.updated_at); form.set('file',new Blob([png(1080,720,true)],{ type:'image/png' }),'template.png');
  campaign=await invoke(form); check('server validates and stores PNG',Boolean(campaign.template_id));
  const t=must(await service.from('templates').select('storage_path,width,height').eq('id',campaign.template_id).single()); paths.push(t.storage_path);
  check('original template dimensions preserved',t.width===1080 && t.height===720);
  const privateDenied=await b.db.storage.from('templates').download(t.storage_path); check('private template inaccessible to other tenant',Boolean(privateDenied.error));
  const deniedUpload=await b.db.storage.from('templates').upload(`${a.user.id}/${campaign.id}/evil.png`,png(1080,720,true),{ contentType:'image/png' }); check('direct storage upload denied',Boolean(deniedUpload.error));
  campaign=await invoke({ action:'publish',campaignId:campaign.id,expected:campaign.updated_at }); check('publication succeeds after template storage',campaign.status==='published');
  const publicPage=await fetch(`https://fadtwibbon.vercel.app/c/${slug}`); check('production public route opens',publicPage.ok);
  const manifest=await fetch(`${url}/functions/v1/public-campaign?slug=${slug}`); const metadata=await manifest.json(); check('live public manifest excludes private metadata',manifest.ok && metadata.title && !('owner_id' in metadata) && !('email' in metadata));
  const templateResponse=await fetch(metadata.templateUrl); check('versioned public PNG delivered with CORS',templateResponse.ok && templateResponse.headers.get('access-control-allow-origin')==='*');
  const token=crypto.randomUUID(),event=() => fetch(`${url}/functions/v1/record-download`,{ method:'POST',headers:{ 'Content-Type':'application/json',Origin:'http://127.0.0.1:3000' },body:JSON.stringify({ campaignId:campaign.id,eventToken:token }) });
  check('download event accepted',(await (await event()).json()).status==='accepted'); check('live event deduplicated',(await (await event()).json()).status==='duplicate');
  const stats=must(await a.db.rpc('dashboard_stats')); check('live aggregate matches event count',Number(stats.downloads)===1);
  const deniedModeration=await b.db.rpc('moderate_account',{ p_user:a.user.id,p_status:'suspended' }); check('ordinary admin cannot suspend another account',Boolean(deniedModeration.error));
  must(await owner.db.rpc('moderate_account',{ p_user:a.user.id,p_status:'suspended' }));
  const suspension=await fetch(`${url}/functions/v1/public-campaign?slug=${slug}`,{ headers:{ 'Cache-Control':'no-cache' } }); check('suspended campaigns hidden by live endpoint',suspension.status===404);
  const suspendedWrite=await a.db.rpc('save_campaign',{ p_id:null,p_title:'No',p_slug:`no-${crypto.randomUUID()}`,p_description:'',p_caption:'',p_expected:null }); check('suspended existing JWT cannot create campaigns',Boolean(suspendedWrite.error));
  must(await owner.db.rpc('moderate_account',{ p_user:a.user.id,p_status:'active' }));
  must(await a.db.auth.signInWithPassword({ email:a.email,password:a.password }));
  const deletion=await a.db.functions.invoke('delete-account',{ body:{ confirm:a.email } });
  if (deletion.error) { const info=await deletion.error.context?.json?.().catch(() => null); throw new Error(info?.error || deletion.error.message); }
  check('self-service account and campaign deletion',Boolean(deletion.data.success));
  check('deleted account removed from Auth',Boolean((await service.auth.admin.getUserById(a.user.id)).error));
  check('deleted account assets removed',Boolean((await service.storage.from('templates').download(t.storage_path)).error));
  console.log(JSON.stringify({ passed:passed.length,tests:passed },null,2));
} finally {
  for (const bucket of ['templates','published-templates']) if (paths.length) await service.storage.from(bucket).remove(bucket==='templates'?paths:paths.map((p) => p.split('/').slice(1).join('/')));
  for (const id of created) {
    const result=await service.auth.admin.getUserById(id);
    if (result.data?.user?.email?.startsWith('fadtwibbon-test-')) {
      const removed=await service.auth.admin.deleteUser(id);
      if (removed.error) { console.error(`Test account cleanup failed (${id}): ${removed.error.message}`); process.exitCode = 1; }
    }
  }
}
