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

-- =========================================================
-- 4) Row Level Security
-- =========================================================
-- Accès uniquement aux utilisateurs connectés, sur leurs propres lignes.
-- Les opérations serveur (déduction de crédits dans /api/gen) doivent
-- utiliser la clé SUPABASE_SERVICE_ROLE_KEY qui bypass RLS — sinon
-- elles seront bloquées.

alter table user_credits enable row level security;
alter table profiles enable row level security;

-- user_credits : un utilisateur lit/modifie uniquement sa propre ligne
drop policy if exists "user_credits_select_own" on user_credits;
create policy "user_credits_select_own" on user_credits
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_credits_insert_own" on user_credits;
create policy "user_credits_insert_own" on user_credits
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_credits_update_own" on user_credits;
create policy "user_credits_update_own" on user_credits
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- profiles : un utilisateur lit/écrit uniquement sa propre fiche
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- 5) Bucket Storage pour les logos (public en lecture)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Lecture publique (les logos sont affichés sur les docs générés)
drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read" on storage.objects
  for select
  using (bucket_id = 'logos');

-- Écriture : utilisateur authentifié, uniquement dans son propre dossier (préfixe = user_id)
drop policy if exists "logos_authenticated_write" on storage.objects;
create policy "logos_authenticated_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "logos_authenticated_update" on storage.objects;
create policy "logos_authenticated_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "logos_authenticated_delete" on storage.objects;
create policy "logos_authenticated_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================================================
-- 6) Opérations (campagnes / commandes par contact)
-- =========================================================
-- Une opération = un contexte produit/prestation. Les documents générés
-- sont rattachés à une opération, qui réutilise le branding du contact.
create table if not exists operations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  images text[] default '{}',
  created_at timestamptz default now()
);

create index if not exists operations_contact_id_idx on operations(contact_id);
create index if not exists operations_user_id_idx on operations(user_id);

alter table operations enable row level security;

drop policy if exists "operations_select_own" on operations;
create policy "operations_select_own" on operations
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "operations_insert_own" on operations;
create policy "operations_insert_own" on operations
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "operations_update_own" on operations;
create policy "operations_update_own" on operations
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "operations_delete_own" on operations;
create policy "operations_delete_own" on operations
  for delete to authenticated
  using (auth.uid() = user_id);

-- Lien documents <-> operations (nullable : anciens documents sans opération)
alter table documents add column if not exists operation_id uuid references operations(id) on delete cascade;
create index if not exists documents_operation_id_idx on documents(operation_id);

-- =========================================================
-- 7) Bucket Storage pour les images d'opérations (public en lecture)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('operations', 'operations', true)
on conflict (id) do nothing;

drop policy if exists "operations_public_read" on storage.objects;
create policy "operations_public_read" on storage.objects
  for select
  using (bucket_id = 'operations');

drop policy if exists "operations_authenticated_write" on storage.objects;
create policy "operations_authenticated_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'operations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "operations_authenticated_update" on storage.objects;
create policy "operations_authenticated_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'operations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "operations_authenticated_delete" on storage.objects;
create policy "operations_authenticated_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'operations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
