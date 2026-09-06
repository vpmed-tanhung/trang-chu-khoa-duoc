begin;

create or replace function public.is_pharmacy_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_pharmacy_staff();
$$;

revoke all on function public.is_pharmacy_admin() from public;
grant execute on function public.is_pharmacy_admin() to anon, authenticated;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  category text not null default 'Bản tin Dược lâm sàng',
  excerpt text,
  publish_date date not null,
  week_number smallint not null check (week_number between 1 and 5),
  author text not null default 'admin' check (author = 'admin'),
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique check (storage_path ~ '^posts/[0-9]{4}-[0-9]{2}/[a-f0-9-]+[.]pdf$'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_desc_idx on public.posts (created_at desc);

alter table public.posts enable row level security;
revoke all on table public.posts from anon, authenticated;
grant select on table public.posts to anon, authenticated;
grant insert, update, delete on table public.posts to authenticated;

drop policy if exists "Public can read posts" on public.posts;
create policy "Public can read posts"
on public.posts for select to anon, authenticated using (true);

drop policy if exists "Admin can insert posts" on public.posts;
create policy "Admin can insert posts"
on public.posts for insert to authenticated
with check (
  public.is_pharmacy_admin()
  and created_by = auth.uid()
  and author = 'admin'
);

drop policy if exists "Admin can update posts" on public.posts;
create policy "Admin can update posts"
on public.posts for update to authenticated
using (public.is_pharmacy_admin())
with check (
  public.is_pharmacy_admin()
  and author = 'admin'
);

drop policy if exists "Admin can delete posts" on public.posts;
create policy "Admin can delete posts"
on public.posts for delete to authenticated
using (public.is_pharmacy_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drug-documents', 'drug-documents', true, 26214400, array['application/pdf']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin can upload post PDFs" on storage.objects;
create policy "Admin can upload post PDFs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'drug-documents'
  and name like 'posts/%'
  and public.is_pharmacy_admin()
  and storage.extension(name) = 'pdf'
);

drop policy if exists "Admin can update post PDFs" on storage.objects;
create policy "Admin can update post PDFs"
on storage.objects for update to authenticated
using (bucket_id = 'drug-documents' and name like 'posts/%' and public.is_pharmacy_admin())
with check (
  bucket_id = 'drug-documents'
  and name like 'posts/%'
  and public.is_pharmacy_admin()
  and storage.extension(name) = 'pdf'
);

drop policy if exists "Admin can delete post PDFs" on storage.objects;
create policy "Admin can delete post PDFs"
on storage.objects for delete to authenticated
using (bucket_id = 'drug-documents' and name like 'posts/%' and public.is_pharmacy_admin());

commit;
