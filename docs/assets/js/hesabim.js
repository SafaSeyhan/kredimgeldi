// Hesabım sayfası: karşılama alanı, kredi başvuru profili ve şifre değiştirme.
// Profil bilgileri Supabase'deki loan_profiles tablosunda tutulur (bkz. supabase/loan_profiles.sql).
// Tablodaki Row Level Security sayesinde her kullanıcı yalnızca kendi satırına erişebilir.
(function () {
    "use strict";

    const TABLE = 'loan_profiles';

    const CITIES = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan',
        'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur',
        'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan',
        'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
        'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale',
        'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş',
        'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop', 'Şırnak',
        'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'];

    const BANKS = ['Akbank', 'Albaraka Türk', 'Alternatif Bank', 'Burgan Bank', 'DenizBank', 'Emlak Katılım', 'Enpara.com',
        'Fibabanka', 'Garanti BBVA', 'Halkbank', 'HSBC', 'ING', 'İş Bankası', 'Kuveyt Türk', 'Odeabank', 'QNB',
        'Şekerbank', 'TEB', 'Türkiye Finans', 'Vakıf Katılım', 'VakıfBank', 'Yapı Kredi', 'Ziraat Bankası',
        'Ziraat Katılım', 'Diğer', 'Maaşımı bankadan almıyorum'];

    // Kredi türüne göre seçilebilecek en uzun vade (ay).
    const MAX_TERM = { 'İhtiyaç Kredisi': 36, 'Taşıt Kredisi': 48, 'Konut Kredisi': 120 };
    const TERMS = [3, 6, 9, 12, 18, 24, 36, 48, 60, 84, 120];

    const NOT_WORKING = ['Emekli', 'Öğrenci', 'Ev hanımı', 'Çalışmıyor'];
    const WORK_FIELDS = ['occupation', 'employer_name', 'job_start_date'];

    const SECTIONS = {
        kimlik: ['first_name', 'last_name', 'tc_kimlik_no', 'birth_date', 'gender', 'marital_status', 'education', 'dependents'],
        iletisim: ['phone', 'residence_status', 'city', 'district', 'address', 'postal_code'],
        gelir: ['employment_status', 'occupation', 'employer_name', 'job_start_date', 'monthly_income', 'other_income',
            'monthly_debt_payments', 'salary_bank'],
        tercih: ['loan_type', 'loan_amount', 'loan_term_months', 'consent_kvkk', 'consent_accuracy']
    };
    const SECTION_ORDER = ['kimlik', 'iletisim', 'gelir', 'tercih'];
    const NUMBER_FIELDS = ['dependents', 'monthly_income', 'other_income', 'monthly_debt_payments', 'loan_amount', 'loan_term_months'];
    const BOOL_FIELDS = ['consent_kvkk', 'consent_accuracy'];

    let user = null;
    let profile = {};
    let available = true;

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    // ---------- Doğrulama ----------

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

    function digits(s) { return String(s || '').replace(/\D/g, ''); }

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
        const parts = ['0' + d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)];
        return parts.filter(Boolean).join(' ');
    }

    // "14.05.1990" -> "1990-05-14". Geçersiz bir tarih girildiyse metni olduğu gibi döndürür ki doğrulama yakalasın.
    function trDateToIso(v) {
        const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
        if (!m) return v;
        const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return v;
        return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }

    // "04.2021" -> "2021-04-01"
    function trMonthToIso(v) {
        const m = /^(\d{1,2})\.(\d{4})$/.exec(v);
        if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return v;
        return m[2] + '-' + m[1].padStart(2, '0') + '-01';
    }

    // Yazarken noktaları otomatik ekler: 14051990 -> 14.05.1990
    function maskDate(v, parts) {
        const d = digits(v).slice(0, parts.reduce((a, b) => a + b, 0));
        const out = [];
        let i = 0;
        parts.forEach(n => { if (i < d.length) out.push(d.slice(i, i + n)); i += n; });
        return out.join('.');
    }

    function isWorking(status) { return status && !NOT_WORKING.includes(status); }

    // Bir alan bu profil için zorunlu mu? (Çalışmayanlar için işyeri alanları sorulmaz.)
    function isRequired(name, values) {
        const el = document.querySelector('[name="' + name + '"]');
        if (!el || !el.required) return false;
        if (WORK_FIELDS.includes(name)) return isWorking(values.employment_status);
        return true;
    }

    function fieldError(name, value, values) {
        const empty = value === null || value === undefined || value === '' || value === false;
        if (empty) return isRequired(name, values) ? 'Bu alan zorunludur.' : '';
        switch (name) {
            case 'tc_kimlik_no': return isValidTckn(value) ? '' : 'Geçerli bir T.C. kimlik numarası girin.';
            case 'birth_date': {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Tarihi GG.AA.YYYY biçiminde girin (ör. 14.05.1990).';
                const age = ageOn(value);
                if (isNaN(age) || age > 100) return 'Geçerli bir doğum tarihi girin.';
                return age < 18 ? 'Kredi başvurusu için 18 yaşından büyük olmalısınız.' : '';
            }
            case 'phone': return /^5[0-9]{9}$/.test(value) ? '' : '05XX XXX XX XX biçiminde geçerli bir cep telefonu girin.';
            case 'postal_code': return /^[0-9]{5}$/.test(value) ? '' : 'Posta kodu 5 haneli olmalıdır.';
            case 'job_start_date': {
                if (!/^\d{4}-\d{2}-01$/.test(value)) return 'Tarihi AA.YYYY biçiminde girin (ör. 04.2021).';
                return new Date(value) > new Date() ? 'Başlama tarihi gelecekte olamaz.' : '';
            }
            case 'dependents': return value >= 0 && value <= 20 && Number.isInteger(value) ? '' : '0 ile 20 arasında bir sayı girin.';
            case 'loan_amount': return value >= 1000 ? '' : 'Kredi tutarı en az 1.000 ₺ olmalıdır.';
            case 'monthly_income':
            case 'other_income':
            case 'monthly_debt_payments': return value >= 0 ? '' : 'Geçerli bir tutar girin.';
            default: return '';
        }
    }

    // ---------- Form <-> veri ----------

    function readField(form, name) {
        const el = form.elements[name];
        if (!el) return undefined;
        if (BOOL_FIELDS.includes(name)) return el.checked;
        let v = el.value.trim();
        if (name === 'phone') return v ? normalizePhone(v) : null;
        if (name === 'tc_kimlik_no' || name === 'postal_code') return v ? digits(v) : null;
        if (name === 'birth_date') return v ? trDateToIso(v) : null;
        if (name === 'job_start_date') return v ? trMonthToIso(v) : null;
        if (NUMBER_FIELDS.includes(name)) return v === '' ? null : Number(v);
        return v === '' ? null : v;
    }

    function writeField(name, value) {
        const el = document.querySelector('[name="' + name + '"]');
        if (!el) return;
        if (BOOL_FIELDS.includes(name)) { el.checked = Boolean(value); return; }
        if (value === null || value === undefined) { el.value = ''; return; }
        if (name === 'phone') el.value = formatPhone(value);
        else if (name === 'birth_date') el.value = String(value).slice(0, 10).split('-').reverse().join('.');
        else if (name === 'job_start_date') el.value = String(value).slice(0, 7).split('-').reverse().join('.');
        else if (NUMBER_FIELDS.includes(name)) el.value = String(Number(value));
        else el.value = value;
    }

    function setInvalid(el, message) {
        const box = el.closest('[class*="col-"], .form-check') || el.parentElement;
        let fb = box.querySelector('.invalid-feedback');
        if (message) {
            if (!fb) {
                fb = document.createElement('div');
                fb.className = 'invalid-feedback';
                box.appendChild(fb);
            }
            fb.textContent = message;
            fb.style.display = 'block';
            el.classList.add('is-invalid');
        } else {
            el.classList.remove('is-invalid');
            if (fb) fb.style.display = 'none';
        }
    }

    // ---------- Durum ve ilerleme ----------

    function sectionDone(key, values) {
        return SECTIONS[key].every(name => {
            if (!isRequired(name, values)) return true;
            const v = values[name];
            return !(v === null || v === undefined || v === '' || v === false) && !fieldError(name, v, values);
        });
    }

    function renderProgress() {
        let total = 0, filled = 0;
        SECTION_ORDER.forEach(key => {
            SECTIONS[key].forEach(name => {
                if (!isRequired(name, profile)) return;
                total++;
                const v = profile[name];
                if (!(v === null || v === undefined || v === '' || v === false)) filled++;
            });
            const done = sectionDone(key, profile);
            const badge = $('[data-badge="' + key + '"]');
            badge.textContent = done ? 'Tamamlandı' : 'Eksik';
            badge.classList.toggle('done', done);
            $('[data-dot="' + key + '"]').classList.toggle('done', done);
        });
        const pct = total ? Math.round(filled / total * 100) : 0;
        const allDone = SECTION_ORDER.every(k => sectionDone(k, profile));
        $('#progress-text').textContent = '%' + pct;
        $('#progress-fill').style.width = pct + '%';
        $('#progress-bar').setAttribute('aria-valuenow', pct);
        $('#progress-hint').textContent = allDone
            ? 'Profiliniz tamamlandı. Kredi başvurusuna hazırsınız.'
            : 'Kredi başvurusu için bilgilerinizi tamamlayın.';
    }

    function toast(text) {
        let el = $('.kg-toast');
        if (!el) {
            el = document.createElement('div');
            el.className = 'kg-toast';
            el.setAttribute('role', 'status');
            el.innerHTML = '<i class="ri-checkbox-circle-fill"></i><span></span>';
            document.body.appendChild(el);
        }
        el.querySelector('span').textContent = text;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 2800);
    }

    function openTab(key) {
        const btn = $('#account-tabs [data-tab="' + key + '"]');
        if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
    }

    // ---------- Seçenek listeleri ----------

    function fillOptions(select, items) {
        items.forEach(item => {
            const opt = document.createElement('option');
            if (Array.isArray(item)) { opt.value = item[0]; opt.textContent = item[1]; }
            else opt.textContent = item;
            select.appendChild(opt);
        });
    }

    function renderTerms() {
        const select = $('#f-loan_term_months');
        const current = select.value;
        const max = MAX_TERM[$('#f-loan_type').value] || 36;
        select.length = 1;
        fillOptions(select, TERMS.filter(t => t <= max).map(t => [String(t), t + ' ay']));
        if (current && Number(current) <= max) select.value = current;
    }

    function renderWorkFields() {
        const working = isWorking($('#f-employment_status').value) || !$('#f-employment_status').value;
        $$('[data-working]').forEach(col => col.classList.toggle('d-none', !working));
    }

    // ---------- Kaydetme ----------

    async function saveSection(form) {
        const key = form.dataset.section;
        const values = {};
        SECTIONS[key].forEach(name => { values[name] = readField(form, name); });
        const merged = Object.assign({}, profile, values);

        if (key === 'gelir' && !isWorking(values.employment_status)) {
            WORK_FIELDS.forEach(name => { values[name] = null; });
        }

        let firstInvalid = null;
        SECTIONS[key].forEach(name => {
            const el = form.elements[name];
            const err = fieldError(name, values[name], merged);
            setInvalid(el, err);
            if (err && !firstInvalid) firstInvalid = el;
        });
        if (firstInvalid) {
            KGAuth.showMessage(form, 'Lütfen işaretli alanları kontrol edin.');
            firstInvalid.focus();
            return;
        }
        if (!available) return;

        if (key === 'tercih' && values.consent_kvkk && !profile.consent_kvkk) {
            values.consent_kvkk_at = new Date().toISOString();
        }

        KGAuth.showMessage(form, '');
        setFormBusy(form, true);
        const { data, error } = await KGAuth.client
            .from(TABLE)
            .upsert(Object.assign({ user_id: user.id }, values), { onConflict: 'user_id' })
            .select()
            .single();
        setFormBusy(form, false);

        if (error) {
            if (/tc_kimlik_no/.test(error.message || '')) return KGAuth.showMessage(form, 'Geçerli bir T.C. kimlik numarası girin.');
            return KGAuth.showMessage(form, 'Bilgiler kaydedilemedi. ' + KGAuth.translateError(error));
        }

        profile = data || merged;
        renderProgress();
        toast('Bilgileriniz kaydedildi');
        const next = SECTION_ORDER.find(k => !sectionDone(k, profile));
        openTab(next || 'ozet');
        window.scrollTo({ top: $('#account-content').offsetTop - 100, behavior: 'smooth' });
    }

    // KGAuth.setBusy select ve textarea'ları kapsamadığı için kendi sürümümüz.
    function setFormBusy(form, busy) {
        form.querySelectorAll('button, input, select, textarea').forEach(el => { el.disabled = busy || !available; });
    }

    async function deleteProfile(form) {
        if (!confirm('Kaydettiğiniz tüm başvuru bilgileri kalıcı olarak silinecek. Emin misiniz?')) return;
        setFormBusy(form, true);
        const { error } = await KGAuth.client.from(TABLE).delete().eq('user_id', user.id);
        setFormBusy(form, false);
        if (error) return KGAuth.showMessage(form, 'Bilgiler silinemedi. ' + KGAuth.translateError(error));
        profile = {};
        Object.values(SECTIONS).flat().forEach(name => writeField(name, null));
        prefillName();
        renderTerms();
        renderWorkFields();
        renderProgress();
        KGAuth.showMessage(form, 'Başvuru bilgileriniz silindi.', 'success');
    }

    function prefillName() {
        if (profile.first_name || profile.last_name) return;
        const parts = KGAuth.displayName(user).trim().split(/\s+/);
        if (parts.length > 1) {
            $('#f-first_name').value = parts.slice(0, -1).join(' ');
            $('#f-last_name').value = parts[parts.length - 1];
        }
    }

    // ---------- Başlangıç ----------

    function bindInputs() {
        $('#f-tc_kimlik_no').addEventListener('input', e => { e.target.value = digits(e.target.value).slice(0, 11); });
        $('#f-birth_date').addEventListener('input', e => { e.target.value = maskDate(e.target.value, [2, 2, 4]); });
        $('#f-job_start_date').addEventListener('input', e => { e.target.value = maskDate(e.target.value, [2, 4]); });
        $('#f-postal_code').addEventListener('input', e => { e.target.value = digits(e.target.value).slice(0, 5); });
        $('#f-phone').addEventListener('input', e => {
            const atEnd = e.target.selectionStart === e.target.value.length;
            e.target.value = formatPhone(e.target.value);
            if (atEnd) e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
        });
        $('#f-loan_type').addEventListener('change', renderTerms);
        $('#f-employment_status').addEventListener('change', renderWorkFields);

        $$('.kg-form').forEach(form => {
            form.addEventListener('submit', e => { e.preventDefault(); saveSection(form); });
            form.addEventListener('input', e => { if (e.target.classList.contains('is-invalid')) setInvalid(e.target, ''); });
            form.addEventListener('change', e => { if (e.target.classList.contains('is-invalid')) setInvalid(e.target, ''); });
        });

        $$('[data-goto]').forEach(btn => btn.addEventListener('click', () => openTab(btn.dataset.goto)));

        $$('#account-tabs [data-tab]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', () => {
                history.replaceState(null, '', btn.dataset.tab === 'ozet' ? window.location.pathname : '#' + btn.dataset.tab);
            });
        });

        const pwForm = $('#change-password-form');
        pwForm.addEventListener('submit', async e => {
            e.preventDefault();
            const password = pwForm.password.value;
            if (password.length < 8) return KGAuth.showMessage(pwForm, 'Şifre en az 8 karakter olmalı.');
            if (password !== pwForm.password2.value) return KGAuth.showMessage(pwForm, 'Şifreler eşleşmiyor.');
            KGAuth.setBusy(pwForm, true);
            const { error } = await KGAuth.updatePassword(password);
            KGAuth.setBusy(pwForm, false);
            if (error) return KGAuth.showMessage(pwForm, KGAuth.translateError(error));
            pwForm.reset();
            KGAuth.showMessage(pwForm, 'Şifreniz güncellendi.', 'success');
        });

        const delForm = $('#delete-profile-form');
        delForm.addEventListener('submit', e => { e.preventDefault(); deleteProfile(delForm); });
    }

    function markUnavailable(message) {
        available = false;
        const box = $('#profile-unavailable');
        box.textContent = message;
        box.classList.remove('d-none');
        $$('.kg-form, #delete-profile-form').forEach(form => setFormBusy(form, false));
    }

    async function loadProfile() {
        const { data, error } = await KGAuth.client.from(TABLE).select('*').eq('user_id', user.id).maybeSingle();
        if (error) {
            console.error('Profil yüklenemedi:', error);
            const missing = error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '');
            markUnavailable(missing
                ? 'Başvuru bilgileri şu anda kaydedilemiyor; sistem kurulumu tamamlanmak üzere. Lütfen daha sonra tekrar deneyin.'
                : 'Başvuru bilgileriniz yüklenemedi. ' + KGAuth.translateError(error));
            return;
        }
        profile = data || {};
        Object.values(SECTIONS).flat().forEach(name => writeField(name, profile[name]));
    }

    async function init() {
        user = await KGAuth.requireUser();
        if (!user) return;

        const name = KGAuth.displayName(user);
        $('#account-name').textContent = name;
        $('#account-email').textContent = user.email;
        $('#account-created').textContent = new Date(user.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        const words = name.split(/\s+/).filter(Boolean);
        $('#account-initials').textContent = [words[0], words.length > 1 ? words[words.length - 1] : '']
            .map(w => (w || '').charAt(0).toLocaleUpperCase('tr-TR')).join('');

        fillOptions($('#f-city'), CITIES);
        fillOptions($('#f-salary_bank'), BANKS);

        bindInputs();
        await loadProfile();
        // Vade listesi kredi türüne bağlı; kayıtlı vadeyi seçebilmek için listeyi yeniden kurup tekrar yazıyoruz.
        renderTerms();
        writeField('loan_term_months', profile.loan_term_months);
        renderWorkFields();
        prefillName();
        renderProgress();

        $('#account-loading').classList.add('d-none');
        $('#account-content').classList.remove('d-none');

        const hash = window.location.hash.replace('#', '');
        if (hash && $('#account-tabs [data-tab="' + hash + '"]')) openTab(hash);
    }

    init();
})();
