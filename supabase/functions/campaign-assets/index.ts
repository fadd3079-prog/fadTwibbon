import { preflight, reply, json, bytes, uuid, identity, service, failure, cleanup } from '../_shared/http.ts';
import { validatePng } from '../_shared/png.ts';

Deno.serve(async (req) => {
  const early = preflight(req); if (early) return early;
  if (req.method !== 'POST') return reply(req,{ error:'METHOD_NOT_ALLOWED' },405);
  let uploaded: string | null = null;
  const admin = service();
  try {
    const { db,user,profile } = await identity(req);
    const multipart = req.headers.get('content-type')?.startsWith('multipart/form-data');
    let body;
    if (multipart) {
      const data = await bytes(req,3145728+16384);
      body = await new Response(data.buffer as ArrayBuffer, { headers: { 'Content-Type':req.headers.get('content-type')! } }).formData();
    } else body = await json(req);
    if (!multipart && body.action==='cleanup') {
      if (profile.role!=='super_admin' || profile.status!=='active') throw new Error('FORBIDDEN');
      await cleanup(); return reply(req,{ success:true });
    }
    const campaignId = multipart ? body.get('campaignId') : body.campaignId;
    const expected = multipart ? body.get('expected') : body.expected;
    if (!uuid(campaignId) || typeof expected!=='string' || !Number.isFinite(Date.parse(expected))) throw new Error('VALIDATION_ERROR');
    const { data:c,error } = await db.from('campaigns').select('*,templates!campaigns_template_fk(*)').eq('id',campaignId).single();
    if (error || !c) throw new Error('FORBIDDEN');
    if (c.updated_at!==expected) throw new Error('CONFLICT');
    if (c.owner_id!==user.id && profile.role!=='super_admin') throw new Error('FORBIDDEN');
    if (multipart) {
      if (c.status==='published' || c.status==='disabled') throw new Error('FORBIDDEN');
      const file = body.get('file');
      if (!(file instanceof File)) throw new Error('VALIDATION_ERROR');
      const data = new Uint8Array(await file.arrayBuffer());
      const dimensions = validatePng(data);
      const digest = await crypto.subtle.digest('SHA-256',data);
      const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2,'0')).join('');
      await cleanup(c.owner_id);
      const id = crypto.randomUUID(), path = `${c.owner_id}/${c.id}/${id}.png`;
      const upload = await admin.storage.from('templates').upload(path,data,{ contentType:'image/png',cacheControl:'31536000',upsert:false });
      if (upload.error) throw upload.error;
      uploaded = path;
      const result = await admin.rpc('commit_template',{ p_actor:user.id,p_campaign:c.id,p_expected:expected,p_id:id,p_path:path,p_size:data.length,p_width:dimensions.width,p_height:dimensions.height,p_hash:hash });
      if (result.error) throw result.error;
      uploaded = null;
      await cleanup(c.owner_id);
      return reply(req,result.data);
    }
    if (body.action!=='publish' || !c.templates) throw new Error('VALIDATION_ERROR');
    const t = c.templates;
    const owner = await admin.from('profiles').select('status').eq('user_id',c.owner_id).single();
    if (owner.error || owner.data?.status!=='active') throw new Error('APPROVAL_REQUIRED');
    const publicPath = `${c.id}/${t.id}.png`;
    const existing = await admin.storage.from('published-templates').info(publicPath);
    if (existing.error) {
      const copied = await admin.storage.from('templates').copy(t.storage_path,publicPath,{ destinationBucket:'published-templates' });
      if (copied.error && !copied.error.message.includes('already exists')) throw copied.error;
    }
    const result = await admin.rpc('publish_campaign',{ p_actor:user.id,p_id:c.id,p_expected:expected });
    if (result.error) throw result.error;
    return reply(req,result.data);
  } catch (error) {
    if (uploaded) await admin.storage.from('templates').remove([uploaded]);
    return failure(req,error);
  }
});
