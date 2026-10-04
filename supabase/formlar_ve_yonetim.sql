-- KredimGeldi: iletişim formları, bülten aboneliği, üye olmadan yapılan başvurular ve
-- yönetim paneli (yonetim.html) yetkileri.
-- Supabase panelinde SQL Editor > New query'ye yapıştırıp "Run" deyin. Birden fazla
-- çalıştırmak zararsızdır. Önce supabase/loan_applications.sql çalıştırılmış olmalı.
--
-- Son satırdaki e-posta adresini kendi giriş yaptığınız adresle değiştirin; o hesap
-- yönetim paneline girebilir.

-- ---------- Yöneticiler ----------

create table if not exists public.admin_users (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- İletişim mesajları ----------

create table if not exists public.contact_messages (
    id         uuid primary key default gen_random_uuid(),
    name       text not null check (char_length(name) between 1 and 120),
    email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
    phone      text check (char_length(phone) <= 30),
    subject    text check (char_length(subject) <= 200),
    message    text not null check (char_length(message) between 1 and 5000),
    page       text check (char_length(page) <= 100),
    is_read    boolean not null default false,
    created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;

revoke all on public.contact_messages from anon, authenticated;
grant insert (name, email, phone, subject, message, page) on public.contact_messages to anon, authenticated;
grant select, update (is_read) on public.contact_messages to authenticated;

drop policy if exists "Herkes mesaj gönderebilir" on public.contact_messages;
create policy "Herkes mesaj gönderebilir" on public.contact_messages
    for insert to anon, authenticated with check (true);
drop policy if exists "Yönetici mesajları görür" on public.contact_messages;
create policy "Yönetici mesajları görür" on public.contact_messages
    for select to authenticated using (public.is_admin());
drop policy if exists "Yönetici mesajı okundu yapar" on public.contact_messages;
create policy "Yönetici mesajı okundu yapar" on public.contact_messages
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Bülten aboneleri ----------

create table if not exists public.newsletter_subscribers (
    email      text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
    created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;

revoke all on public.newsletter_subscribers from anon, authenticated;
grant insert (email) on public.newsletter_subscribers to anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;

drop policy if exists "Herkes abone olabilir" on public.newsletter_subscribers;
create policy "Herkes abone olabilir" on public.newsletter_subscribers
    for insert to anon, authenticated with check (true);
drop policy if exists "Yönetici aboneleri görür" on public.newsletter_subscribers;
create policy "Yönetici aboneleri görür" on public.newsletter_subscribers
    for select to authenticated using (public.is_admin());

-- ---------- Üye olmadan yapılan başvurular ----------
-- Üye olmayan başvurularda user_id boş kalır. Ziyaretçi tabloyu okuyamaz; başvuru
-- aşağıdaki fonksiyonla eklenir ve yalnızca başvuru numarası geri döner.

alter table public.loan_applications alter column user_id drop not null;

create or replace function public.submit_guest_application(
    p_bank_code text, p_bank_name text, p_loan_type text,
    p_amount numeric, p_term_months smallint, p_interest_rate numeric,
    p_monthly_payment numeric, p_total_payment numeric, p_file_fee numeric,
    p_first_name text, p_last_name text, p_tc_kimlik_no text, p_birth_date date, p_phone text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    ref text;
begin
    if p_tc_kimlik_no !~ '^[1-9][0-9]{10}$' then
        raise exception 'tc_kimlik_no geçersiz';
    end if;
    if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' or coalesce(p_phone, '') = '' then
        raise exception 'eksik bilgi';
    end if;
    -- Aynı T.C. kimlik numarasıyla 10 dakikada en fazla 5 başvuru.
    if (select count(*) from public.loan_applications
        where tc_kimlik_no = p_tc_kimlik_no and created_at > now() - interval '10 minutes') >= 5 then
        raise exception 'Çok fazla deneme yapıldı';
    end if;

    insert into public.loan_applications (
        user_id, bank_code, bank_name, loan_type, amount, term_months, interest_rate,
        monthly_payment, total_payment, file_fee,
        first_name, last_name, tc_kimlik_no, birth_date, phone)
    values (
        null, left(p_bank_code, 40), left(p_bank_name, 80), left(p_loan_type, 80), p_amount, p_term_months, p_interest_rate,
        p_monthly_payment, p_total_payment, p_file_fee,
        left(trim(p_first_name), 60), left(trim(p_last_name), 60), p_tc_kimlik_no, p_birth_date, left(p_phone, 20))
    returning reference_no into ref;
    return ref;
end;
$$;
revoke all on function public.submit_guest_application from public;
grant execute on function public.submit_guest_application to anon, authenticated;

-- ---------- Yöneticinin başvuruları görmesi ve sonuçlandırması ----------

drop policy if exists "Yönetici tüm başvuruları görür" on public.loan_applications;
create policy "Yönetici tüm başvuruları görür" on public.loan_applications
    for select to authenticated using (public.is_admin());

drop policy if exists "Yönetici başvuru sonucunu girer" on public.loan_applications;
create policy "Yönetici başvuru sonucunu girer" on public.loan_applications
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant update (status, result_amount, result_rate, result_term, result_monthly, result_note, result_at)
    on public.loan_applications to authenticated;

-- ---------- Yönetici ekle ----------
-- E-postayı kendi hesabınızla değiştirin.
insert into public.admin_users (user_id)
select id from auth.users where email = 'info@kredimgeldi.com'
on conflict do nothing;
