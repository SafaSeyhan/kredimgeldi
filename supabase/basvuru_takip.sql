-- KredimGeldi: Başvuru Takip sayfası (basvuru-takip.html).
-- Üye olmadan başvuru yapanlar başvuru numarası ve başvuruda kullandıkları cep telefonu
-- numarasıyla başvurularının hangi aşamada olduğunu görebilir.
-- Supabase panelinde SQL Editor > New query'ye yapıştırıp "Run" deyin. Birden fazla
-- çalıştırmak zararsızdır. Önce supabase/loan_applications.sql ve
-- supabase/formlar_ve_yonetim.sql çalıştırılmış olmalı.
--
-- Ziyaretçi loan_applications tablosunu okuyamaz. Sorgu aşağıdaki fonksiyonla yapılır:
-- başvuru numarası ve telefon eşleşirse yalnızca teklif, durum ve sonuç bilgileri döner.
-- T.C. kimlik numarası ve doğum tarihi hiçbir zaman döndürülmez; ad soyad maskelenir.

-- Başarısız sorgular: aynı başvuru numarası için 15 dakikada en fazla 5 hatalı deneme.
create table if not exists public.application_lookup_attempts (
    reference_no text not null,
    created_at   timestamptz not null default now()
);
create index if not exists application_lookup_attempts_idx
    on public.application_lookup_attempts (reference_no, created_at desc);
alter table public.application_lookup_attempts enable row level security;
revoke all on public.application_lookup_attempts from anon, authenticated;

create or replace function public.track_application(p_reference_no text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    ref   text := upper(regexp_replace(coalesce(p_reference_no, ''), '\s', '', 'g'));
    tel   text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
    app   public.loan_applications%rowtype;
begin
    if ref !~ '^KG[0-9A-Z]{6,20}$' or tel !~ '^5[0-9]{9}$' then
        raise exception 'geçersiz bilgi';
    end if;

    if (select count(*) from public.application_lookup_attempts
        where reference_no = ref and created_at > now() - interval '15 minutes') >= 5 then
        raise exception 'Çok fazla deneme yapıldı';
    end if;

    select * into app from public.loan_applications
    where reference_no = ref
      and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = tel;

    if not found then
        delete from public.application_lookup_attempts where created_at < now() - interval '1 day';
        insert into public.application_lookup_attempts (reference_no) values (left(ref, 30));
        return null;
    end if;

    return json_build_object(
        'reference_no',    app.reference_no,
        'bank_code',       app.bank_code,
        'bank_name',       app.bank_name,
        'loan_type',       app.loan_type,
        'amount',          app.amount,
        'term_months',     app.term_months,
        'interest_rate',   app.interest_rate,
        'monthly_payment', app.monthly_payment,
        'total_payment',   app.total_payment,
        'file_fee',        app.file_fee,
        'applicant',       nullif(trim(
                               case when coalesce(app.first_name, '') <> '' then left(app.first_name, 1) || '•••' else '' end || ' ' ||
                               case when coalesce(app.last_name, '') <> '' then left(app.last_name, 1) || '•••' else '' end), ''),
        'missing',         array_remove(array[
                               case when coalesce(trim(app.first_name), '') = '' then 'first_name' end,
                               case when coalesce(trim(app.last_name), '') = '' then 'last_name' end,
                               case when coalesce(app.tc_kimlik_no, '') = '' then 'tc_kimlik_no' end,
                               case when app.birth_date is null then 'birth_date' end,
                               case when coalesce(app.phone, '') = '' then 'phone' end], null),
        'status',          app.status,
        'result_amount',   app.result_amount,
        'result_rate',     app.result_rate,
        'result_term',     app.result_term,
        'result_monthly',  app.result_monthly,
        'result_note',     app.result_note,
        'result_at',       app.result_at,
        'created_at',      app.created_at
    );
end;
$$;
revoke all on function public.track_application(text, text) from public;
grant execute on function public.track_application(text, text) to anon, authenticated;
