create function public.start_account_deletion(p_actor uuid) returns void language plpgsql security definer set search_path = '' as $$
declare pending boolean;
begin
  if not exists(select 1 from auth.users u join public.user_roles r on r.user_id=u.id where u.id=p_actor and u.email_confirmed_at is not null and r.role='admin') then raise exception 'FORBIDDEN'; end if;
  select deletion_pending into pending from public.profiles where user_id=p_actor for update;
  update public.profiles set status='suspended',deletion_pending=true,updated_at=clock_timestamp() where user_id=p_actor;
  if not pending then perform private.audit(p_actor,'delete-account','profile',p_actor); end if;
end $$;
revoke execute on function public.start_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.start_account_deletion(uuid) to service_role;
