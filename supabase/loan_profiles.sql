-- KredimGeldi: müşterilerin kredi başvurusu için gereken kişisel bilgileri.
-- Supabase panelinde SQL Editor > New query'ye yapıştırıp "Run" deyin. Birden fazla
-- çalıştırmak zararsızdır.
--
-- Row Level Security açıktır: her kullanıcı yalnızca kendi satırını görebilir,
-- ekleyebilir, güncelleyebilir ve silebilir. Sitedeki publishable key ile başka
-- birinin bilgilerine erişmek mümkün değildir.

create table if not exists public.loan_profiles (
    user_id               uuid primary key references auth.users (id) on delete cascade,

    -- Kimlik bilgileri
    first_name            text,
    last_name             text,
    tc_kimlik_no          text check (tc_kimlik_no ~ '^[1-9][0-9]{10}$'),
    birth_date            date,
    gender                text,
    marital_status        text,
    education             text,
    dependents            smallint check (dependents between 0 and 20),

    -- İletişim ve adres
    phone                 text check (phone ~ '^5[0-9]{9}$'),
    city                  text,
    district              text,
    address               text check (char_length(address) <= 500),
    postal_code           text check (postal_code ~ '^[0-9]{5}$'),
    residence_status      text,

    -- Çalışma ve gelir
    employment_status     text,
    occupation            text,
    employer_name         text,
    job_start_date        date,
    monthly_income        numeric(12, 2) check (monthly_income >= 0),
    other_income          numeric(12, 2) check (other_income >= 0),
    monthly_debt_payments numeric(12, 2) check (monthly_debt_payments >= 0),
    salary_bank           text,

    -- Kredi tercihi
    loan_type             text,
    loan_amount           numeric(12, 2) check (loan_amount >= 0),
    loan_term_months      smallint check (loan_term_months between 1 and 240),

    -- Onaylar
    consent_kvkk          boolean not null default false,
    consent_kvkk_at       timestamptz,
    consent_accuracy      boolean not null default false,

    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

alter table public.loan_profiles enable row level security;

drop policy if exists "Kendi profilini görebilir" on public.loan_profiles;
create policy "Kendi profilini görebilir" on public.loan_profiles
    for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Kendi profilini oluşturabilir" on public.loan_profiles;
create policy "Kendi profilini oluşturabilir" on public.loan_profiles
    for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Kendi profilini güncelleyebilir" on public.loan_profiles;
create policy "Kendi profilini güncelleyebilir" on public.loan_profiles
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Kendi profilini silebilir" on public.loan_profiles;
create policy "Kendi profilini silebilir" on public.loan_profiles
    for delete to authenticated using ((select auth.uid()) = user_id);

-- Giriş yapmamış ziyaretçiler tabloya hiç erişemez.
revoke all on public.loan_profiles from anon;
grant select, insert, update, delete on public.loan_profiles to authenticated;

-- updated_at alanını her güncellemede otomatik yeniler.
create or replace function public.loan_profiles_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists loan_profiles_touch on public.loan_profiles;
create trigger loan_profiles_touch before update on public.loan_profiles
    for each row execute function public.loan_profiles_touch();
