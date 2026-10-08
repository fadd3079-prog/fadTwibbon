alter table public.profiles add column deletion_pending boolean not null default false;

create or replace function private.lock_campaign(p_id uuid, p_actor uuid, p_expected timestamptz) returns public.campaigns language plpgsql security definer set search_path = '' as $$
declare c public.campaigns; owner uuid;
begin
  if not private.manage(p_id,p_actor) then raise exception 'FORBIDDEN'; end if;
  select owner_id into owner from public.campaigns where id=p_id;
  perform 1 from public.profiles where user_id=owner for update;
  if not private.manage(p_id,p_actor) then raise exception 'FORBIDDEN'; end if;
  select * into c from public.campaigns where id=p_id for update;
  if c.updated_at is distinct from p_expected then raise exception 'CONFLICT'; end if;
  return c;
end $$;
create or replace function public.viewer_context() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'status',p.status,'role',r.role,'verified',u.email_confirmed_at is not null,'deletion_pending',p.deletion_pending)
  from public.profiles p join public.user_roles r using(user_id) join auth.users u on u.id=p.user_id where p.user_id=auth.uid();
$$;
create or replace function public.update_quotas(p_campaigns int,p_published int,p_storage bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.super(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  if p_campaigns is null or p_published is null or p_storage is null or p_campaigns not between 1 and 100 or p_published not between 1 and p_campaigns or p_storage not between 3145728 and 1073741824 then raise exception 'VALIDATION_ERROR'; end if;
  update public.platform_settings set value=jsonb_build_object('campaigns',p_campaigns,'published',p_published,'storage_bytes',p_storage),updated_at=clock_timestamp() where key='quotas';
  perform private.audit(auth.uid(),'quotas','platform',null);
end $$;
create or replace function public.moderate_account(p_user uuid,p_status text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.super(auth.uid()) or p_user=auth.uid() or p_status is null or p_status not in ('active','suspended') or exists(select 1 from public.user_roles where user_id=p_user and role='super_admin') then raise exception 'FORBIDDEN'; end if;
  update public.profiles set status=p_status,updated_at=clock_timestamp() where user_id=p_user and not deletion_pending;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform private.audit(auth.uid(),p_status,'profile',p_user);
end $$;
create or replace function public.commit_template(p_actor uuid,p_campaign uuid,p_expected timestamptz,p_id uuid,p_path text,p_size bigint,p_width int,p_height int,p_hash text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.campaigns; q jsonb; v int; old public.templates; used bigint;
begin
  c := private.lock_campaign(p_campaign,p_actor,p_expected);
  if c.status in ('published','disabled') then raise exception 'FORBIDDEN'; end if;
  if p_path <> c.owner_id::text||'/'||c.id::text||'/'||p_id::text||'.png' then raise exception 'VALIDATION_ERROR'; end if;
  if not exists(select 1 from storage.objects where bucket_id='templates' and name=p_path) then raise exception 'VALIDATION_ERROR'; end if;
  select value into q from public.platform_settings where key='quotas';
  select coalesce(sum(t.size_bytes),0) into used from public.templates t join public.campaigns x on x.id=t.campaign_id where x.owner_id=c.owner_id;
  used := used + coalesce((select sum(size_bytes) from private.storage_gc where owner_id=c.owner_id and bucket='templates'),0);
  if used+p_size>(q->>'storage_bytes')::bigint then raise exception 'QUOTA_EXCEEDED'; end if;
  select coalesce(max(version),0)+1 into v from public.templates where campaign_id=c.id;
  update public.templates set is_active=false where campaign_id=c.id;
  insert into public.templates(id,campaign_id,storage_path,version,size_bytes,width,height,sha256,is_active) values(p_id,c.id,p_path,v,p_size,p_width,p_height,p_hash,true);
  update public.campaigns set template_id=p_id,updated_at=clock_timestamp() where id=c.id returning * into c;
  for old in select * from public.templates where campaign_id=c.id order by version desc offset 3 loop
    insert into private.storage_gc(bucket,path,size_bytes,owner_id) values('templates',old.storage_path,old.size_bytes,c.owner_id),('published-templates',c.id::text||'/'||old.id::text||'.png',old.size_bytes,c.owner_id) on conflict do nothing;
    delete from public.templates where id=old.id;
  end loop;
  perform private.audit(p_actor,'template','campaign',c.id);
  return to_jsonb(c);
end $$;
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
create or replace function public.public_campaign(p_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',c.id,'slug',c.slug,'title',c.title,'caption',c.caption,'templatePath',c.id::text||'/'||t.id::text||'.png','templateWidth',t.width,'templateHeight',t.height,'templateVersion',t.version)
  from public.campaigns c join public.profiles p on p.user_id=c.owner_id join public.templates t on t.id=c.template_id
  where c.slug=p_slug and c.status='published' and p.status='active';
$$;
