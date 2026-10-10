import { supabase, rpc } from './supabase.js';

const listeners = new Set();
let snapshot = { status:'loading',viewer:null,error:null };
let initialization;
let subscription;

function publish(next) {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}

async function loadViewer(session) {
  if (!session?.user) {
    publish({ status:'anonymous',viewer:null,error:null });
    return null;
  }
  try {
    const profile = await rpc('viewer_context');
    const viewer = profile ? { ...profile,email:session.user.email } : null;
    publish(viewer ? { status:'authenticated',viewer,error:null } : { status:'anonymous',viewer:null,error:null });
    return viewer;
  } catch (error) {
    publish({ status:'error',viewer:snapshot.viewer,error });
    throw error;
  }
}

export async function initializeAuth() {
  if (initialization) return initialization;
  initialization = (async () => {
    const db = await supabase();
    const { data:{ session },error } = await db.auth.getSession();
    if (error) {
      publish({ status:'error',viewer:null,error });
      throw error;
    }
    await loadViewer(session);
    subscription = db.auth.onAuthStateChange((event,nextSession) => {
      if (event==='PASSWORD_RECOVERY') {
        queueMicrotask(() => dispatchEvent(new CustomEvent('auth:recovery')));
        return;
      }
      if (['INITIAL_SESSION','TOKEN_REFRESHED'].includes(event)) return;
      queueMicrotask(() => void loadViewer(nextSession).catch(() => {}));
    }).data.subscription;
    return snapshot;
  })();
  return initialization;
}

export const authState = () => snapshot;

export function subscribeAuth(listener) {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

export async function context() {
  await initializeAuth();
  if (snapshot.status==='error') throw snapshot.error;
  return snapshot.viewer;
}

export async function establishSession(session) {
  if (!session?.user) throw Object.assign(new Error('Sesi tidak valid.'),{ friendly:true });
  return loadViewer(session);
}

export async function refreshAuth() {
  const db = await supabase();
  const { data:{ session },error } = await db.auth.getSession();
  if (error) throw error;
  return loadViewer(session);
}

export async function signOut() {
  const db = await supabase();
  const { error } = await db.auth.signOut();
  if (error) throw error;
  publish({ status:'anonymous',viewer:null,error:null });
}

export const callbackUrl = () => `${location.origin}/auth/callback`;

export function destroyAuth() {
  subscription?.unsubscribe();
  subscription = null;
}
