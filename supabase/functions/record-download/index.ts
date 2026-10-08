import { preflight, reply, json, uuid, service, failure } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const early = preflight(req); if (early) return early;
  if (req.method !== 'POST') return reply(req, { error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const body = await json(req, 512);
    if (!body || Object.keys(body).sort().join(',')!=='campaignId,eventToken' || !uuid(body.campaignId) || !uuid(body.eventToken)) throw new Error('VALIDATION_ERROR');
    const secret = Deno.env.get('ANALYTICS_HMAC_SECRET');
    if (!secret) throw new Error('SERVICE_UNAVAILABLE');
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim().slice(0,64);
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{ name: 'HMAC', hash:'SHA-256' },false,['sign']);
    const digest = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${new Date().toISOString().slice(0,10)}:${ip}`));
    const source = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2,'0')).join('');
    const { data,error } = await service().rpc('accept_download',{ p_campaign:body.campaignId,p_token:body.eventToken,p_source:source });
    if (error) throw error;
    return reply(req,{ status:data },data==='rate_limited'?429:data==='not_found'?404:202);
  } catch (error) { return failure(req,error); }
});
