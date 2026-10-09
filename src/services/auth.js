import { supabase, rpc } from './supabase.js';

export async function context() {
  const db = await supabase();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return null;
  const profile = await rpc('viewer_context');
  return profile ? { ...profile, email: user.email } : null;
}

export async function signOut() {
  const db=await supabase();
  const { error } = await db.auth.signOut();
  if (error) await db.auth.signOut({ scope:'local' });
}

export const callbackUrl = () => `${location.origin}/auth/callback`;
