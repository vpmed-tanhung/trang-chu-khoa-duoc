begin;

create table if not exists public.pharmacy_staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pharmacy_staff_members enable row level security;
revoke all on table public.pharmacy_staff_members from anon, authenticated;

create or replace function public.is_pharmacy_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pharmacy_staff_members
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_pharmacy_staff() from public;
grant execute on function public.is_pharmacy_staff() to anon, authenticated;

create table if not exists public.drug_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  signed_date date not null,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique check (storage_path ~ '^[0-9]{4}-[0-9]{2}/[a-f0-9-]+[.]pdf$'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (title, signed_date)
);

alter table public.drug_documents enable row level security;
revoke all on table public.drug_documents from anon, authenticated;
grant select on table public.drug_documents to anon, authenticated;
grant insert, update, delete on table public.drug_documents to authenticated;

drop policy if exists "Public can read drug documents" on public.drug_documents;
create policy "Public can read drug documents"
on public.drug_documents
for select
to anon, authenticated
using (true);

drop policy if exists "Pharmacy staff can insert drug documents" on public.drug_documents;
create policy "Pharmacy staff can insert drug documents"
on public.drug_documents
for insert
to authenticated
with check (public.is_pharmacy_staff() and created_by = auth.uid());

drop policy if exists "Pharmacy staff can update drug documents" on public.drug_documents;
create policy "Pharmacy staff can update drug documents"
on public.drug_documents
for update
to authenticated
using (public.is_pharmacy_staff())
with check (public.is_pharmacy_staff());

drop policy if exists "Pharmacy staff can delete drug documents" on public.drug_documents;
create policy "Pharmacy staff can delete drug documents"
on public.drug_documents
for delete
to authenticated
using (public.is_pharmacy_staff());

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'drug-documents',
  'drug-documents',
  true,
  26214400,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Pharmacy staff can upload drug PDFs" on storage.objects;
create policy "Pharmacy staff can upload drug PDFs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'drug-documents'
  and public.is_pharmacy_staff()
  and storage.extension(name) = 'pdf'
);

drop policy if exists "Pharmacy staff can update drug PDFs" on storage.objects;
create policy "Pharmacy staff can update drug PDFs"
on storage.objects
for update
to authenticated
using (bucket_id = 'drug-documents' and public.is_pharmacy_staff())
with check (
  bucket_id = 'drug-documents'
  and public.is_pharmacy_staff()
  and storage.extension(name) = 'pdf'
);

drop policy if exists "Pharmacy staff can delete drug PDFs" on storage.objects;
create policy "Pharmacy staff can delete drug PDFs"
on storage.objects
for delete
to authenticated
using (bucket_id = 'drug-documents' and public.is_pharmacy_staff());

create table if not exists public.drug_instructions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  keywords text not null default '',
  signed_date date not null,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique check (storage_path ~ '^hdsd/[0-9]{4}-[0-9]{2}/[a-f0-9-]+[.]pdf$'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (title, signed_date)
);

alter table public.drug_instructions enable row level security;
revoke all on table public.drug_instructions from anon, authenticated;
grant select on table public.drug_instructions to anon, authenticated;
grant insert, update, delete on table public.drug_instructions to authenticated;

drop policy if exists "Public can read drug instructions" on public.drug_instructions;
create policy "Public can read drug instructions"
on public.drug_instructions
for select
to anon, authenticated
using (true);

drop policy if exists "Pharmacy staff can insert drug instructions" on public.drug_instructions;
create policy "Pharmacy staff can insert drug instructions"
on public.drug_instructions
for insert
to authenticated
with check (public.is_pharmacy_staff() and created_by = auth.uid());

drop policy if exists "Pharmacy staff can update drug instructions" on public.drug_instructions;
create policy "Pharmacy staff can update drug instructions"
on public.drug_instructions
for update
to authenticated
using (public.is_pharmacy_staff())
with check (public.is_pharmacy_staff());

drop policy if exists "Pharmacy staff can delete drug instructions" on public.drug_instructions;
create policy "Pharmacy staff can delete drug instructions"
on public.drug_instructions
for delete
to authenticated
using (public.is_pharmacy_staff());

create table if not exists public.content_migrations (
  migration_key text primary key check (migration_key in ('drug_documents_v1', 'drug_instructions_v1')),
  completed_by uuid not null default auth.uid() references auth.users(id),
  completed_at timestamptz not null default now()
);

alter table public.content_migrations enable row level security;
revoke all on table public.content_migrations from anon, authenticated;
grant select on table public.content_migrations to anon, authenticated;
grant insert on table public.content_migrations to authenticated;

drop policy if exists "Public can read content migrations" on public.content_migrations;
create policy "Public can read content migrations"
on public.content_migrations for select to anon, authenticated using (true);

drop policy if exists "Pharmacy staff can complete content migrations" on public.content_migrations;
create policy "Pharmacy staff can complete content migrations"
on public.content_migrations for insert to authenticated
with check (public.is_pharmacy_staff() and completed_by = auth.uid());

commit;
