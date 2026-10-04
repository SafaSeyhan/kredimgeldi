-- KredimGeldi: müşterilerin "Başvur" penceresinden yaptığı kredi başvuruları.
-- Hesabım > Başvurularım bölümü bu tablodan okunur.
-- Supabase panelinde SQL Editor > New query'ye yapıştırıp "Run" deyin. Birden fazla
-- çalıştırmak zararsızdır.
--
-- Row Level Security açıktır: her kullanıcı yalnızca kendi başvurularını görebilir ve
-- yalnızca kendi adına yeni başvuru ekleyebilir. Başvurunun durumu ve sonucu
-- (status, result_*) yalnızca Supabase panelinden değiştirilebilir; müşteri bu alanlara
-- yazamaz.

create table if not exists public.loan_applications (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
    reference_no     text not null unique
                     default 'KG' || to_char(now(), 'YYMMDD') || upper(substr(md5(random()::text), 1, 6)),

    -- Başvurulan teklif
    bank_code        text,
    bank_name        text,
    loan_type        text,
    amount           numeric(12, 2) check (amount >= 0),
    term_months      smallint check (term_months between 1 and 240),
    interest_rate    numeric(6, 2) check (interest_rate >= 0),
    monthly_payment  numeric(12, 2) check (monthly_payment >= 0),
    total_payment    numeric(12, 2) check (total_payment >= 0),
    file_fee         numeric(12, 2) check (file_fee >= 0),

    -- Başvuru anındaki kimlik bilgileri
    first_name       text,
    last_name        text,
    tc_kimlik_no     text,
    birth_date       date,
    phone            text,

    -- Banka sonucu. Varsayılan 'alindi': ilk 12 saat "Başvuru Alındı", sonra "Banka İncelemesinde".
    -- Sonuçlandığında 'onaylandi' veya 'reddedildi' yapılıp result_* alanları doldurulur.
    status           text not null default 'alindi'
                     check (status in ('alindi', 'onaylandi', 'reddedildi')),
    result_amount    numeric(12, 2),
    result_rate      numeric(6, 2),
    result_term      smallint,
    result_monthly   numeric(12, 2),
    result_note      text,
    result_at        timestamptz,

    created_at       timestamptz not null default now()
);

create index if not exists loan_applications_user_idx on public.loan_applications (user_id, created_at desc);

alter table public.loan_applications enable row level security;

drop policy if exists "Kendi başvurularını görebilir" on public.loan_applications;
create policy "Kendi başvurularını görebilir" on public.loan_applications
    for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Kendi adına başvuru yapabilir" on public.loan_applications;
create policy "Kendi adına başvuru yapabilir" on public.loan_applications
    for insert to authenticated with check ((select auth.uid()) = user_id);

-- Giriş yapmamış ziyaretçiler tabloya hiç erişemez. Üyeler yalnızca teklif ve kimlik
-- sütunlarını yazabilir; durum ve sonuç sütunları varsayılan değerleriyle kalır.
revoke all on public.loan_applications from anon, authenticated;
grant select on public.loan_applications to authenticated;
grant insert (user_id, bank_code, bank_name, loan_type, amount, term_months, interest_rate,
              monthly_payment, total_payment, file_fee,
              first_name, last_name, tc_kimlik_no, birth_date, phone)
    on public.loan_applications to authenticated;
