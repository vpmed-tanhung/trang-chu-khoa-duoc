begin;

drop policy if exists "Admin can update posts" on public.posts;
create policy "Admin can update posts"
on public.posts
for update
to authenticated
using (public.is_pharmacy_admin())
with check (public.is_pharmacy_admin() and author = 'admin');

drop policy if exists "Pharmacy staff can update drug documents" on public.drug_documents;
create policy "Pharmacy staff can update drug documents"
on public.drug_documents
for update
to authenticated
using (public.is_pharmacy_staff())
with check (public.is_pharmacy_staff());

drop policy if exists "Pharmacy staff can update drug instructions" on public.drug_instructions;
create policy "Pharmacy staff can update drug instructions"
on public.drug_instructions
for update
to authenticated
using (public.is_pharmacy_staff())
with check (public.is_pharmacy_staff());

commit;
