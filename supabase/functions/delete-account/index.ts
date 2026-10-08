import { preflight, reply, json, identity, service, failure } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const early = preflight(req); if (early) return early;
  if (req.method!=='POST') return reply(req,{ error:'METHOD_NOT_ALLOWED' },405);
  try {
    const { user,profile } = await identity(req,true), body = await json(req);
    if (body.confirm!==user.email || profile.role==='super_admin' || !user.last_sign_in_at || Date.now()-Date.parse(user.last_sign_in_at)>600000) throw new Error('FORBIDDEN');
    const db = service();
    // Freeze the account before cleanup so concurrent editors cannot create new assets.
    const frozen = await db.from('profiles').update({ status:'suspended',deletion_pending:true }).eq('user_id',user.id);
    if (frozen.error) throw frozen.error;
    const campaigns = await db.from('campaigns').select('id').eq('owner_id',user.id);
    if (campaigns.error) throw campaigns.error;
    const ids = (campaigns.data || []).map((c) => c.id);
    const templates = ids.length ? await db.from('templates').select('storage_path').in('campaign_id',ids) : { data:[],error:null };
    if (templates.error) throw templates.error;
    const paths = (templates.data || []).map((t) => t.storage_path);
    const garbage = await db.rpc('storage_garbage',{ p_owner:user.id });
    if (garbage.error) throw garbage.error;
    for (const bucket of ['templates','published-templates']) {
      const activePaths = bucket==='templates' ? paths : paths.map((path) => path.split('/').slice(1).join('/'));
      const all = [...new Set([...activePaths,...(garbage.data || []).filter((g: { bucket:string }) => g.bucket===bucket).map((g: { path:string }) => g.path)])];
      if (all.length) { const removed = await db.storage.from(bucket).remove(all); if (removed.error) throw removed.error; }
    }
    const removed = await db.auth.admin.deleteUser(user.id);
    if (removed.error) throw removed.error;
    for (const g of garbage.data || []) await db.rpc('ack_storage_garbage',{ p_bucket:g.bucket,p_path:g.path });
    return reply(req,{ success:true });
  } catch (error) { return failure(req,error); }
});
