-- =============================================================
-- CLEAN IT | APP DE REPORTES DE SUPERVISIÓN
-- Ejecutar en Supabase SQL Editor
-- =============================================================

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null,
  role text not null default 'supervisor' check (role in ('admin', 'supervisor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supervisor_id uuid not null references auth.users(id) on delete cascade,
  supervisor_name text not null,
  service_date date not null,
  service_name text not null,
  location text not null,
  shift text not null,
  service_status text not null,
  attendance_status text not null,
  supplies_status text not null,
  incident_level text not null,
  corrective_action text not null,
  summary text not null,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at
before update on public.reports
for each row execute procedure public.set_updated_at();

-- =============================================================
-- PERFIL AUTOMÁTICO AL CREAR USUARIO
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'role', 'supervisor')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        updated_at = now();
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =============================================================
-- RLS
-- =============================================================
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_photos enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (auth.uid() = id or public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own_or_admin" ON public.profiles;
create policy "profiles_insert_own_or_admin"
on public.profiles
for insert
with check (auth.uid() = id or public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- REPORTS
DROP POLICY IF EXISTS "reports_select_own_or_admin" ON public.reports;
create policy "reports_select_own_or_admin"
on public.reports
for select
using (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS "reports_insert_own_or_admin" ON public.reports;
create policy "reports_insert_own_or_admin"
on public.reports
for insert
with check (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS "reports_update_own_or_admin" ON public.reports;
create policy "reports_update_own_or_admin"
on public.reports
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS "reports_delete_own_or_admin" ON public.reports;
create policy "reports_delete_own_or_admin"
on public.reports
for delete
using (user_id = auth.uid() or public.is_admin());

-- REPORT PHOTOS
DROP POLICY IF EXISTS "report_photos_select_via_parent" ON public.report_photos;
create policy "report_photos_select_via_parent"
on public.report_photos
for select
using (
  exists (
    select 1
    from public.reports r
    where r.id = report_id
      and (r.user_id = auth.uid() or public.is_admin())
  )
);

DROP POLICY IF EXISTS "report_photos_insert_via_parent" ON public.report_photos;
create policy "report_photos_insert_via_parent"
on public.report_photos
for insert
with check (
  exists (
    select 1
    from public.reports r
    where r.id = report_id
      and (r.user_id = auth.uid() or public.is_admin())
  )
);

DROP POLICY IF EXISTS "report_photos_delete_via_parent" ON public.report_photos;
create policy "report_photos_delete_via_parent"
on public.report_photos
for delete
using (
  exists (
    select 1
    from public.reports r
    where r.id = report_id
      and (r.user_id = auth.uid() or public.is_admin())
  )
);

-- =============================================================
-- STORAGE
-- Crear bucket desde SQL
-- =============================================================
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

DROP POLICY IF EXISTS "storage_read_report_photos" ON storage.objects;
create policy "storage_read_report_photos"
on storage.objects
for select
using (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "storage_insert_report_photos" ON storage.objects;
create policy "storage_insert_report_photos"
on storage.objects
for insert
with check (
  bucket_id = 'report-photos'
  and auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "storage_update_report_photos" ON storage.objects;
create policy "storage_update_report_photos"
on storage.objects
for update
using (
  bucket_id = 'report-photos'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'report-photos'
  and auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "storage_delete_report_photos" ON storage.objects;
create policy "storage_delete_report_photos"
on storage.objects
for delete
using (
  bucket_id = 'report-photos'
  and auth.role() = 'authenticated'
);
