-- Cosmic Store: preços por Robux, operação e relatórios. Aplicar após 202610040002.
-- Não altera os preços atuais nem habilita cancelamentos automáticos.
begin;
alter table public.categories add column if not exists robux_pricing_enabled boolean not null default false;
alter table public.games add column if not exists delivery_instructions text not null default '' check(char_length(delivery_instructions)<=2000);
alter table public.products add column if not exists delivery_instructions text not null default '' check(char_length(delivery_instructions)<=2000);
alter table public.products add column if not exists robux_quantity integer check(robux_quantity between 1 and 1000000);
alter table public.products add column if not exists pricing_reference numeric(22,10) check(pricing_reference>0);
alter table public.products add column if not exists pricing_rate numeric(10,2) check(pricing_rate between 0.01 and 10000);
alter table public.products add column if not exists pricing_locked boolean not null default false;
alter table public.products add column if not exists low_stock_threshold integer not null default 2 check(low_stock_threshold between 0 and 100000);
alter table public.products add column if not exists ops_version bigint not null default 0;
alter table public.order_items add column if not exists delivery_instructions jsonb not null default '[]'::jsonb;

create table if not exists public.catalog_events (
 id uuid primary key default gen_random_uuid(),entity text not null,entity_id uuid not null,
 label text not null,action text not null,actor_id uuid references public.profiles(id) on delete set null,
 before_data jsonb,after_data jsonb,batch_id uuid,created_at timestamptz not null default now()
);
create index if not exists catalog_events_created on public.catalog_events(created_at desc,id);
create table if not exists public.price_batches (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.profiles(id),
 new_rate numeric(10,2) not null,initial_rate numeric(10,2) not null,
 status text not null default 'draft' check(status in('draft','applied','reverted')),
 changes jsonb not null,skipped integer not null default 0,created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 minutes',applied_at timestamptz,reverted_at timestamptz
);
create table if not exists public.product_import_batches (
 id uuid primary key,actor_id uuid not null references public.profiles(id),product_count integer not null,created_at timestamptz not null default now()
);
create table if not exists public.admin_work_items (
 id uuid primary key default gen_random_uuid(),order_id uuid unique references public.orders(id) on delete cascade,
 ticket_id uuid unique references public.support_tickets(id) on delete cascade,
 assigned_to uuid references public.profiles(id) on delete set null,updated_at timestamptz not null default now(),
 check((order_id is null)<>(ticket_id is null))
);
create table if not exists public.admin_work_notes (
 id uuid primary key default gen_random_uuid(),work_id uuid not null references public.admin_work_items(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,body text not null check(char_length(trim(body)) between 2 and 2000),created_at timestamptz not null default now()
);
create table if not exists public.admin_quick_replies (
 id uuid primary key default gen_random_uuid(),scope text not null check(scope in('order','support')),
 label text not null check(char_length(trim(label)) between 2 and 40),body text not null check(char_length(trim(body)) between 2 and 2000),
 game_id uuid references public.games(id) on delete set null,is_active boolean not null default true,display_order integer not null default 0,
 updated_at timestamptz not null default now(),unique(scope,label)
);
insert into public.admin_quick_replies(scope,label,body) values
 ('order','Entrega','Olá! O pagamento foi confirmado e estamos preparando sua entrega. Confira se o nickname informado no pedido está correto.'),
 ('order','Nickname','Pode confirmar seu nickname no jogo para combinarmos a entrega?'),
 ('order','Disponibilidade','Estamos prontos para entregar. Você está disponível no jogo agora?'),
 ('support','Boas-vindas','Olá! Vamos ajudar você. Pode contar um pouco mais sobre o que aconteceu?'),
 ('support','Código do pedido','Pode informar o código do seu pedido para verificarmos?'),
 ('support','Resolvido','Conseguimos resolver sua solicitação. Precisa de ajuda com mais alguma coisa?') on conflict(scope,label) do nothing;
create table if not exists public.store_ops_settings (
 id boolean primary key default true check(id),auto_close_enabled boolean not null default false,
 auto_close_hours integer not null default 72 check(auto_close_hours between 24 and 720),
 enabled_at timestamptz,enabled_by uuid references public.profiles(id) on delete set null,
 last_run_at timestamptz,last_run_count integer,updated_at timestamptz not null default now()
);
insert into public.store_ops_settings(id) values(true) on conflict do nothing;
create table if not exists public.store_issues (
 id uuid primary key default gen_random_uuid(),fingerprint text not null unique,source text not null,
 path text not null,message text not null,occurrences integer not null default 1,
 first_seen timestamptz not null default now(),last_seen timestamptz not null default now(),resolved_at timestamptz
);
create index if not exists store_issues_open on public.store_issues(last_seen desc) where resolved_at is null;

do $$ declare t text;begin
 foreach t in array array['catalog_events','price_batches','product_import_batches','admin_work_items','admin_work_notes','admin_quick_replies','store_ops_settings','store_issues'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.admin_quick_replies to authenticated;
drop policy if exists "Equipe consulta respostas" on public.admin_quick_replies;
create policy "Equipe consulta respostas" on public.admin_quick_replies for select to authenticated using(public.is_store_admin());

create or replace function public.ops_assert_admin(p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_actor is null or not public.is_store_admin(p_actor) then raise exception 'Acesso administrativo negado.'; end if;
 perform set_config('cosmic.actor',p_actor::text,true);
end $$;
create or replace function public.ops_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare a uuid;claims jsonb;headers jsonb;
begin
 a:=nullif(current_setting('cosmic.actor',true),'')::uuid;
 if a is null then
  claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
  if coalesce(claims->>'role',current_setting('request.jwt.claim.role',true))='service_role' then
   headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
   a:=nullif(headers->>'x-cosmic-actor','')::uuid;
  else a:=auth.uid();end if;
 end if;
 if public.is_store_admin(a) then return a;end if;return null;
exception when others then return null;
end $$;
create or replace function public.ops_product_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.pricing_rate is not null then new.pricing_reference:=new.price*34/new.pricing_rate;end if;
  return new;
 end if;
 if coalesce(current_setting('cosmic.price_batch',true),'')='' and (new.price is distinct from old.price or new.pricing_rate is distinct from old.pricing_rate) then
  new.pricing_locked:=true;
  if new.pricing_rate is not null then new.pricing_reference:=new.price*34/new.pricing_rate;else new.pricing_reference:=null;end if;
 end if;
 if (to_jsonb(new)-'ops_version') is distinct from (to_jsonb(old)-'ops_version') then new.ops_version:=old.ops_version+1;else new.ops_version:=old.ops_version;end if;
 return new;
end $$;
drop trigger if exists ops_product_revision on public.products;
create trigger ops_product_revision before insert or update on public.products for each row execute function public.ops_product_revision();
create or replace function public.ops_catalog_event() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb;v jsonb;
begin
 if tg_op<>'INSERT' then b:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then a:=to_jsonb(new);end if;
 if a is not distinct from b then return null;end if;
 v:=coalesce(a,b);
 insert into public.catalog_events(entity,entity_id,label,action,actor_id,before_data,after_data,batch_id)
 values(tg_table_name,(v->>'id')::uuid,coalesce(v->>'name','Item'),lower(tg_op),public.ops_actor(),b,a,nullif(current_setting('cosmic.price_batch',true),'')::uuid);
 return null;
end $$;
do $$ declare t text;begin foreach t in array array['products','categories','games','combos'] loop
 execute format('drop trigger if exists ops_catalog_event on public.%I',t);
 execute format('create trigger ops_catalog_event after insert or update or delete on public.%I for each row execute function public.ops_catalog_event()',t);
end loop;end $$;

create or replace function public.ops_set_categories(p_actor uuid,p_ids uuid[],p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ops_assert_admin(p_actor);
 if coalesce(cardinality(p_ids),0) not between 1 and 500 or p_enabled is null then raise exception 'Selecione categorias.';end if;
 update public.categories set robux_pricing_enabled=p_enabled where id=any(p_ids);
end $$;
create or replace function public.ops_preview_prices(p_actor uuid,p_categories uuid[],p_rate numeric,p_initial numeric default 34) returns jsonb language plpgsql security definer set search_path='' as $$
declare p record;ref numeric;amount numeric;rows jsonb:='[]';batch public.price_batches%rowtype;skipped integer;
begin
 perform public.ops_assert_admin(p_actor);
 if coalesce(cardinality(p_categories),0) not between 1 and 500 or p_rate is null or p_rate not between 0.01 and 10000 or p_initial is null or p_initial not between 0.01 and 10000 or p_rate<>round(p_rate,2) or p_initial<>round(p_initial,2) then raise exception 'Selecione categorias e uma cotação válida.';end if;
 select count(*) into skipped from public.products pr join public.categories c on c.id=pr.category_id where pr.category_id=any(p_categories) and (pr.pricing_locked or not c.robux_pricing_enabled);
 for p in select pr.* from public.products pr join public.categories c on c.id=pr.category_id where pr.category_id=any(p_categories) and c.robux_pricing_enabled and not pr.pricing_locked order by pr.id limit 5001 loop
  if jsonb_array_length(rows)>=5000 then raise exception 'Divida o reajuste em até 5.000 produtos por vez.';end if;
  ref:=coalesce(p.pricing_reference,p.price*34/p_initial);amount:=round(ref*p_rate/34,2);
  if amount not between 0.01 and 999999.99 then raise exception 'O preço calculado de % ficou fora do limite.',p.name;end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name,'category_id',p.category_id,'before',p.price,'after',amount,'reference_before',p.pricing_reference,'rate_before',p.pricing_rate,'reference',ref,'version',p.ops_version));
 end loop;
 if jsonb_array_length(rows)=0 then raise exception 'Nenhum produto elegível. Habilite as categorias e confira as proteções manuais.';end if;
 insert into public.price_batches(actor_id,new_rate,initial_rate,changes,skipped) values(p_actor,p_rate,p_initial,rows,skipped) returning * into batch;
 return to_jsonb(batch);
end $$;
create or replace function public.ops_apply_prices(p_actor uuid,p_batch uuid) returns integer language plpgsql security definer set search_path='' as $$
declare b public.price_batches%rowtype;r jsonb;p public.products%rowtype;rows jsonb:='[]';v bigint;
begin
 perform public.ops_assert_admin(p_actor);
 select * into b from public.price_batches where id=p_batch for update;
 if not found or b.actor_id<>p_actor then raise exception 'Prévia não encontrada para sua conta.';end if;
 if b.status='applied' then return jsonb_array_length(b.changes);end if;
 if b.status<>'draft' or b.expires_at<now() then raise exception 'A prévia expirou. Calcule novamente.';end if;
 perform c.id from public.categories c where c.id in(select (x->>'category_id')::uuid from jsonb_array_elements(b.changes) x) order by c.id for share;
 perform pr.id from public.products pr where pr.id in(select (x->>'id')::uuid from jsonb_array_elements(b.changes) x) order by pr.id for update;
 perform set_config('cosmic.price_batch',b.id::text,true);
 for r in select value from jsonb_array_elements(b.changes) loop
  select * into p from public.products where id=(r->>'id')::uuid;
  if not found or p.ops_version<>(r->>'version')::bigint or p.pricing_locked or not exists(select 1 from public.categories where id=p.category_id and robux_pricing_enabled) then raise exception 'Um produto ou categoria mudou. Refaça a prévia; nenhum preço foi alterado.';end if;
  update public.products set price=(r->>'after')::numeric,pricing_reference=(r->>'reference')::numeric,pricing_rate=b.new_rate where id=p.id returning ops_version into v;
  rows:=rows||jsonb_build_array(r||jsonb_build_object('applied_version',v));
 end loop;
 update public.price_batches set status='applied',changes=rows,applied_at=now() where id=b.id;
 perform set_config('cosmic.price_batch','',true);
 return jsonb_array_length(rows);
end $$;
create or replace function public.ops_revert_prices(p_actor uuid,p_batch uuid) returns integer language plpgsql security definer set search_path='' as $$
declare b public.price_batches%rowtype;r jsonb;p public.products%rowtype;
begin
 perform public.ops_assert_admin(p_actor);
 select * into b from public.price_batches where id=p_batch for update;
 if not found then raise exception 'Reajuste não encontrado.';end if;
 if b.status='reverted' then return 0;end if;
 if b.status<>'applied' then raise exception 'Este reajuste não foi aplicado.';end if;
 perform pr.id from public.products pr where pr.id in(select (x->>'id')::uuid from jsonb_array_elements(b.changes) x) order by pr.id for update;
 perform set_config('cosmic.price_batch',b.id::text,true);
 for r in select value from jsonb_array_elements(b.changes) loop
  select * into p from public.products where id=(r->>'id')::uuid;
  if not found or p.ops_version<>(r->>'applied_version')::bigint then raise exception 'Um produto mudou depois deste reajuste. O lote não foi desfeito para preservar as alterações posteriores.';end if;
  update public.products set price=(r->>'before')::numeric,pricing_reference=(r->>'reference_before')::numeric,pricing_rate=(r->>'rate_before')::numeric where id=p.id;
 end loop;
 update public.price_batches set status='reverted',reverted_at=now() where id=b.id;
 perform set_config('cosmic.price_batch','',true);
 return jsonb_array_length(b.changes);
end $$;

create or replace function public.ops_import_products(p_actor uuid,p_token uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb;v_slug text;v_order integer;i integer:=0;prior public.product_import_batches%rowtype;
begin
 perform public.ops_assert_admin(p_actor);
 if p_token is null or p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Importe entre 1 e 500 produtos.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('import:'||p_token::text,0));
 select * into prior from public.product_import_batches where id=p_token;
 if found then if prior.actor_id<>p_actor then raise exception 'Importação de outra conta.';end if;return prior.product_count;end if;
 select coalesce(max(display_order),0) into v_order from public.products;
 for r in select value from jsonb_array_elements(p_rows) loop
  if char_length(trim(coalesce(r->>'name',''))) not between 2 and 100 or coalesce(r->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(r->>'slug')>90 or coalesce((r->>'price')::numeric,0) not between 0.01 and 999999.99 or (r->>'price')::numeric<>round((r->>'price')::numeric,2) or coalesce((r->>'stock')::numeric,-1) not between 0 and 2147483647 or (r->>'stock')::numeric<>trunc((r->>'stock')::numeric) or coalesce(r->>'unlimited_stock','') not in('true','false') or char_length(coalesce(r->>'description',''))>2000 or char_length(coalesce(r->>'delivery_instructions',''))>2000 then raise exception 'Linha % inválida. Nenhum produto foi importado.',i+1;end if;
  if not exists(select 1 from public.categories where id=(r->>'category_id')::uuid) then raise exception 'A categoria da linha % não existe.',i+1;end if;
  if nullif(r->>'robux_quantity','') is not null and (r->>'robux_quantity')::integer not between 1 and 1000000 then raise exception 'Quantidade de Robux inválida.';end if;
  v_slug:=r->>'slug';
  if exists(select 1 from public.products where slug=v_slug) then v_slug:=left(v_slug,75)||'-'||replace(gen_random_uuid()::text,'-','');end if;
  insert into public.products(name,slug,category_id,price,stock,unlimited_stock,is_active,description,delivery_instructions,robux_quantity,pricing_rate,display_order)
  values(trim(r->>'name'),left(v_slug,100),(r->>'category_id')::uuid,(r->>'price')::numeric,(r->>'stock')::integer,(r->>'unlimited_stock')::boolean,false,r->>'description',coalesce(r->>'delivery_instructions',''),nullif(r->>'robux_quantity','')::integer,nullif(r->>'pricing_rate','')::numeric,v_order+(i+1)*10);
  i:=i+1;
 end loop;
 insert into public.product_import_batches values(p_token,p_actor,i,now());return i;
end $$;

create or replace function public.ops_snapshot_instructions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select coalesce(jsonb_agg(jsonb_build_object('name',p.name,'text',coalesce(nullif(trim(p.delivery_instructions),''),nullif(trim(g.delivery_instructions),''))) order by p.name,p.id),'[]'::jsonb)
 into new.delivery_instructions from public.products p join public.categories c on c.id=p.category_id join public.games g on g.id=c.game_id
 where (p.id=new.product_id or p.id in(select product_id from public.combo_items where combo_id=new.combo_id)) and coalesce(nullif(trim(p.delivery_instructions),''),nullif(trim(g.delivery_instructions),'')) is not null;
 return new;
end $$;
drop trigger if exists ops_snapshot_instructions on public.order_items;
create trigger ops_snapshot_instructions before insert on public.order_items for each row execute function public.ops_snapshot_instructions();
create or replace function public.ops_work_update(p_actor uuid,p_kind text,p_id uuid,p_assigned uuid,p_note text,p_expected timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare w public.admin_work_items%rowtype;
begin
 perform public.ops_assert_admin(p_actor);
 if p_kind not in('order','support') or p_id is null or char_length(coalesce(p_note,''))>2000 then raise exception 'Dados de atendimento inválidos.';end if;
 if p_assigned is not null and not public.is_store_admin(p_assigned) then raise exception 'Escolha alguém da equipe.';end if;
 if (p_kind='order' and not exists(select 1 from public.orders where id=p_id)) or (p_kind='support' and not exists(select 1 from public.support_tickets where id=p_id)) then raise exception 'Atendimento não encontrado.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work:'||p_kind||p_id::text,0));
 select * into w from public.admin_work_items where (p_kind='order' and order_id=p_id) or (p_kind='support' and ticket_id=p_id) for update;
 if found and w.updated_at is distinct from p_expected then raise exception 'Este atendimento mudou. Atualize antes de salvar.';end if;
 if not found then
  if p_expected is not null then raise exception 'Atualize o atendimento.';end if;
  insert into public.admin_work_items(order_id,ticket_id,assigned_to) values(case when p_kind='order' then p_id end,case when p_kind='support' then p_id end,p_assigned) returning * into w;
 else update public.admin_work_items set assigned_to=p_assigned,updated_at=clock_timestamp() where id=w.id;end if;
 if char_length(trim(coalesce(p_note,'')))>0 then insert into public.admin_work_notes(work_id,actor_id,body) values(w.id,p_actor,trim(p_note));end if;
 return w.id;
end $$;

create or replace function public.ops_save_settings(p_actor uuid,p_enabled boolean,p_hours integer,p_expected timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare s public.store_ops_settings%rowtype;
begin
 perform public.ops_assert_admin(p_actor);
 select * into s from public.store_ops_settings where id for update;
 if s.updated_at is distinct from p_expected then raise exception 'As configurações mudaram. Atualize a página.';end if;
 if p_enabled is null or p_hours is null or p_hours not between 24 and 720 then raise exception 'Escolha entre 24 e 720 horas.';end if;
 update public.store_ops_settings set auto_close_enabled=p_enabled,auto_close_hours=p_hours,
 enabled_at=case when p_enabled and (not s.auto_close_enabled or s.auto_close_hours<>p_hours) then now() else s.enabled_at end,
 enabled_by=p_actor,updated_at=clock_timestamp() where id;
end $$;
create or replace function public.ops_expire_orders() returns integer language plpgsql security definer set search_path='' as $$
declare s public.store_ops_settings%rowtype;o record;n integer:=0;
begin
 delete from public.price_batches where status='draft' and created_at<now()-interval '7 days';
 select * into s from public.store_ops_settings where id for update;
 if not s.auto_close_enabled or s.enabled_at is null or not public.is_store_admin(s.enabled_by) then return 0;end if;
 for o in select ord.* from public.orders ord where ord.status='awaiting_payment' and ord.proof_path is null and ord.proof_uploaded_at is null and ord.paid_at is null and ord.stock_deducted_at is null
 and greatest(ord.created_at,ord.updated_at,s.enabled_at)<now()-make_interval(hours=>s.auto_close_hours)
 and not exists(select 1 from public.order_messages m where m.order_id=ord.id and (m.attachment_path is not null or m.created_at>now()-make_interval(hours=>s.auto_close_hours)))
 and not exists(select 1 from public.admin_work_items w where w.order_id=ord.id and w.updated_at>now()-make_interval(hours=>s.auto_close_hours))
 order by ord.id limit 200 for update of ord skip locked loop
  perform public.transition_store_order(o.id,s.enabled_by,'cancelled','awaiting_payment','');
  insert into public.order_admin_events(order_id,admin_id,action,details) values(o.id,s.enabled_by,'auto:unpaid_closed',jsonb_build_object('hours',s.auto_close_hours));
  insert into public.notifications(user_id,title,body,link) values(o.user_id,'Pedido encerrado sem comprovante','O pedido '||o.order_code||' foi encerrado após o período sem comprovante. Se você realizou o Pix, fale com o suporte.','/pedidos/'||o.id::text);
  n:=n+1;
 end loop;
 update public.store_ops_settings set last_run_at=now(),last_run_count=n where id;
 delete from public.price_batches where status='draft' and created_at<now()-interval '7 days';
 return n;
end $$;
create or replace function public.ops_record_issue(p_fingerprint text,p_source text,p_path text,p_message text) returns void language plpgsql security definer set search_path='' as $$
declare fresh boolean;
begin
 if char_length(p_fingerprint) not between 1 and 100 or char_length(p_message) not between 1 and 1000 then return;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('issue:'||p_fingerprint,0));
 select true into fresh from public.store_issues where fingerprint=p_fingerprint and resolved_at is null;
 insert into public.store_issues(fingerprint,source,path,message) values(p_fingerprint,left(p_source,40),left(p_path,200),p_message)
 on conflict(fingerprint) do update set occurrences=store_issues.occurrences+1,last_seen=now(),resolved_at=null,message=excluded.message;
 if fresh is not true then insert into public.notifications(user_id,title,body,link) select user_id,'Falha registrada na loja','Confira o diagnóstico para acompanhar a ocorrência.','/admin/diagnostico' from public.admins where role in('owner','admin');end if;
end $$;

create or replace function public.ops_report(p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '367 days' then raise exception 'Escolha um período de até 366 dias.';end if;
 with paid as materialized(select * from public.orders where paid_at>=p_from and paid_at<p_to and status in('paid','preparing_delivery','delivered')),
 lines as materialized(select i.product_name,i.product_id,i.combo_id,i.quantity,(i.unit_price*i.quantity)*(o.total/nullif(coalesce(nullif(o.subtotal,0),(select sum(oi.unit_price*oi.quantity) from public.order_items oi where oi.order_id=o.id)),0)) amount,
 coalesce(g.name,case when i.combo_id is not null then 'Combos' else 'Catálogo anterior' end) game
 from paid o join public.order_items i on i.order_id=o.id left join public.products p on p.id=i.product_id left join public.categories c on c.id=p.category_id left join public.games g on g.id=c.game_id),
 items as (select product_name name,game,sum(quantity) units,round(sum(amount),2) revenue from lines group by product_name,game order by sum(amount) desc),
 days as (select to_char(paid_at at time zone 'America/Sao_Paulo','YYYY-MM-DD') as "day",count(*) orders,sum(total) revenue from paid group by 1 order by 1),
 games as (select game name,sum(quantity) units,round(sum(amount),2) revenue from lines group by game order by sum(amount) desc),
 coupons as (select coupon_code code,count(*) orders,sum(discount_total) discount,sum(total) revenue from paid where coupon_code is not null group by coupon_code order by count(*) desc)
 select jsonb_build_object('orders',(select count(*) from paid),'revenue',coalesce((select sum(total) from paid),0),'discount',coalesce((select sum(discount_total) from paid),0),
 'average',coalesce((select round(avg(total),2) from paid),0),'deliveryHours',(select round(avg(extract(epoch from (delivered_at-paid_at))/3600)::numeric,1) from paid where delivered_at>=paid_at),
 'cancelled',(select count(*) from public.orders where created_at>=p_from and created_at<p_to and status='cancelled'),
 'products',coalesce((select jsonb_agg(items) from items),'[]'),'days',coalesce((select jsonb_agg(days) from days),'[]'),
 'games',coalesce((select jsonb_agg(games) from games),'[]'),'coupons',coalesce((select jsonb_agg(coupons) from coupons),'[]')) into v;
 return v;
end $$;

create or replace function public.store_dashboard_summary()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'proofs',(select count(*) from public.orders where status in('proof_submitted','under_review')),
 'deliveries',(select count(*) from public.orders where status in('paid','preparing_delivery')),
 'products',(select count(*) from public.products),
 'lowStock',(select count(*) from public.products where is_active and not unlimited_stock and stock between 1 and low_stock_threshold),
 'outStock',(select count(*) from public.products where is_active and not unlimited_stock and stock=0),
 'support',(select count(*) from public.support_tickets where status='open'),
 'paidToday',coalesce((select sum(total) from public.orders where status in('paid','preparing_delivery','delivered') and (paid_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date),0),
 'paidMonth',coalesce((select sum(total) from public.orders where status in('paid','preparing_delivery','delivered') and date_trunc('month',paid_at at time zone 'America/Sao_Paulo')=date_trunc('month',now() at time zone 'America/Sao_Paulo')),0));
$$;

create or replace function public.ops_interest() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(t),'[]') from (select p.id,p.name,count(*) filter(where f.favorite) favorite,count(*) filter(where f.restock) restock from public.customer_product_preferences f join public.products p on p.id=f.product_id where f.favorite or f.restock group by p.id,p.name order by count(*) filter(where f.restock) desc,count(*) filter(where f.favorite) desc,p.id limit 30)t;
$$;

create or replace function public.list_store_coupons() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('uses',(select count(*) from public.orders o where o.coupon_id=c.id and o.status<>'cancelled'),'paid_uses',(select count(*) from public.orders o where o.coupon_id=c.id and o.status in('paid','preparing_delivery','delivered')),'pending_uses',(select count(*) from public.orders o where o.coupon_id=c.id and o.status in('awaiting_payment','proof_submitted','under_review','proof_rejected'))) order by c.created_at desc,c.id),'[]'::jsonb) from public.store_coupons c;
$$;

-- Permissões explícitas: somente o backend pode executar as operações privilegiadas.
do $$ declare f record;t text;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ops_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
 foreach t in array array['admin_work_items','admin_work_notes','admin_quick_replies','price_batches','store_ops_settings','store_issues','catalog_events'] loop
  execute format('drop trigger if exists store_live_signal on public.%I',t);
  execute format('create trigger store_live_signal after insert or update or delete on public.%I for each statement execute function public.signal_store_live_update(''admin'')',t);
 end loop;
end $$;
commit;
