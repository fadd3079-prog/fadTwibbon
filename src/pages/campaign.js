import { publicCampaign } from '../services/campaigns.js';
import { recordDownload } from '../services/analytics.js';
import { createEditor } from '../editor/editor.js';
import { loadTemplate } from '../editor/image-loader.js';
import { el } from '../utils/ui.js';

export async function campaignPage(slug, signal) {
  const campaign = await publicCampaign(slug,signal);
  const template = await loadTemplate(campaign.templateUrl,signal);
  const editor = createEditor(template,{ slug:campaign.slug,caption:campaign.caption,onDownload:() => recordDownload(campaign.id) });
  const root = el('div',{ class:'campaign-page' },el('header',{ class:'campaign-heading' },el('p',{ class:'kicker' },'Kampanye'),el('h1',{},campaign.title)),editor.root);
  return { root,campaign,destroy:editor.destroy };
}
