create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'cliente' check (role in ('admin', 'empleado', 'cliente')),
  created_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_path text,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.brands
add column if not exists sort_order integer not null default 100;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  price numeric(12, 2) not null default 0,
  stock integer not null default 0,
  image_path text,
  product_video_path text,
  model_path text,
  gradient_start text not null default '#ff2da0',
  gradient_end text not null default '#7b2cff',
  is_featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_financials (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products
add column if not exists product_video_path text;

alter table public.products
add column if not exists model_path text;

alter table public.products
add column if not exists gradient_start text not null default '#ff2da0';

alter table public.products
add column if not exists gradient_end text not null default '#7b2cff';

alter table public.products
add column if not exists is_featured boolean not null default false;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  role text not null default 'empleado' check (role in ('empleado', 'delivery', 'cajero', 'encargado', 'administracion')),
  zone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status text not null default 'pedido_recibido',
  shipping_type text not null default 'delivery',
  shipping_provider text not null default 'manual',
  shipping_carrier text,
  tracking_code text,
  shipping_status text not null default 'pending',
  shipping_data jsonb,
  payment_method text not null default 'mercadopago',
  payment_status text not null default 'pendiente',
  payment_receipt_path text,
  invoice_email_sent_at timestamptz,
  invoice_email_to text,
  invoice_email_provider_id text,
  mercado_pago_preference_id text,
  mercado_pago_init_point text,
  customer_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
add column if not exists shipping_type text not null default 'delivery';

alter table public.orders
add column if not exists shipping_provider text not null default 'manual';

alter table public.orders
add column if not exists shipping_carrier text;

alter table public.orders
add column if not exists tracking_code text;

alter table public.orders
add column if not exists shipping_status text not null default 'pending';

alter table public.orders
add column if not exists shipping_data jsonb;

alter table public.orders
add column if not exists payment_method text not null default 'mercadopago';

alter table public.orders
add column if not exists payment_status text not null default 'pendiente';

alter table public.orders
add column if not exists payment_receipt_path text;

alter table public.orders
add column if not exists invoice_email_sent_at timestamptz;

alter table public.orders
add column if not exists invoice_email_to text;

alter table public.orders
add column if not exists invoice_email_provider_id text;

alter table public.orders
add column if not exists mercado_pago_preference_id text;

alter table public.orders
add column if not exists mercado_pago_init_point text;

alter table public.orders
add column if not exists customer_phone text;

alter table public.orders
add column if not exists updated_at timestamptz not null default now();

alter table public.orders
alter column status set default 'pedido_recibido';

alter table public.orders
alter column shipping_type set default 'delivery';

alter table public.orders
drop constraint if exists orders_status_check;

alter table public.orders
drop constraint if exists orders_shipping_type_check;

alter table public.orders
drop constraint if exists orders_shipping_carrier_check;

alter table public.orders
drop constraint if exists orders_shipping_provider_check;

alter table public.orders
drop constraint if exists orders_shipping_status_check;

alter table public.orders
drop constraint if exists orders_shipping_provider_type_check;

alter table public.orders
drop constraint if exists orders_correo_tracking_check;

alter table public.orders
drop constraint if exists orders_payment_method_check;

alter table public.orders
drop constraint if exists orders_payment_status_check;

alter table public.orders
drop constraint if exists orders_transfer_receipt_check;

update public.orders
set payment_method = 'mercadopago'
where payment_method = 'card';

update public.orders
set shipping_provider = case
  when shipping_type <> 'correo' then 'manual'
  when shipping_carrier in ('andreani', 'correo') then shipping_carrier
  when shipping_carrier = 'via_cargo' then 'correo'
  else 'manual'
end
where shipping_provider is null
  or shipping_provider = 'manual';

update public.orders
set shipping_carrier = 'correo'
where shipping_carrier = 'via_cargo';

alter table public.orders
add constraint orders_status_check
check (status in (
  'pedido_recibido',
  'preparando_pedido',
  'pedido_despachado',
  'en_camino',
  'en_sucursal',
  'listo_para_retirar',
  'enviado_por_correo',
  'entregado_completado',
  'cancelado',
  'pendiente',
  'pagado',
  'enviado'
));

alter table public.orders
add constraint orders_shipping_type_check
check (shipping_type in ('delivery', 'correo', 'retiro'));

alter table public.orders
add constraint orders_shipping_provider_check
check (shipping_provider in ('correo', 'andreani', 'manual'));

alter table public.orders
add constraint orders_shipping_carrier_check
check (
  shipping_carrier is null
  or shipping_carrier in ('andreani', 'correo', 'via_cargo')
);

alter table public.orders
add constraint orders_shipping_status_check
check (shipping_status in (
  'pending',
  'preparing',
  'shipped',
  'in_transit',
  'delivered'
));

alter table public.orders
add constraint orders_shipping_provider_type_check
check (
  shipping_type = 'correo'
  or shipping_provider = 'manual'
);

alter table public.orders
add constraint orders_correo_tracking_check
check (
  shipping_type <> 'correo'
  or status <> 'enviado_por_correo'
  or nullif(trim(tracking_code), '') is not null
);

alter table public.orders
add constraint orders_payment_method_check
check (payment_method in ('mercadopago', 'transfer'));

alter table public.orders
add constraint orders_payment_status_check
check (payment_status in ('pendiente', 'comprobante_cargado', 'aprobado', 'rechazado'));

alter table public.orders
add constraint orders_transfer_receipt_check
check (
  payment_method <> 'transfer'
  or nullif(trim(payment_receipt_path), '') is not null
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in (
    'pedido_recibido',
    'preparando_pedido',
    'pedido_despachado',
    'en_camino',
    'en_sucursal',
    'listo_para_retirar',
    'enviado_por_correo',
    'entregado_completado',
    'cancelado',
    'pendiente',
    'pagado',
    'enviado'
  )),
  timestamp timestamptz not null default now()
);

create index if not exists order_status_history_order_id_idx
on public.order_status_history(order_id, timestamp desc);

create index if not exists orders_shipping_tracking_idx
on public.orders(shipping_provider, tracking_code)
where tracking_code is not null;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  movement_type text not null check (movement_type in ('entrada', 'salida', 'ajuste')),
  quantity integer not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_financials enable row level security;
alter table public.branches enable row level security;
alter table public.staff_members enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.stock_movements enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when new.email in ('pablito@glowboxes.com.ar', 'pablito@glowboxes.com') then 'admin'
      else 'cliente'
    end
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = case
      when excluded.role = 'admin' or public.profiles.role = 'admin' then 'admin'
      else public.profiles.role
    end;

  return new;
end;
$$;

create or replace function public.touch_order_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_order_updated_at on public.orders;
create trigger touch_order_updated_at
before update on public.orders
for each row execute function public.touch_order_updated_at();

create or replace function public.record_order_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, status, timestamp)
    values (new.id, new.status, coalesce(new.created_at, now()));
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.order_status_history (order_id, status, timestamp)
    values (new.id, new.status, now());
  end if;

  return new;
end;
$$;

create or replace function public.create_order_with_stock(
  p_user_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_shipping_type text,
  p_shipping_carrier text,
  p_receipt_path text,
  p_customer_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  product_row record;
  order_row public.orders%rowtype;
  normalized_payment_method text := coalesce(nullif(trim(p_payment_method), ''), 'mercadopago');
  normalized_shipping_type text := coalesce(nullif(trim(p_shipping_type), ''), 'delivery');
  normalized_shipping_carrier text := coalesce(nullif(trim(p_shipping_carrier), ''), 'andreani');
  subtotal_amount numeric(12, 2) := 0;
  discount_amount numeric(12, 2) := 0;
  tax_amount numeric(12, 2) := 0;
  total_amount numeric(12, 2) := 0;
  item_count integer := 0;
begin
  if p_user_id is null then
    raise exception 'Necesitas iniciar sesion.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'El pedido no tiene productos validos.';
  end if;

  if normalized_payment_method not in ('mercadopago', 'transfer') then
    raise exception 'Metodo de pago invalido.';
  end if;

  if normalized_shipping_type not in ('delivery', 'correo', 'retiro') then
    raise exception 'Tipo de envio invalido.';
  end if;

  if normalized_shipping_type = 'correo'
    and normalized_shipping_carrier not in ('andreani', 'correo') then
    raise exception 'Correo invalido.';
  end if;

  if normalized_payment_method = 'transfer'
    and nullif(trim(coalesce(p_receipt_path, '')), '') is null then
    raise exception 'Subi el comprobante de transferencia para continuar.';
  end if;

  drop table if exists pg_temp.checkout_items;

  create temporary table checkout_items (
    product_id uuid primary key,
    quantity integer not null check (quantity > 0)
  ) on commit drop;

  insert into checkout_items (product_id, quantity)
  select product_id, sum(quantity)::integer
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  where product_id is not null
    and quantity is not null
    and quantity > 0
  group by product_id;

  select count(*) into item_count from checkout_items;

  if item_count = 0 then
    raise exception 'El pedido no tiene productos validos.';
  end if;

  for item in
    select product_id, quantity
    from checkout_items
    order by product_id
  loop
    update public.products
    set stock = stock - item.quantity
    where id = item.product_id
      and active = true
      and stock >= item.quantity
    returning id, name, price, stock
    into product_row;

    if not found then
      select name
      into product_row
      from public.products
      where id = item.product_id;

      raise exception 'No hay stock suficiente de %.',
        coalesce(product_row.name, 'uno de los productos');
    end if;

    subtotal_amount := subtotal_amount + (product_row.price * item.quantity);

    insert into public.stock_movements (
      product_id,
      movement_type,
      quantity,
      reason
    ) values (
      item.product_id,
      'salida',
      item.quantity,
      'Pedido web'
    );
  end loop;

  subtotal_amount := round(subtotal_amount, 2);
  tax_amount := case
    when normalized_payment_method = 'mercadopago'
      then round((subtotal_amount - discount_amount) * 0.066, 2)
    else 0
  end;
  total_amount := round(greatest(0, subtotal_amount - discount_amount + tax_amount), 2);

  insert into public.orders (
    user_id,
    subtotal,
    discount,
    tax,
    total,
    status,
    shipping_type,
    shipping_provider,
    shipping_carrier,
    shipping_status,
    payment_method,
    payment_status,
    payment_receipt_path,
    customer_phone
  ) values (
    p_user_id,
    subtotal_amount,
    discount_amount,
    tax_amount,
    total_amount,
    'pedido_recibido',
    normalized_shipping_type,
    case when normalized_shipping_type = 'correo' then normalized_shipping_carrier else 'manual' end,
    case when normalized_shipping_type = 'correo' then normalized_shipping_carrier else null end,
    'pending',
    normalized_payment_method,
    case when normalized_payment_method = 'transfer' then 'comprobante_cargado' else 'pendiente' end,
    nullif(trim(coalesce(p_receipt_path, '')), ''),
    nullif(trim(coalesce(p_customer_phone, '')), '')
  )
  returning *
  into order_row;

  insert into public.order_items (
    order_id,
    product_id,
    quantity,
    unit_price
  )
  select
    order_row.id,
    checkout_items.product_id,
    checkout_items.quantity,
    products.price
  from checkout_items
  join public.products on products.id = checkout_items.product_id;

  delete from public.cart_items
  where user_id = p_user_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', order_row.id,
      'subtotal', order_row.subtotal,
      'discount', order_row.discount,
      'tax', order_row.tax,
      'total', order_row.total
    ),
    'totals', jsonb_build_object(
      'subtotal', subtotal_amount,
      'discount', discount_amount,
      'tax', tax_amount,
      'total', total_amount
    )
  );
end;
$$;

revoke all on function public.create_order_with_stock(
  uuid,
  jsonb,
  text,
  text,
  text,
  text,
  text
) from public;

revoke execute on function public.create_order_with_stock(
  uuid,
  jsonb,
  text,
  text,
  text,
  text,
  text
) from anon, authenticated;

grant execute on function public.create_order_with_stock(
  uuid,
  jsonb,
  text,
  text,
  text,
  text,
  text
) to service_role;

drop trigger if exists record_order_status_history_insert on public.orders;
create trigger record_order_status_history_insert
after insert on public.orders
for each row execute function public.record_order_status_history();

drop trigger if exists record_order_status_history_update on public.orders;
create trigger record_order_status_history_update
after update of status on public.orders
for each row execute function public.record_order_status_history();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop policy if exists "Public can read active brands" on public.brands;
create policy "Public can read active brands"
on public.brands for select
using (active = true);

drop policy if exists "Dashboard can insert brands" on public.brands;
create policy "Dashboard can insert brands"
on public.brands for insert
with check (public.is_admin());

drop policy if exists "Dashboard can update brands" on public.brands;
create policy "Dashboard can update brands"
on public.brands for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Dashboard can delete brands" on public.brands;
create policy "Dashboard can delete brands"
on public.brands for delete
using (public.is_admin());

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
on public.categories for select
using (active = true);

drop policy if exists "Dashboard can insert categories" on public.categories;
create policy "Dashboard can insert categories"
on public.categories for insert
with check (public.is_admin());

drop policy if exists "Dashboard can update categories" on public.categories;
create policy "Dashboard can update categories"
on public.categories for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Dashboard can delete categories" on public.categories;
create policy "Dashboard can delete categories"
on public.categories for delete
using (public.is_admin());

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
using (active = true);

drop policy if exists "Dashboard can insert products" on public.products;
create policy "Dashboard can insert products"
on public.products for insert
with check (public.is_admin());

drop policy if exists "Dashboard can update products" on public.products;
create policy "Dashboard can update products"
on public.products for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Dashboard can delete products" on public.products;
create policy "Dashboard can delete products"
on public.products for delete
using (public.is_admin());

drop policy if exists "Dashboard can read product financials" on public.product_financials;
create policy "Dashboard can read product financials"
on public.product_financials for select
using (public.is_admin());

drop policy if exists "Dashboard can insert product financials" on public.product_financials;
create policy "Dashboard can insert product financials"
on public.product_financials for insert
with check (public.is_admin());

drop policy if exists "Dashboard can update product financials" on public.product_financials;
create policy "Dashboard can update product financials"
on public.product_financials for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Dashboard can delete product financials" on public.product_financials;
create policy "Dashboard can delete product financials"
on public.product_financials for delete
using (public.is_admin());

drop policy if exists "Dashboard can read staff members" on public.staff_members;
create policy "Dashboard can read staff members"
on public.staff_members for select
using (public.is_admin());

drop policy if exists "Dashboard can insert staff members" on public.staff_members;
create policy "Dashboard can insert staff members"
on public.staff_members for insert
with check (public.is_admin());

drop policy if exists "Dashboard can update staff members" on public.staff_members;
create policy "Dashboard can update staff members"
on public.staff_members for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Dashboard can delete staff members" on public.staff_members;
create policy "Dashboard can delete staff members"
on public.staff_members for delete
using (public.is_admin());

drop policy if exists "Dashboard can read branches" on public.branches;
create policy "Dashboard can read branches"
on public.branches for select
using (public.is_admin());

drop policy if exists "Dashboard can insert branches" on public.branches;
create policy "Dashboard can insert branches"
on public.branches for insert
with check (public.is_admin());

drop policy if exists "Dashboard can update branches" on public.branches;
create policy "Dashboard can update branches"
on public.branches for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Dashboard can delete branches" on public.branches;
create policy "Dashboard can delete branches"
on public.branches for delete
using (public.is_admin());

drop policy if exists "Dashboard can read stock movements" on public.stock_movements;
create policy "Dashboard can read stock movements"
on public.stock_movements for select
using (public.is_admin());

drop policy if exists "Dashboard can insert stock movements" on public.stock_movements;
create policy "Dashboard can insert stock movements"
on public.stock_movements for insert
with check (public.is_admin());

drop policy if exists "Dashboard can update stock movements" on public.stock_movements;
create policy "Dashboard can update stock movements"
on public.stock_movements for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Dashboard can delete stock movements" on public.stock_movements;
create policy "Dashboard can delete stock movements"
on public.stock_movements for delete
using (public.is_admin());

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
on public.profiles for select
using (public.is_admin());

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id and coalesce(role, 'cliente') = 'cliente');

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

revoke all on public.profiles from anon;
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (id, full_name) on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

drop policy if exists "Users can manage own cart" on public.cart_items;
create policy "Users can manage own cart"
on public.cart_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own wishlist" on public.wishlist_items;
create policy "Users can manage own wishlist"
on public.wishlist_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own orders" on public.orders;
create policy "Users can read own orders"
on public.orders for select
using (auth.uid() = user_id);

drop policy if exists "Dashboard can read orders" on public.orders;
create policy "Dashboard can read orders"
on public.orders for select
using (public.is_admin());

drop policy if exists "Users can create own orders" on public.orders;
-- Orders are created by the create-order Edge Function so prices and totals
-- always come from trusted product data.

drop policy if exists "Dashboard can update orders" on public.orders;
create policy "Dashboard can update orders"
on public.orders for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Dashboard can delete orders" on public.orders;
create policy "Dashboard can delete orders"
on public.orders for delete
using (public.is_admin());

drop policy if exists "Users can read own order status history" on public.order_status_history;
create policy "Users can read own order status history"
on public.order_status_history for select
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.order_status_history.order_id
      and public.orders.user_id = auth.uid()
  )
);

drop policy if exists "Dashboard can read order status history" on public.order_status_history;
create policy "Dashboard can read order status history"
on public.order_status_history for select
using (public.is_admin());

drop policy if exists "Dashboard can insert order status history" on public.order_status_history;
create policy "Dashboard can insert order status history"
on public.order_status_history for insert
with check (public.is_admin());

drop policy if exists "Users can read own order items" on public.order_items;
create policy "Users can read own order items"
on public.order_items for select
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.order_items.order_id
      and public.orders.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own order items" on public.order_items;
-- Order items are created by the create-order Edge Function for the same reason.

drop policy if exists "Dashboard can read order items" on public.order_items;
create policy "Dashboard can read order items"
on public.order_items for select
using (public.is_admin());

insert into public.brands (name, logo_path) values
  ('Glow Boxes', 'assets/img/marca1.png'),
  ('Drop', 'assets/img/marca2.png'),
  ('Toxic Shine', 'assets/img/marca3.png'),
  ('Bully Industry', 'assets/img/marca4.png'),
  ('Gloss Lab', 'assets/img/marca5.png')
on conflict (name) do nothing;

insert into public.categories (name) values
  ('Limpiadores'),
  ('Shampoo'),
  ('Interior'),
  ('Accesorios')
on conflict (name) do nothing;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('product-models', 'product-models', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('product-videos', 'product-videos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "Dashboard can upload product images" on storage.objects;
create policy "Dashboard can upload product images"
on storage.objects for insert
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Dashboard can update product images" on storage.objects;
create policy "Dashboard can update product images"
on storage.objects for update
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Dashboard can delete product images" on storage.objects;
create policy "Dashboard can delete product images"
on storage.objects for delete
using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Public can read product models" on storage.objects;
create policy "Public can read product models"
on storage.objects for select
using (bucket_id = 'product-models');

drop policy if exists "Dashboard can upload product models" on storage.objects;
create policy "Dashboard can upload product models"
on storage.objects for insert
with check (bucket_id = 'product-models' and public.is_admin());

drop policy if exists "Dashboard can update product models" on storage.objects;
create policy "Dashboard can update product models"
on storage.objects for update
using (bucket_id = 'product-models' and public.is_admin())
with check (bucket_id = 'product-models' and public.is_admin());

drop policy if exists "Dashboard can delete product models" on storage.objects;
create policy "Dashboard can delete product models"
on storage.objects for delete
using (bucket_id = 'product-models' and public.is_admin());

drop policy if exists "Public can read product videos" on storage.objects;
create policy "Public can read product videos"
on storage.objects for select
using (bucket_id = 'product-videos');

drop policy if exists "Dashboard can upload product videos" on storage.objects;
create policy "Dashboard can upload product videos"
on storage.objects for insert
with check (bucket_id = 'product-videos' and public.is_admin());

drop policy if exists "Dashboard can update product videos" on storage.objects;
create policy "Dashboard can update product videos"
on storage.objects for update
using (bucket_id = 'product-videos' and public.is_admin())
with check (bucket_id = 'product-videos' and public.is_admin());

drop policy if exists "Dashboard can delete product videos" on storage.objects;
create policy "Dashboard can delete product videos"
on storage.objects for delete
using (bucket_id = 'product-videos' and public.is_admin());

drop policy if exists "Users can upload payment receipts" on storage.objects;
create policy "Users can upload payment receipts"
on storage.objects for insert
with check (
  bucket_id = 'payment-receipts'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read own payment receipts" on storage.objects;
create policy "Users can read own payment receipts"
on storage.objects for select
using (
  bucket_id = 'payment-receipts'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own payment receipts" on storage.objects;
create policy "Users can delete own payment receipts"
on storage.objects for delete
using (
  bucket_id = 'payment-receipts'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Dashboard can read payment receipts" on storage.objects;
create policy "Dashboard can read payment receipts"
on storage.objects for select
using (bucket_id = 'payment-receipts' and public.is_admin());

insert into public.profiles (id, full_name, role)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', email),
  case
    when email in ('pablito@glowboxes.com.ar', 'pablito@glowboxes.com') then 'admin'
    else 'cliente'
  end
from auth.users
on conflict (id) do update
set
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  role = case
    when excluded.role = 'admin' or public.profiles.role = 'admin' then 'admin'
    else public.profiles.role
  end;

insert into public.product_financials (product_id, cost_price)
select id, 0
from public.products
on conflict (product_id) do nothing;

insert into public.order_status_history (order_id, status, timestamp)
select orders.id, orders.status, coalesce(orders.created_at, now())
from public.orders
where not exists (
  select 1
  from public.order_status_history
  where order_status_history.order_id = orders.id
);

-- Ejemplos de actualizacion manual:
-- update public.orders
-- set status = 'preparando_pedido'
-- where id = '00000000-0000-0000-0000-000000000000';
--
-- update public.orders
-- set shipping_type = 'correo',
--     tracking_code = 'TN123456789AR',
--     status = 'enviado_por_correo'
-- where id = '00000000-0000-0000-0000-000000000000';
