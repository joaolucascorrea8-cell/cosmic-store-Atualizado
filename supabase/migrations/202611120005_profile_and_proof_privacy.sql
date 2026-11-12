-- Preserva nickname/avatar públicos nos chats, sem expor vínculo privado com Discord.
-- Não altera perfis nem arquivos existentes.
revoke select,insert,update on public.profiles from public,anon,authenticated;
grant select(id,nickname,avatar_url,onboarding_completed,created_at,updated_at) on public.profiles to authenticated;
grant insert(id,nickname,avatar_url,onboarding_completed),update(nickname,avatar_url,onboarding_completed) on public.profiles to authenticated;
grant select,update on public.profiles to service_role;

-- Comprovante enviado é imutável. Reenvio cria outro nome, preservando o anexo anterior.
drop policy if exists "Cliente atualiza comprovante" on storage.objects;
drop policy if exists "Cliente envia comprovante" on storage.objects;
create policy "Cliente envia comprovante" on storage.objects for insert to authenticated with check(
 bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text
 and array_length(string_to_array(name,'/'),1)=3
 and exists(select 1 from public.orders o where o.id::text=(storage.foldername(name))[2]
  and o.user_id=auth.uid() and o.status in('awaiting_payment','proof_rejected'))
);
