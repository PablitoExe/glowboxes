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
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado', 'enviado', 'cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0
);

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
      when new.email = 'pablito@glowboxes.com.ar' then 'admin'
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
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

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
create policy "Users can create own orders"
on public.orders for insert
with check (auth.uid() = user_id);

drop policy if exists "Dashboard can update orders" on public.orders;
create policy "Dashboard can update orders"
on public.orders for update
using (public.is_admin())
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
create policy "Users can create own order items"
on public.order_items for insert
with check (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.order_items.order_id
      and public.orders.user_id = auth.uid()
  )
);

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

insert into public.profiles (id, full_name, role)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', email),
  case
    when email = 'pablito@glowboxes.com.ar' then 'admin'
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
