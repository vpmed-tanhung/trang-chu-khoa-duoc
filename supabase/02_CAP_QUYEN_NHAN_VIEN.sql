do $$
declare
  staff_user_id uuid;
begin
  select id into staff_user_id
  from auth.users
  where lower(email) = lower('khoaduoc@vpmed.vn')
  limit 1;

  if staff_user_id is null then
    raise exception 'Chưa có tài khoản khoaduoc@vpmed.vn trong Authentication > Users';
  end if;

  insert into public.pharmacy_staff_members (user_id)
  values (staff_user_id)
  on conflict (user_id) do nothing;
end;
$$;

select
  users.email,
  members.created_at as granted_at
from public.pharmacy_staff_members as members
join auth.users as users on users.id = members.user_id
where lower(users.email) = lower('khoaduoc@vpmed.vn');
