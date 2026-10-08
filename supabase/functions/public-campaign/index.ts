import { preflight, reply, service, url } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const early = preflight(req, true); if (early) return early;
  if (req.method !== 'GET') return reply(req, { error: 'METHOD_NOT_ALLOWED' }, 405, true);
  const slug = new URL(req.url).searchParams.get('slug') || '';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length<3 || slug.length>64) return reply(req, { error: 'NOT_FOUND' }, 404, true);
  const { data, error } = await service().rpc('public_campaign', { p_slug: slug });
  if (error) return reply(req, { error: 'SERVICE_UNAVAILABLE' }, 503, true);
  if (!data) return reply(req, { error: 'NOT_FOUND' }, 404, true);
  const { templatePath, ...manifest } = data;
  const response = reply(req, { ...manifest, templateUrl: `${url}/storage/v1/object/public/published-templates/${templatePath}` }, 200, true);
  response.headers.set('Cache-Control','public, max-age=30, s-maxage=30');
  return response;
});
