import { backendUrl, publicKey } from './supabase.js';

export function recordDownload(campaignId, eventToken = crypto.randomUUID()) {
  // Analytics never carries image bytes and must not delay a local download.
  return fetch(`${backendUrl}/functions/v1/record-download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: publicKey },
    body: JSON.stringify({ campaignId, eventToken }), keepalive: true, signal: AbortSignal.timeout(4000),
  }).catch(() => null);
}
