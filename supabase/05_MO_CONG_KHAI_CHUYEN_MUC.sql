begin;

-- Khách chỉ được đọc. Quyền thêm/sửa/xóa vẫn yêu cầu tài khoản Khoa Dược.
grant select on table public.drug_documents to anon, authenticated;
grant select on table public.drug_instructions to anon, authenticated;
grant select on table public.posts to anon, authenticated;

drop policy if exists "Public can read drug documents" on public.drug_documents;
create policy "Public can read drug documents"
on public.drug_documents for select to anon, authenticated using (true);

drop policy if exists "Public can read drug instructions" on public.drug_instructions;
create policy "Public can read drug instructions"
on public.drug_instructions for select to anon, authenticated using (true);

drop policy if exists "Public can read posts" on public.posts;
create policy "Public can read posts"
on public.posts for select to anon, authenticated using (true);

update storage.buckets
set public = true
where id = 'drug-documents';

commit;
