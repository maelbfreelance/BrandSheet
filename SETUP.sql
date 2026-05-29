-- =========================================================
-- BrandSheet — Setup credits, profils, stockage logos
-- À exécuter dans le SQL Editor Supabase (idempotent)
-- =========================================================

-- 1) Table credits utilisateur
create table if not exists user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 20,
  updated_at timestamptz default now()
);

-- 2) Table profil (alimente les documents générés)
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  siret text,
  address text,
  postal_code text,
  city text,
  country text default 'France',
  email_pro text,
  phone text,
  logo_url text,
  updated_at timestamptz default now()
);

-- 3) Trigger : 20 crédits à l'inscription
create or replace function init_user_credits()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into user_credits (user_id, credits)
  values (new.id, 20)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function init_user_credits();

-- Rattraper les utilisateurs déjà existants
insert into user_credits (user_id, credits)
select id, 20 from auth.users
on conflict (user_id) do nothing;

-- 4) Bucket Storage pour les logos (public en lecture)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Policies storage (lecture publique, écriture par utilisateur authentifié)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'logos_public_read') then
    create policy "logos_public_read" on storage.objects
      for select using (bucket_id = 'logos');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'logos_authenticated_write') then
    create policy "logos_authenticated_write" on storage.objects
      for insert with check (bucket_id = 'logos' and auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'logos_authenticated_update') then
    create policy "logos_authenticated_update" on storage.objects
      for update using (bucket_id = 'logos' and auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'logos_authenticated_delete') then
    create policy "logos_authenticated_delete" on storage.objects
      for delete using (bucket_id = 'logos' and auth.role() = 'authenticated');
  end if;
end$$;
