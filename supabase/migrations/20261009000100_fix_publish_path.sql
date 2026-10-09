-- Fix: publish_campaign checked published-templates for t.storage_path
-- (which includes owner_id prefix), but campaign-assets edge function
-- copies the file to {campaign_id}/{template_id}.png (no owner prefix).
-- This made every publish fail with VALIDATION_ERROR.

create or replace function public.publish_campaign(p_actor uuid,p_id uuid,p_expected timestamptz) returns public.campaigns language plpgsql security definer set search_path = '' as $$
declare c public.campaigns; t public.templates; q jsonb;
begin
  c := private.lock_campaign(p_id,p_actor,p_expected);
  if c.status='disabled' and not private.super(p_actor) then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.profiles where user_id=c.owner_id and status='active') then raise exception 'APPROVAL_REQUIRED'; end if;
  select * into t from public.templates where id=c.template_id and campaign_id=c.id and is_active;
  if t.id is null or not exists(select 1 from storage.objects where bucket_id='published-templates' and name=c.id::text||'/'||t.id::text||'.png') then raise exception 'VALIDATION_ERROR'; end if;
  select value into q from public.platform_settings where key='quotas';
  if c.status<>'published' and (select count(*) from public.campaigns where owner_id=c.owner_id and status='published') >= (q->>'published')::int then raise exception 'QUOTA_EXCEEDED'; end if;
  update public.campaigns set status='published',published_at=coalesce(published_at,now()),disabled_reason=null,updated_at=clock_timestamp() where id=c.id returning * into c;
  perform private.audit(p_actor,'publish','campaign',c.id);
  return c;
end $$;
