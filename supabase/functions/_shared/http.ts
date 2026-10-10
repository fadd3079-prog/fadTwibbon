import { createClient } from 'npm:@supabase/supabase-js@2.99.3';

export const url = Deno.env.get('SUPABASE_URL')!;
export const service = () => createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function headers(req: Request, publicRead = false): Headers {
  const origin = req.headers.get('origin') || '';
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim());
  const h = new Headers({ 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type', 'Access-Control-Allow-Methods': publicRead ? 'GET, OPTIONS' : 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' });
  if (publicRead) h.set('Access-Control-Allow-Origin', '*');
  else if (allowed.includes(origin)) h.set('Access-Control-Allow-Origin', origin);
  return h;
}
export function reply(req: Request, data: unknown, status = 200, publicRead = false) { return new Response(JSON.stringify(data), { status, headers: headers(req, publicRead) }); }
export function preflight(req: Request, publicRead = false) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req, publicRead) });
  const origin = req.headers.get('origin');
  if (!publicRead && origin && !(Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).includes(origin)) return reply(req, { error: 'FORBIDDEN' }, 403);
  return null;
}
export async function bytes(req: Request, limit: number, limitCode = 'VALIDATION_ERROR'): Promise<Uint8Array> {
  if (Number(req.headers.get('content-length') || 0) > limit) throw new Error(limitCode);
  const reader = req.body?.getReader();
  if (!reader) throw new Error('VALIDATION_ERROR');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error(limitCode); }
    chunks.push(value);
  }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return data;
}
export async function json(req: Request, limit = 2048) { return JSON.parse(new TextDecoder().decode(await bytes(req, limit))); }
export async function identity(req: Request, allowDeleting = false) {
  const bearer = req.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } });
  const { data: { user }, error } = await db.auth.getUser(bearer.slice(7));
  if (error || !user || !user.email_confirmed_at) throw new Error('UNAUTHORIZED');
  const { data: profile, error: profileError } = await db.rpc('viewer_context');
  if (profileError || !profile || (profile.status === 'suspended' && !(allowDeleting && profile.deletion_pending))) throw new Error('FORBIDDEN');
  return { db, user, profile };
}
export function failure(req: Request, error: unknown) {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message || '';
  const codes = ['UNAUTHORIZED','FORBIDDEN','APPROVAL_REQUIRED','QUOTA_EXCEEDED','CONFLICT','NOT_FOUND','VALIDATION_ERROR','MISSING_TEMPLATE','TEMPLATE_REQUIRED','TEMPLATE_INVALID','TEMPLATE_TOO_LARGE','TEMPLATE_DIMENSIONS','TEMPLATE_ENCODING','TEMPLATE_TRANSPARENCY'];
  const code = codes.find((candidate) => message.includes(candidate)) || 'SERVICE_UNAVAILABLE';
  const status = code === 'UNAUTHORIZED' ? 401 : ['FORBIDDEN','APPROVAL_REQUIRED'].includes(code) ? 403 : code === 'CONFLICT' ? 409 : code === 'NOT_FOUND' ? 404 : code.startsWith('TEMPLATE_') || code==='MISSING_TEMPLATE' ? 422 : code === 'SERVICE_UNAVAILABLE' ? 503 : 400;
  console.error(JSON.stringify({ event:'request_failed',code,status,message }));
  return reply(req, { error: code }, status);
}
export async function cleanup(owner: string | null = null) {
  const db = service();
  const { data, error } = await db.rpc('storage_garbage', { p_owner: owner });
  if (error) return;
  for (const item of data || []) {
    const { error: removalError } = await db.storage.from(item.bucket).remove([item.path]);
    if (!removalError) await db.rpc('ack_storage_garbage', { p_bucket: item.bucket, p_path: item.path });
  }
}
