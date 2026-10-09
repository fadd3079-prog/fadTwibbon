alter table public.user_roles add constraint user_roles_profile_fk foreign key (user_id) references public.profiles(user_id) on delete cascade;

create function public.queue_unregistered_template(p_owner uuid,p_path text,p_size bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_path not like p_owner::text||'/%' or p_size not between 1 and 3145728 then raise exception 'VALIDATION_ERROR'; end if;
  if not exists(select 1 from public.templates where storage_path=p_path) then
    insert into private.storage_gc(bucket,path,size_bytes,owner_id) values('templates',p_path,p_size,p_owner) on conflict do nothing;
  end if;
end $$;
revoke execute on function public.queue_unregistered_template(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.queue_unregistered_template(uuid,text,bigint) to service_role;
notify pgrst, 'reload schema';
