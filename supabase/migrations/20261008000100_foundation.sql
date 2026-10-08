create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 100),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','super_admin')),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null
);
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings values ('quotas', '{"campaigns":10,"published":5,"storage_bytes":31457280}', now());
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  slug text not null unique check (length(slug) between 3 and 64 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (length(description) <= 2000),
  caption text not null default '' check (length(caption) <= 5000),
  status text not null default 'draft' check (status in ('draft','published','disabled','archived')),
  template_id uuid,
  published_at timestamptz,
  disabled_reason text check (length(disabled_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or (template_id is not null and published_at is not null))
);
create index campaigns_owner_updated on public.campaigns(owner_id, updated_at desc);
create index campaigns_status_published on public.campaigns(status, published_at desc);
create table public.templates (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  storage_path text not null unique,
  version integer not null check (version > 0),
  mime_type text not null default 'image/png' check (mime_type = 'image/png'),
  size_bytes bigint not null check (size_bytes between 1 and 3145728),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  is_active boolean not null default false,
  unique (campaign_id, version),
  unique (campaign_id, id),
  check (width::bigint * height <= 16000000)
);
create unique index templates_one_active on public.templates(campaign_id) where is_active;
alter table public.campaigns add constraint campaigns_template_fk foreign key (id, template_id) references public.templates(campaign_id, id) deferrable initially deferred;
create table public.download_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  event_token uuid not null unique,
  created_at timestamptz not null default now()
);
create index download_events_campaign_date on public.download_events(campaign_id, created_at desc);
create index download_events_retention on public.download_events(created_at);
create table public.campaign_daily_stats (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  stat_date date not null,
  download_events_count bigint not null default 0 check (download_events_count >= 0),
  primary key (campaign_id, stat_date)
);
create index daily_stats_date on public.campaign_daily_stats(stat_date);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);
create index audit_logs_created on public.audit_logs(created_at desc);
create table private.event_rate_limits (
  source_hash text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (source_hash, window_start)
);
create table private.storage_gc (
  bucket text not null,
  path text not null,
  size_bytes bigint not null,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (bucket, path)
);

create function private.verified(p_actor uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id where u.id=p_actor and u.email_confirmed_at is not null and p.status <> 'suspended');
$$;
create function private.super(p_actor uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.verified(p_actor) and exists(select 1 from public.user_roles r join public.profiles p using(user_id) where r.user_id=p_actor and r.role='super_admin' and p.status='active');
$$;
create function private.manage(p_id uuid, p_actor uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.verified(p_actor) and exists(select 1 from public.campaigns c where c.id=p_id and (c.owner_id=p_actor or private.super(p_actor)));
$$;
create function private.read_campaign(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select private.manage(p_id, auth.uid()); $$;
create function private.is_super() returns boolean language sql stable security definer set search_path = '' as $$ select private.super(auth.uid()); $$;
create function private.new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),100));
  insert into public.user_roles(user_id,role) values(new.id,'admin');
  return new;
end $$;
create trigger fadtwibbon_new_user after insert on auth.users for each row execute function private.new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.campaigns enable row level security;
alter table public.templates enable row level security;
alter table public.download_events enable row level security;
alter table public.campaign_daily_stats enable row level security;
alter table public.audit_logs enable row level security;
alter table private.event_rate_limits enable row level security;
alter table private.storage_gc enable row level security;
revoke all on public.profiles, public.user_roles, public.platform_settings, public.campaigns, public.templates, public.download_events, public.campaign_daily_stats, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.user_roles, public.platform_settings, public.campaigns, public.templates, public.campaign_daily_stats, public.audit_logs to authenticated;
grant all on public.profiles, public.user_roles, public.platform_settings, public.campaigns, public.templates, public.download_events, public.campaign_daily_stats, public.audit_logs to service_role;
grant usage on schema private to authenticated;
grant execute on function private.read_campaign(uuid), private.is_super() to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(user_id=(select auth.uid()) or (select private.is_super()));
create policy roles_read on public.user_roles for select to authenticated using(user_id=(select auth.uid()) or (select private.is_super()));
create policy quotas_read on public.platform_settings for select to authenticated using(key='quotas');
create policy campaigns_read on public.campaigns for select to authenticated using(private.read_campaign(id));
create policy templates_read on public.templates for select to authenticated using(private.read_campaign(campaign_id));
create policy daily_stats_read on public.campaign_daily_stats for select to authenticated using(private.read_campaign(campaign_id));
create policy audits_read on public.audit_logs for select to authenticated using((select private.is_super()));

create function private.lock_campaign(p_id uuid, p_actor uuid, p_expected timestamptz) returns public.campaigns language plpgsql security definer set search_path = '' as $$
declare c public.campaigns; owner uuid;
begin
  if not private.manage(p_id,p_actor) then raise exception 'FORBIDDEN'; end if;
  select owner_id into owner from public.campaigns where id=p_id;
  perform 1 from public.profiles where user_id=owner for update;
  select * into c from public.campaigns where id=p_id for update;
  if c.updated_at is distinct from p_expected then raise exception 'CONFLICT'; end if;
  return c;
end $$;
create function private.audit(p_actor uuid, p_action text, p_type text, p_target uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs(actor_id,action,target_type,target_id) values(p_actor,p_action,p_type,p_target);
$$;
create function public.viewer_context() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'status',p.status,'role',r.role,'verified',u.email_confirmed_at is not null)
  from public.profiles p join public.user_roles r using(user_id) join auth.users u on u.id=p.user_id where p.user_id=auth.uid();
$$;
create function public.save_profile(p_name text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.verified(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  if length(btrim(p_name)) > 100 then raise exception 'VALIDATION_ERROR'; end if;
  update public.profiles set display_name=btrim(p_name),updated_at=clock_timestamp() where user_id=auth.uid();
end $$;
create function public.save_campaign(p_id uuid, p_title text, p_slug text, p_description text, p_caption text, p_expected timestamptz) returns public.campaigns language plpgsql security definer set search_path = '' as $$
declare c public.campaigns; q jsonb; actor uuid := auth.uid();
begin
  if not private.verified(actor) then raise exception 'UNAUTHORIZED'; end if;
  if p_id is null then
    perform 1 from public.profiles where user_id=actor for update;
    select value into q from public.platform_settings where key='quotas';
    if (select count(*) from public.campaigns where owner_id=actor) >= (q->>'campaigns')::int then raise exception 'QUOTA_EXCEEDED'; end if;
    insert into public.campaigns(owner_id,title,slug,description,caption) values(actor,btrim(p_title),p_slug,p_description,p_caption) returning * into c;
  else
    c := private.lock_campaign(p_id,actor,p_expected);
    if c.published_at is not null and c.slug<>p_slug then raise exception 'SLUG_LOCKED'; end if;
    if c.status='disabled' and not private.super(actor) then raise exception 'FORBIDDEN'; end if;
    update public.campaigns set title=btrim(p_title),slug=p_slug,description=p_description,caption=p_caption,updated_at=clock_timestamp() where id=p_id returning * into c;
  end if;
  perform private.audit(actor,'save','campaign',c.id);
  return c;
end $$;
create function public.set_campaign_status(p_id uuid, p_status text, p_expected timestamptz) returns public.campaigns language plpgsql security definer set search_path = '' as $$
declare c public.campaigns;
begin
  c := private.lock_campaign(p_id,auth.uid(),p_expected);
  if p_status not in ('draft','archived') or (c.status='disabled' and not private.super(auth.uid())) then raise exception 'FORBIDDEN'; end if;
  update public.campaigns set status=p_status,disabled_reason=null,updated_at=clock_timestamp() where id=p_id returning * into c;
  perform private.audit(auth.uid(),p_status,'campaign',p_id);
  return c;
end $$;

create function public.commit_template(p_actor uuid,p_campaign uuid,p_expected timestamptz,p_id uuid,p_path text,p_size bigint,p_width int,p_height int,p_hash text) returns jsonb language plpgsql security definer set search_path = '' as $$
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
    insert into private.storage_gc(bucket,path,size_bytes,owner_id) values('templates',old.storage_path,old.size_bytes,c.owner_id),('published-templates',old.storage_path,old.size_bytes,c.owner_id) on conflict do nothing;
    delete from public.templates where id=old.id;
  end loop;
  perform private.audit(p_actor,'template','campaign',c.id);
  return to_jsonb(c);
end $$;
create function public.publish_campaign(p_actor uuid,p_id uuid,p_expected timestamptz) returns public.campaigns language plpgsql security definer set search_path = '' as $$
declare c public.campaigns; t public.templates; q jsonb;
begin
  c := private.lock_campaign(p_id,p_actor,p_expected);
  if c.status='disabled' and not private.super(p_actor) then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.profiles where user_id=c.owner_id and status='active') then raise exception 'APPROVAL_REQUIRED'; end if;
  select * into t from public.templates where id=c.template_id and campaign_id=c.id and is_active;
  if t.id is null or not exists(select 1 from storage.objects where bucket_id='published-templates' and name=t.storage_path) then raise exception 'VALIDATION_ERROR'; end if;
  select value into q from public.platform_settings where key='quotas';
  if c.status<>'published' and (select count(*) from public.campaigns where owner_id=c.owner_id and status='published') >= (q->>'published')::int then raise exception 'QUOTA_EXCEEDED'; end if;
  update public.campaigns set status='published',published_at=coalesce(published_at,now()),disabled_reason=null,updated_at=clock_timestamp() where id=c.id returning * into c;
  perform private.audit(p_actor,'publish','campaign',c.id);
  return c;
end $$;
create function public.public_campaign(p_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',c.id,'slug',c.slug,'title',c.title,'caption',c.caption,'templatePath',t.storage_path,'templateWidth',t.width,'templateHeight',t.height,'templateVersion',t.version)
  from public.campaigns c join public.profiles p on p.user_id=c.owner_id join public.templates t on t.id=c.template_id
  where c.slug=p_slug and c.status='published' and p.status='active';
$$;

create function public.moderate_account(p_user uuid,p_status text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.super(auth.uid()) or p_user=auth.uid() or p_status not in ('active','suspended') or exists(select 1 from public.user_roles where user_id=p_user and role='super_admin') then raise exception 'FORBIDDEN'; end if;
  update public.profiles set status=p_status,updated_at=clock_timestamp() where user_id=p_user;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform private.audit(auth.uid(),p_status,'profile',p_user);
end $$;
create function public.moderate_campaign(p_id uuid,p_reason text,p_expected timestamptz) returns void language plpgsql security definer set search_path = '' as $$
declare c public.campaigns;
begin
  if not private.super(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  c := private.lock_campaign(p_id,auth.uid(),p_expected);
  if length(btrim(p_reason)) not between 1 and 500 then raise exception 'VALIDATION_ERROR'; end if;
  update public.campaigns set status='disabled',disabled_reason=btrim(p_reason),updated_at=clock_timestamp() where id=c.id;
  perform private.audit(auth.uid(),'disable','campaign',p_id);
end $$;
create function public.update_quotas(p_campaigns int,p_published int,p_storage bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.super(auth.uid()) then raise exception 'FORBIDDEN'; end if;
  if p_campaigns not between 1 and 100 or p_published not between 1 and p_campaigns or p_storage not between 3145728 and 1073741824 then raise exception 'VALIDATION_ERROR'; end if;
  update public.platform_settings set value=jsonb_build_object('campaigns',p_campaigns,'published',p_published,'storage_bytes',p_storage),updated_at=clock_timestamp() where key='quotas';
  perform private.audit(auth.uid(),'quotas','platform',null);
end $$;
create function public.dashboard_stats(p_global boolean default false) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.verified(auth.uid()) or (p_global and not private.super(auth.uid())) then raise exception 'FORBIDDEN'; end if;
  with owned as (select * from public.campaigns where p_global or owner_id=auth.uid()),
  stats as (select d.* from public.campaign_daily_stats d join owned c on c.id=d.campaign_id),
  ranking as (select c.id,c.title,c.slug,coalesce(sum(d.download_events_count),0) as downloads from owned c left join stats d on d.campaign_id=c.id group by c.id,c.title,c.slug order by downloads desc,c.title limit 10),
  series as (select day::date as day,coalesce(sum(s.download_events_count),0) as downloads from generate_series((now() at time zone 'UTC')::date-29,(now() at time zone 'UTC')::date,interval '1 day') day left join stats s on s.stat_date=day::date group by day order by day)
  select jsonb_build_object('campaigns',(select count(*) from owned),'published',(select count(*) from owned where status='published'),'downloads',(select coalesce(sum(download_events_count),0) from stats),'last7',(select coalesce(sum(download_events_count),0) from stats where stat_date>=(now() at time zone 'UTC')::date-6),'last30',(select coalesce(sum(download_events_count),0) from stats where stat_date>=(now() at time zone 'UTC')::date-29),'storageBytes',(select coalesce(sum(t.size_bytes),0) from public.templates t join owned c on c.id=t.campaign_id),'users',case when p_global then (select count(*) from public.profiles) else null end,'ranking',(select coalesce(jsonb_agg(ranking),'[]') from ranking),'series',(select coalesce(jsonb_agg(series),'[]') from series)) into result;
  return result;
end $$;

create function public.accept_download(p_campaign uuid,p_token uuid,p_source text) returns text language plpgsql security definer set search_path = '' as $$
declare hits int; inserted int; rate_window timestamptz := date_trunc('minute',now());
begin
  if length(p_source)<>64 or p_source !~ '^[a-f0-9]+$' then raise exception 'VALIDATION_ERROR'; end if;
  if not exists(select 1 from public.campaigns c join public.profiles p on p.user_id=c.owner_id where c.id=p_campaign and c.status='published' and p.status='active') then return 'not_found'; end if;
  if exists(select 1 from public.download_events where event_token=p_token) then return 'duplicate'; end if;
  insert into private.event_rate_limits(source_hash,window_start) values(p_source,rate_window) on conflict(source_hash,window_start) do update set count=private.event_rate_limits.count+1 returning count into hits;
  if hits>30 then return 'rate_limited'; end if;
  insert into public.download_events(campaign_id,event_token) values(p_campaign,p_token) on conflict(event_token) do nothing;
  get diagnostics inserted = row_count;
  if inserted=0 then return 'duplicate'; end if;
  insert into public.campaign_daily_stats(campaign_id,stat_date,download_events_count) values(p_campaign,(now() at time zone 'UTC')::date,1) on conflict(campaign_id,stat_date) do update set download_events_count=public.campaign_daily_stats.download_events_count+1;
  return 'accepted';
end $$;
create function public.storage_garbage(p_owner uuid default null) returns setof private.storage_gc language sql security definer set search_path = '' as $$ select * from private.storage_gc where p_owner is null or owner_id=p_owner order by created_at limit 100; $$;
create function public.ack_storage_garbage(p_bucket text,p_path text) returns void language sql security definer set search_path = '' as $$ delete from private.storage_gc where bucket=p_bucket and path=p_path; $$;
create function public.prune_analytics() returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.download_events where created_at<now()-interval '30 days';
  delete from private.event_rate_limits where window_start<now()-interval '1 day';
  delete from public.audit_logs where created_at<now()-interval '180 days';
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('templates','templates',false,3145728,array['image/png']),
  ('published-templates','published-templates',true,3145728,array['image/png']);
create policy template_private_read on storage.objects for select to authenticated using(bucket_id='templates' and exists(select 1 from public.templates t where t.storage_path=name and private.read_campaign(t.campaign_id)));

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.read_campaign(uuid), private.is_super() to authenticated;
revoke execute on function public.viewer_context(), public.save_profile(text), public.save_campaign(uuid,text,text,text,text,timestamptz), public.set_campaign_status(uuid,text,timestamptz), public.commit_template(uuid,uuid,timestamptz,uuid,text,bigint,int,int,text), public.publish_campaign(uuid,uuid,timestamptz), public.public_campaign(text), public.moderate_account(uuid,text), public.moderate_campaign(uuid,text,timestamptz), public.update_quotas(int,int,bigint), public.dashboard_stats(boolean), public.accept_download(uuid,uuid,text), public.storage_garbage(uuid), public.ack_storage_garbage(text,text), public.prune_analytics() from public,anon,authenticated;
grant execute on function public.viewer_context(), public.save_profile(text), public.save_campaign(uuid,text,text,text,text,timestamptz), public.set_campaign_status(uuid,text,timestamptz), public.moderate_account(uuid,text), public.moderate_campaign(uuid,text,timestamptz), public.update_quotas(int,int,bigint), public.dashboard_stats(boolean) to authenticated;
grant execute on function public.commit_template(uuid,uuid,timestamptz,uuid,text,bigint,int,int,text), public.publish_campaign(uuid,uuid,timestamptz), public.public_campaign(text), public.accept_download(uuid,uuid,text), public.storage_garbage(uuid), public.ack_storage_garbage(text,text), public.prune_analytics() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('fadtwibbon-retention','17 * * * *','select public.prune_analytics()');
