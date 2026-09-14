create extension if not exists pgcrypto;

create table if not exists public.qc_records (
  id uuid primary key default gen_random_uuid(),
  client_record_id text not null unique,
  created_at timestamptz not null default now(),
  mode text not null check (mode in ('aceton-nacl', 'mibi-seppak')),
  drug_name text not null,
  performed_date date not null,
  lot_number text,
  manufacturer text,
  bound_activity_mci numeric(18,6),
  aceton_top_uci numeric(18,6),
  aceton_bot_uci numeric(18,6),
  nacl_top_uci numeric(18,6),
  nacl_bot_uci numeric(18,6),
  sep_pak_uci numeric(18,6),
  ethanol_uci numeric(18,6),
  free_percent numeric(12,6),
  hydrolyzed_percent numeric(12,6),
  bound_percent numeric(12,6) not null,
  ph numeric(12,6),
  mo99_uci numeric(18,6),
  aluminum_result text check (aluminum_result is null or aluminum_result in ('pass', 'fail')),
  compounder text,
  qc_operator text,
  constraint qc_records_non_negative_measurements check (
    (bound_activity_mci is null or bound_activity_mci >= 0)
    and (aceton_top_uci is null or aceton_top_uci >= 0)
    and (aceton_bot_uci is null or aceton_bot_uci >= 0)
    and (nacl_top_uci is null or nacl_top_uci >= 0)
    and (nacl_bot_uci is null or nacl_bot_uci >= 0)
    and (sep_pak_uci is null or sep_pak_uci >= 0)
    and (ethanol_uci is null or ethanol_uci >= 0)
    and (mo99_uci is null or mo99_uci >= 0)
  ),
  constraint qc_records_mode_measurements check (
    (
      mode = 'aceton-nacl'
      and aceton_top_uci is not null
      and aceton_bot_uci is not null
      and nacl_top_uci is not null
      and nacl_bot_uci is not null
      and aceton_top_uci + aceton_bot_uci > 0
      and nacl_top_uci + nacl_bot_uci > 0
      and free_percent is not null
      and hydrolyzed_percent is not null
    )
    or
    (
      mode = 'mibi-seppak'
      and sep_pak_uci is not null
      and ethanol_uci is not null
      and sep_pak_uci + ethanol_uci > 0
      and free_percent is null
      and hydrolyzed_percent is null
    )
  )
);

create index if not exists qc_records_performed_date_idx
  on public.qc_records (performed_date desc);

create index if not exists qc_records_created_at_idx
  on public.qc_records (created_at desc);

alter table public.qc_records enable row level security;

revoke all on table public.qc_records from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select, insert, delete on table public.qc_records to anon, authenticated;

drop policy if exists "qc_records_read_history" on public.qc_records;
create policy "qc_records_read_history"
  on public.qc_records
  for select
  to anon, authenticated
  using (true);

drop policy if exists "qc_records_insert_valid" on public.qc_records;
create policy "qc_records_insert_valid"
  on public.qc_records
  for insert
  to anon, authenticated
  with check (
    length(trim(client_record_id)) > 0
    and length(trim(drug_name)) > 0
    and mode in ('aceton-nacl', 'mibi-seppak')
    and bound_percent is not null
  );

drop policy if exists "qc_records_delete_history" on public.qc_records;
create policy "qc_records_delete_history"
  on public.qc_records
  for delete
  to anon, authenticated
  using (true);

-- Không cấp UPDATE cho anon/authenticated.
-- DELETE được cấp để nút xóa có thể xóa đồng thời localStorage và Supabase.
