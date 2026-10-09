-- Additive follow-up: account credentials and versioned refund policy.
-- Apply after 202610090001_robux_accounts.sql. Never reapply the old migration.
begin;

create table public.robux_account_policy (
 id smallint primary key default 1 check(id=1),
 version uuid not null default gen_random_uuid(),
 body text not null check(char_length(body) between 100 and 12000),
 updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id)
);
insert into public.robux_account_policy(id,body) values (1,$policy$Você está comprando uma conta Roblox com o saldo de Robux informado no pedido. Os dados de acesso serão liberados na área privada do pedido após a confirmação do pagamento e a preparação da entrega. Esta modalidade não envia Robux para uma conta que você já possui.

Se a conta ficar indisponível ou a Cosmic Store não conseguir cumprir a oferta, você poderá solicitar o reembolso integral. Uma alternativa só será fornecida com sua concordância, preservadas as demais opções e direitos legais. Pagamentos em duplicidade também dão direito à devolução do valor pago a mais.

O direito de arrependimento das compras à distância é de 7 dias, contado da contratação ou do recebimento do produto ou serviço, conforme o art. 49 do Código de Defesa do Consumidor. O recebimento dos dados de acesso, por si só, não representa renúncia a esse direito ou às garantias legais.

Prepare a gravação antes de abrir os dados de acesso e registre o primeiro login e a conferência do saldo. Faça login assim que os dados forem liberados. Se a conta vier sem Robux, o saldo já estiver gasto ou a senha não permitir o login, relate o problema preferencialmente nos primeiros 10 minutos após a liberação da entrega na Cosmic Store. Preserve o vídeo completo com segurança e informe o código do pedido e o horário do ocorrido.

Essas orientações ajudam a apurar o problema rapidamente. O prazo de 10 minutos é uma orientação de comunicação rápida, não uma perda automática do direito a reembolso. A ausência de vídeo, o momento do login ou um relato posterior não eliminam, por si só, os direitos assegurados em lei. A Cosmic Store analisará e providenciará a solução cabível para falhas de acesso ou divergência no saldo, incluindo reembolso nos casos devidos. Não envie senhas em canais públicos.

Para pedir cancelamento ou reembolso, utilize o Suporte do site, inclusive quando o chat do pedido estiver encerrado. Informe o código do pedido. A devolução devida será integral, sem multa, pelo meio compatível com o pagamento original. O atendimento e a devolução são feitos pela equipe; o simples cancelamento do pedido não executa uma transferência bancária.

Guarde os dados recebidos em local seguro e siga as instruções de proteção da conta. Esta política e a confirmação de sua leitura não afastam os direitos previstos na legislação brasileira.$policy$);

create table public.robux_account_policy_acceptances (
 order_id uuid primary key references public.orders(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 policy_version uuid not null, policy_body text not null,
 accepted_at timestamptz not null default now()
);
create function public.guard_account_policy_acceptance() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'O registro original de leitura da política é imutável.'; end $$;
create trigger guard_account_policy_acceptance before update on public.robux_account_policy_acceptances
for each row execute function public.guard_account_policy_acceptance();

create function public.save_robux_account_policy(p_admin_id uuid,p_body text,p_expected_version uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_policy public.robux_account_policy%rowtype;
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 if p_body is null or char_length(trim(p_body)) not between 100 and 12000 then raise exception 'A política deve ter entre 100 e 12.000 caracteres.'; end if;
 select * into v_policy from public.robux_account_policy where id=1 for update;
 if v_policy.version is distinct from p_expected_version then raise exception 'A política foi alterada por outro administrador. Atualize a página.'; end if;
 if v_policy.body=trim(p_body) then return; end if;
 update public.robux_account_policy set body=trim(p_body),version=gen_random_uuid(),updated_at=now(),updated_by=p_admin_id where id=1;
end $$;

-- Keep the original transaction as an internal implementation, but revoke direct
-- calls so neither the old route nor a client can bypass the new consent check.
revoke all on function public.create_robux_account_order(uuid,uuid,text,text,jsonb,numeric) from public,anon,authenticated,service_role;
create function public.create_robux_account_order_with_policy(
 p_user_id uuid,p_token uuid,p_code text,p_pix text,p_offer jsonb,p_expected numeric,
 p_policy_version uuid,p_policy_accepted boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_policy public.robux_account_policy%rowtype; v_result jsonb;
begin
 if p_policy_accepted is distinct from true then raise exception 'Leia e confirme a política de reembolso antes de continuar.'; end if;
 select * into v_policy from public.robux_account_policy where id=1 for share;
 if not found or v_policy.version is distinct from p_policy_version then raise exception 'A política foi atualizada. Leia a versão atual antes de continuar.'; end if;
 v_result:=public.create_robux_account_order(p_user_id,p_token,p_code,p_pix,p_offer,p_expected);
 if (v_result->>'created')::boolean then
  insert into public.robux_account_policy_acceptances(order_id,user_id,policy_version,policy_body)
  values((v_result->'order'->>'id')::uuid,p_user_id,v_policy.version,v_policy.body);
 end if;
 return v_result;
end $$;

-- Ciphertext only. Plaintext is decrypted on the server for a verified admin
-- or for the order owner AFTER delivery. No direct browser table access.
create table public.robux_account_deliveries (
 order_id uuid primary key references public.robux_account_orders(order_id) on delete cascade,
 encrypted_credentials text not null check(encrypted_credentials like 'v1:%' and char_length(encrypted_credentials) between 40 and 40000),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 updated_by uuid not null references public.profiles(id), updated_at timestamptz not null default now()
);
create function public.save_robux_account_delivery(
 p_order_id uuid,p_admin_id uuid,p_encrypted text,p_expected_updated_at timestamptz
) returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_existing public.robux_account_deliveries%rowtype;
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.order_type<>'robux_account' then raise exception 'Pedido de conta não encontrado.'; end if;
 if v_order.status not in ('paid','preparing_delivery','delivered') then raise exception 'Confirme o pagamento antes de salvar os dados da conta.'; end if;
 if not exists(select 1 from public.robux_account_orders where order_id=p_order_id and acquired_at is not null) then raise exception 'Registre a aquisição manual antes de salvar os dados.'; end if;
 if p_encrypted is null or p_encrypted not like 'v1:%' or char_length(p_encrypted) not between 40 and 40000 then raise exception 'Dados da entrega inválidos.'; end if;
 select * into v_existing from public.robux_account_deliveries where order_id=p_order_id;
 if v_existing.updated_at is distinct from p_expected_updated_at then raise exception 'A entrega foi alterada por outro administrador. Atualize a página.'; end if;
 insert into public.robux_account_deliveries(order_id,encrypted_credentials,created_by,updated_by)
 values(p_order_id,p_encrypted,p_admin_id,p_admin_id)
 on conflict(order_id) do update set encrypted_credentials=excluded.encrypted_credentials,updated_by=p_admin_id,updated_at=clock_timestamp();
 insert into public.order_admin_events(order_id,admin_id,action) values(p_order_id,p_admin_id,'account:credentials_saved');
end $$;

create function public.guard_robux_account_credentials() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.order_type='robux_account' and new.status='delivered' and old.status is distinct from new.status
 and not exists(select 1 from public.robux_account_deliveries where order_id=new.id) then
  raise exception 'Salve o usuário e a senha da conta antes de concluir a entrega.';
 end if;
 return new;
end $$;
create trigger guard_robux_account_credentials before update of status on public.orders
for each row execute function public.guard_robux_account_credentials();

-- Existing transition is kept verbatim except for its image requirement:
-- account orders use their credential guard; store orders still require an image.
create or replace function public.transition_store_order(p_order_id uuid,p_admin_id uuid,p_status text,p_expected_status text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_valid boolean;
begin
 if not public.is_store_admin(p_admin_id) then raise exception 'Acesso administrativo negado.'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 if v_order.status=p_status then return jsonb_build_object('changed',false,'order',to_jsonb(v_order)); end if;
 if v_order.status is distinct from p_expected_status then raise exception 'Outro administrador alterou este pedido. Atualize a página.'; end if;
 v_valid:=case v_order.status
  when 'awaiting_payment' then p_status='cancelled'
  when 'proof_rejected' then p_status='cancelled'
  when 'proof_submitted' then p_status in('paid','proof_rejected','cancelled')
  when 'under_review' then p_status in('paid','proof_rejected','cancelled')
  when 'paid' then p_status in('preparing_delivery','cancelled')
  when 'preparing_delivery' then p_status in('delivered','cancelled') else false end;
 if not v_valid then raise exception 'Transição de pedido inválida.'; end if;
 if p_status='proof_rejected' and char_length(trim(p_reason)) not between 5 and 300 then raise exception 'Informe um motivo de 5 a 300 caracteres.'; end if;
 if p_status='delivered' and v_order.order_type not in ('robux','robux_account') and not exists(select 1 from public.order_messages m where m.order_id=p_order_id and m.attachment_path is not null and m.attachment_type like 'image/%' and public.is_store_admin(m.user_id)) then raise exception 'Envie a imagem da entrega no chat antes de concluir.'; end if;
 if p_status='paid' then perform public.commit_order_stock(p_order_id); end if;
 if p_status='cancelled' then perform public.restore_order_stock(p_order_id); end if;
 update public.orders set status=p_status,
  paid_at=case when p_status='paid' then now() else paid_at end,
  delivery_due_at=case when p_status='paid' then now()+case when v_order.order_type='robux' then interval '7 days' else interval '24 hours' end else delivery_due_at end,
  delivered_at=case when p_status='delivered' then now() else delivered_at end,
  chat_closed_at=case when p_status='paid' then null when p_status='delivered' then now() else chat_closed_at end,
  rejection_reason=case when p_status='proof_rejected' then trim(p_reason) when p_status='paid' then null else rejection_reason end
 where id=p_order_id returning * into v_order;
 insert into public.order_admin_events(order_id,admin_id,action,details) values(p_order_id,p_admin_id,'status:'||p_status,case when p_status='proof_rejected' then jsonb_build_object('rejection_reason',trim(p_reason)) else null end);
 return jsonb_build_object('changed',true,'order',to_jsonb(v_order));
end $$;

alter table public.robux_account_policy enable row level security;
alter table public.robux_account_policy_acceptances enable row level security;
alter table public.robux_account_deliveries enable row level security;
revoke all on public.robux_account_policy,public.robux_account_policy_acceptances,public.robux_account_deliveries from public,anon,authenticated;
grant select(id,version,body,updated_at) on public.robux_account_policy to anon,authenticated;
grant select on public.robux_account_policy_acceptances to authenticated;
create policy "Public account policy" on public.robux_account_policy for select to anon,authenticated using(true);
create policy "Own account policy acceptance" on public.robux_account_policy_acceptances for select to authenticated
using(user_id=auth.uid() or public.is_store_admin());
grant all on public.robux_account_policy,public.robux_account_policy_acceptances,public.robux_account_deliveries to service_role;
revoke all on function public.save_robux_account_policy(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.create_robux_account_order_with_policy(uuid,uuid,text,text,jsonb,numeric,uuid,boolean) from public,anon,authenticated;
revoke all on function public.save_robux_account_delivery(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.guard_account_policy_acceptance(),public.guard_robux_account_credentials() from public,anon,authenticated;
grant execute on function public.save_robux_account_policy(uuid,text,uuid) to service_role;
grant execute on function public.create_robux_account_order_with_policy(uuid,uuid,text,text,jsonb,numeric,uuid,boolean) to service_role;
grant execute on function public.save_robux_account_delivery(uuid,uuid,text,timestamptz) to service_role;
commit;
