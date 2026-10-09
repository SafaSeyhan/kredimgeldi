// "Başvur" ve "Detaylar" pencereleri (components/identification_modal.html, components/details_modal.html).
// Pencereler sayfaya fetch ile sonradan eklendiği için olaylar document üzerinden dinlenir.
// Giriş yapmış kullanıcının kimlik bilgileri Hesabım'daki loan_profiles tablosundan getirilir;
// başvuru sırasında değiştirilen bilgiler aynı tabloya geri kaydedilir.
// Giriş yapmış kullanıcının başvurusu loan_applications tablosuna yazılır ve Hesabım > Başvurularım'da listelenir.
(function () {
    "use strict";

    const TABLE = 'loan_profiles';
    const APPLICATIONS = 'loan_applications';
    const FIELDS = ['first_name', 'last_name', 'tc_kimlik_no', 'birth_date', 'phone'];

    let user = null;
    let profile = null;
    let available = false;
    let loading = null;
    let offer = null;

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    // ---------- Biçimlendirme ve doğrulama (Hesabım sayfasıyla aynı kurallar) ----------

    function digits(s) { return String(s || '').replace(/\D/g, ''); }

    function isValidTckn(value) {
        if (!/^[1-9][0-9]{10}$/.test(value)) return false;
        const d = value.split('').map(Number);
        const odd = d[0] + d[2] + d[4] + d[6] + d[8];
        const even = d[1] + d[3] + d[5] + d[7];
        if (((odd * 7 - even) % 10 + 10) % 10 !== d[9]) return false;
        return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
    }

    function ageOn(dateStr) {
        const b = new Date(dateStr + 'T00:00:00');
        const now = new Date();
        let age = now.getFullYear() - b.getFullYear();
        if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
        return age;
    }

    function normalizePhone(s) {
        let d = digits(s);
        if (d.startsWith('90') && d.length === 12) d = d.slice(2);
        if (d.startsWith('0')) d = d.slice(1);
        return d;
    }

    function formatPhone(d) {
        // Yazarken ilk girilen "0" kaybolmasın; tek başına "0" olduğu gibi kalır.
        if (digits(d) === '0') return '0';
        d = normalizePhone(d).slice(0, 10);
        if (!d) return '';
        return ['0' + d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');
    }

    // "14.05.1990" -> "1990-05-14". Geçersizse metni olduğu gibi döndürür ki doğrulama yakalasın.
    function trDateToIso(v) {
        const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
        if (!m) return v;
        const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return v;
        return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }

    // "₺100.000,00" -> 100000
    function parseTl(v) {
        const n = Number(String(v || '').replace(/[^0-9,]/g, '').replace(',', '.'));
        return v && isFinite(n) && /\d/.test(v) ? n : null;
    }

    function isoToTrDate(v) { return v ? String(v).slice(0, 10).split('-').reverse().join('.') : ''; }

    function maskDate(v) {
        const d = digits(v).slice(0, 8);
        return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('.');
    }

    function fieldError(name, value) {
        if (!value) return 'Bu alan zorunludur.';
        switch (name) {
            case 'first_name':
            case 'last_name': return value.length < 2 ? 'En az 2 harf girin.' : '';
            case 'tc_kimlik_no': return isValidTckn(value) ? '' : 'Geçerli bir T.C. kimlik numarası girin.';
            case 'birth_date': {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Tarihi GG.AA.YYYY biçiminde girin (ör. 14.05.1990).';
                const age = ageOn(value);
                if (isNaN(age) || age > 100) return 'Geçerli bir doğum tarihi girin.';
                return age < 18 ? 'Kredi başvurusu için 18 yaşından büyük olmalısınız.' : '';
            }
            case 'phone': return /^5[0-9]{9}$/.test(value) ? '' : '05XX XXX XX XX biçiminde geçerli bir cep telefonu girin.';
            default: return '';
        }
    }

    function readField(form, name) {
        const v = form.elements[name].value.trim();
        if (!v) return null;
        if (name === 'tc_kimlik_no') return digits(v);
        if (name === 'phone') return normalizePhone(v);
        if (name === 'birth_date') return trDateToIso(v);
        return v;
    }

    function writeField(form, name, value) {
        const el = form.elements[name];
        if (name === 'phone') el.value = value ? formatPhone(value) : '';
        else if (name === 'birth_date') el.value = isoToTrDate(value);
        else el.value = value || '';
    }

    function setInvalid(el, message) {
        const box = el.closest('[class*="col-"], .form-check') || el.parentElement;
        let fb = box.querySelector('.invalid-feedback');
        if (message && !fb) {
            fb = document.createElement('div');
            fb.className = 'invalid-feedback';
            box.appendChild(fb);
        }
        if (fb) {
            fb.textContent = message || '';
            fb.style.display = message ? 'block' : 'none';
        }
        el.classList.toggle('is-invalid', Boolean(message));
    }

    function showMessage(form, text, type) {
        const box = $('.kg-apply-message', form);
        box.className = 'kg-apply-message alert alert-' + (type || 'danger') + (text ? '' : ' d-none');
        box.textContent = text || '';
    }

    // ---------- Kullanıcı ve kayıtlı profil ----------

    function loadProfile() {
        if (loading) return loading;
        loading = (async () => {
            if (!window.KGAuth || !KGAuth.configured) return;
            try {
                user = await KGAuth.getUser();
                if (!user) return;
                const { data, error } = await KGAuth.client.from(TABLE).select(FIELDS.join(',') + ',consent_kvkk')
                    .eq('user_id', user.id).maybeSingle();
                if (error) { console.error('Profil yüklenemedi:', error); return; }
                available = true;
                profile = data || {};
            } catch (e) {
                console.error('Profil yüklenemedi:', e);
            }
        })();
        return loading;
    }

    function profileComplete() {
        return Boolean(profile) && FIELDS.every(name => profile[name] && !fieldError(name, profile[name]));
    }

    function renderSaved(form) {
        const show = profileComplete();
        $('[data-saved]', form).classList.toggle('d-none', !show);
        $('[data-fields]', form).classList.toggle('d-none', show);
        if (!show) return;
        $('[data-saved-name]', form).textContent = profile.first_name + ' ' + profile.last_name;
        $('[data-saved-tc]', form).textContent = profile.tc_kimlik_no;
        $('[data-saved-birth]', form).textContent = isoToTrDate(profile.birth_date);
        $('[data-saved-phone]', form).textContent = formatPhone(profile.phone);
    }

    function showFields(form) {
        $('[data-saved]', form).classList.add('d-none');
        $('[data-fields]', form).classList.remove('d-none');
    }

    function prepareForm(form) {
        form.reset();
        showMessage(form, '');
        $$('.is-invalid', form).forEach(el => setInvalid(el, ''));

        const guest = !user;
        $('[data-guest]', form).classList.toggle('d-none', !guest || !(window.KGAuth && KGAuth.configured));
        $('[data-login-link]', form).href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
        $('[data-sync-hint]', form).classList.toggle('d-none', !available);

        if (profile) {
            FIELDS.forEach(name => writeField(form, name, profile[name]));
            form.elements.consent.checked = Boolean(profile.consent_kvkk);
        }
        if (user && !(profile && (profile.first_name || profile.last_name))) {
            const parts = KGAuth.displayName(user).trim().split(/\s+/);
            if (parts.length > 1) {
                form.elements.first_name.value = parts.slice(0, -1).join(' ');
                form.elements.last_name.value = parts[parts.length - 1];
            }
        }
        renderSaved(form);
    }

    // ---------- Teklif özeti ----------

    // Butondaki data-* bilgilerini (banka, tutar, vade...) pencerenin üst kısmına yazar.
    function renderOffer(modal, data) {
        const box = $('[data-offer]', modal);
        const label = $('[data-offer-label]', modal);
        if (!label.dataset.default) label.dataset.default = label.textContent;
        const has = Boolean(data && data.amount);
        box.classList.toggle('d-none', !has);
        label.textContent = has ? [data.bank, data.typeName].filter(Boolean).join(' · ') : label.dataset.default;
        if (!has) return;
        const set = (key, value) => { const el = $('[data-offer-' + key + ']', modal); if (el) el.textContent = value || '-'; };
        set('amount', data.amount);
        set('term', data.term ? data.term + ' ay' : '');
        set('rate', data.rate ? '%' + data.rate.replace('.', ',') : '');
        set('monthly', data.monthly);
        set('fee', data.fee);
        set('total', data.total);
    }

    // ---------- Gönderme ----------

    async function submit(form) {
        const values = {};
        FIELDS.forEach(name => { values[name] = readField(form, name); });

        let firstInvalid = null;
        FIELDS.forEach(name => {
            const err = fieldError(name, values[name]);
            setInvalid(form.elements[name], err);
            if (err && !firstInvalid) firstInvalid = form.elements[name];
        });
        const consent = form.elements.consent;
        setInvalid(consent, consent.checked ? '' : 'Devam etmek için onay vermeniz gerekiyor.');
        if (firstInvalid) {
            showFields(form);
            firstInvalid.focus();
            return;
        }
        if (!consent.checked) { consent.focus(); return; }

        showMessage(form, '');

        if (user && available) {
            const changes = {};
            FIELDS.forEach(name => {
                let saved = String(profile[name] || '');
                if (name === 'birth_date') saved = saved.slice(0, 10);
                if (values[name] !== saved) changes[name] = values[name];
            });
            if (!profile.consent_kvkk) {
                changes.consent_kvkk = true;
                changes.consent_kvkk_at = new Date().toISOString();
            }
            if (Object.keys(changes).length) {
                setBusy(form, true);
                const { data, error } = await KGAuth.client.from(TABLE)
                    .upsert(Object.assign({ user_id: user.id }, changes), { onConflict: 'user_id' })
                    .select(FIELDS.join(',') + ',consent_kvkk')
                    .single();
                setBusy(form, false);
                if (error) {
                    if (/tc_kimlik_no/.test(error.message || '')) return showMessage(form, 'Geçerli bir T.C. kimlik numarası girin.');
                    return showMessage(form, 'Bilgileriniz kaydedilemedi. ' + KGAuth.translateError(error));
                }
                profile = data || Object.assign({}, profile, changes);
            }
        }

        setBusy(form, true);
        const saved = user ? await saveApplication(values) : await saveGuestApplication(values);
        setBusy(form, false);
        if (!saved || saved.error) {
            const err = saved && saved.error;
            if (err && /tc_kimlik_no/.test(err.message || '')) return showMessage(form, 'Geçerli bir T.C. kimlik numarası girin.');
            if (err && /Çok fazla/.test(err.message || '')) return showMessage(form, 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.');
            return showMessage(form, 'Başvurunuz şu anda gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin.');
        }

        const modal = form.closest('.modal');
        const where = offer && offer.bank ? offer.bank + ' ' + (offer.typeName || '') : '';
        $('[data-done-text]', modal).textContent = (where ? where.trim() + ' için b' : 'B') + 'aşvurunuz alındı. Teşekkür ederiz.';
        const ref = saved.data && saved.data.reference_no;
        $('[data-done-track]', modal).classList.toggle('d-none', !ref);
        $('[data-done-ref]', modal).textContent = ref || '';
        $('[data-done-hint]', modal).textContent = user
            ? 'Başvurunuzun durumunu Hesabım > Başvurularım bölümünden adım adım takip edebilirsiniz.'
            : 'Başvuru numaranızı not edin. Başvurunuzu Krediler > Başvuru Takip sayfasından bu numara ve cep telefonunuzla adım adım takip edebilirsiniz.';
        const link = $('[data-done-link]', modal);
        link.href = user ? 'hesabim.html#basvurularim' : 'basvuru-takip.html?no=' + encodeURIComponent(ref || '');
        link.classList.toggle('d-none', !user && !ref);
        $('[data-done-signup]', modal).classList.toggle('d-none', Boolean(user));
        form.classList.add('d-none');
        $('[data-step="done"]', modal).classList.remove('d-none');
    }

    function offerRow() {
        const o = offer || {};
        return {
            bank_code: o.bankKey || null,
            bank_name: o.bank || null,
            loan_type: o.typeName || null,
            amount: parseTl(o.amount),
            term_months: o.term ? Number(o.term) || null : null,
            interest_rate: o.rate ? Number(o.rate) || null : null,
            monthly_payment: parseTl(o.monthly),
            total_payment: parseTl(o.total),
            file_fee: parseTl(o.fee)
        };
    }

    // Üye başvurusu: teklif ve o anki kimlik bilgileriyle kaydedilir, Başvurularım'da görünür.
    async function saveApplication(values) {
        const row = Object.assign(offerRow(), values);
        try {
            const { data, error } = await KGAuth.client.from(APPLICATIONS).insert(row).select('id, reference_no').single();
            if (error) console.error('Başvuru kaydedilemedi:', error);
            return error ? { error } : { data };
        } catch (e) {
            console.error('Başvuru kaydedilemedi:', e);
            return { error: e };
        }
    }

    // Üye olmadan başvuru: supabase/formlar_ve_yonetim.sql içindeki fonksiyonla kaydedilir.
    async function saveGuestApplication(values) {
        if (!window.KGAuth || !KGAuth.client) return { error: { message: 'not configured' } };
        const r = offerRow();
        try {
            const { data, error } = await KGAuth.client.rpc('submit_guest_application', {
                p_bank_code: r.bank_code, p_bank_name: r.bank_name, p_loan_type: r.loan_type,
                p_amount: r.amount, p_term_months: r.term_months, p_interest_rate: r.interest_rate,
                p_monthly_payment: r.monthly_payment, p_total_payment: r.total_payment, p_file_fee: r.file_fee,
                p_first_name: values.first_name, p_last_name: values.last_name, p_tc_kimlik_no: values.tc_kimlik_no,
                p_birth_date: values.birth_date || null, p_phone: values.phone
            });
            if (error) console.error('Başvuru kaydedilemedi:', error);
            return error ? { error } : { data: { reference_no: data } };
        } catch (e) {
            console.error('Başvuru kaydedilemedi:', e);
            return { error: e };
        }
    }

    function setBusy(form, busy) {
        form.querySelectorAll('button, input').forEach(el => { el.disabled = busy; });
        $('.kg-apply-submit .spinner-border', form).classList.toggle('d-none', !busy);
    }

    // ---------- Olaylar ----------

    document.addEventListener('show.bs.modal', async e => {
        const modal = e.target;
        if (modal.id !== 'identificationModal' && modal.id !== 'detailsModal') return;
        const trigger = e.relatedTarget && e.relatedTarget.closest('[data-bs-toggle="modal"]');
        const data = trigger ? Object.assign({}, trigger.dataset) : null;
        renderOffer(modal, data);
        if (modal.id !== 'identificationModal') return;

        offer = data;
        const form = $('.kg-apply-form', modal);
        form.classList.remove('d-none');
        $('[data-step="done"]', modal).classList.add('d-none');
        setBusy(form, true);
        await loadProfile();
        setBusy(form, false);
        prepareForm(form);
    });

    document.addEventListener('submit', e => {
        const form = e.target.closest('.kg-apply-form');
        if (!form) return;
        e.preventDefault();
        submit(form);
    });

    document.addEventListener('click', e => {
        const edit = e.target.closest('.kg-apply-form [data-edit]');
        if (!edit) return;
        const form = edit.closest('form');
        showFields(form);
        form.elements.first_name.focus();
    });

    document.addEventListener('input', e => {
        const el = e.target;
        if (!el.closest || !el.closest('.kg-apply-form')) return;
        if (el.name === 'tc_kimlik_no') el.value = digits(el.value).slice(0, 11);
        else if (el.name === 'birth_date') el.value = maskDate(el.value);
        else if (el.name === 'phone') {
            const atEnd = el.selectionStart === el.value.length;
            el.value = formatPhone(el.value);
            if (atEnd) el.selectionStart = el.selectionEnd = el.value.length;
        }
        if (el.classList.contains('is-invalid')) setInvalid(el, '');
    });

    document.addEventListener('change', e => {
        const el = e.target;
        if (el.name === 'consent' && el.closest('.kg-apply-form') && el.checked) setInvalid(el, '');
    });

    // Giriş yapmış kullanıcıların bilgileri pencere açılmadan hazır olsun.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProfile);
    else loadProfile();
})();
