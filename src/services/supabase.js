let client;
export const backendUrl = import.meta.env?.VITE_SUPABASE_URL;
export const publicKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(backendUrl?.startsWith('http') && publicKey && !publicKey.includes('YOUR_'));

export async function supabase() {
  if (!configured) throw Object.assign(new Error('Layanan belum dikonfigurasi. Isi variabel lingkungan Supabase.'), { friendly: true });
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(backendUrl, publicKey, { auth: { flowType: 'pkce', detectSessionInUrl: true } });
  }
  return client;
}

export async function rpc(name, args = {}) {
  const { data, error } = await (await supabase()).rpc(name, args);
  if (error) throw error;
  return data;
}

export async function edge(name, body) {
  const db = await supabase();
  const { data, error } = await db.functions.invoke(name, { body });
  if (error) {
    const details = await error.context?.json?.().catch(() => null);
    throw new Error(details?.error || error.message);
  }
  return data;
}
