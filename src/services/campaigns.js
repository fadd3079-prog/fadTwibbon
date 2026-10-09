import { supabase, rpc, edge, backendUrl, publicKey } from './supabase.js';

export async function publicCampaign(slug, signal) {
  const response = await fetch(`${backendUrl}/functions/v1/public-campaign?slug=${encodeURIComponent(slug)}`, { headers: { apikey: publicKey }, signal });
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) throw new TypeError('fetch');
  return response.json();
}

export async function listCampaigns(page = 0, filter = '', global = false) {
  let query = (await supabase()).from('campaigns').select('id,title,slug,status,updated_at,owner_id', { count: 'exact' }).order('updated_at', { ascending: false }).range(page * 12, page * 12 + 11);
  if (filter) query = query.eq('status', filter);
  if (!global) {
    const { data: { user } } = await (await supabase()).auth.getUser();
    if (!user) throw Object.assign(new Error('Sesi berakhir. Masuk kembali.'), { friendly: true });
    query = query.eq('owner_id', user.id);
  }
  const { data, count, error } = await query;
  if (error) throw error;
  return { data, count };
}

export async function getCampaign(id) {
  const { data, error } = await (await supabase()).from('campaigns').select('*').eq('id', id).single();
  if (error) throw error;
  if (data.template_id) {
    const result = await (await supabase()).from('templates').select('*').eq('id', data.template_id).single();
    if (result.error) throw result.error;
    data.template = result.data;
    const signed = await (await supabase()).storage.from('templates').createSignedUrl(result.data.storage_path, 600);
    if (signed.error) throw signed.error;
    data.templateUrl = signed.data.signedUrl;
  }
  return data;
}

export const saveCampaign = (data, current) => rpc('save_campaign', { p_id: current?.id || null, p_title: data.title.trim(), p_slug: data.slug, p_description: data.description, p_caption: data.caption, p_expected: current?.updated_at || null });
export const setStatus = (campaign, status) => rpc('set_campaign_status', { p_id: campaign.id, p_status: status, p_expected: campaign.updated_at });
export const publish = (campaign) => edge('campaign-assets', { action: 'publish', campaignId: campaign.id, expected: campaign.updated_at });
export async function uploadTemplate(campaign, file) {
  const body = new FormData();
  body.set('campaignId', campaign.id); body.set('expected', campaign.updated_at); body.set('file', file);
  return edge('campaign-assets', body);
}
