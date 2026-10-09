// Başvuru Takip: üye olmadan başvuru yapanlar başvuru numarası ve cep telefonuyla başvurularının
// hangi aşamada olduğunu görür. Sorgu Supabase'deki track_application fonksiyonuyla yapılır
// (bkz. supabase/basvuru_takip.sql). Görünüm parçaları basvurularim.js'teki window.KGApps'ten gelir.
(function () {
    "use strict";

    const A = window.KGApps;
    const form = document.getElementById('track-form');
    const box = document.getElementById('track-result');
    const body = document.getElementById('track-result-body');
    let app = null;
    let query = null;

    const digits = s => String(s || '').replace(/\D/g, '');

    function normalizePhone(s) {
        let d = digits(s);
        if (d.startsWith('90') && d.length === 12) d = d.slice(2);
        if (d.startsWith('0')) d = d.slice(1);
        return d;
    }

    function formatPhone(s) {
        if (digits(s) === '0') return '0';
        const d = normalizePhone(s).slice(0, 10);
        if (!d) return '';
        return ['0' + d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');
    }

    const normalizeRef = s => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

    function setBusy(busy) {
        KGAuth.setBusy(form, busy);
        form.querySelector('.spinner-border').classList.toggle('d-none', !busy);
    }

    function render() {
        const stage = A.stageOf(app);
        document.getElementById('track-result-sub').textContent = 'Başvuru No: ' + app.reference_no;
        body.innerHTML = A.card(app, false, true)
            + A.result(app, stage)
            + '<div class="kg-detail-section"><h5>Süreç</h5>' + A.history(app, stage) + '</div>'
            + '<div class="row g-3">'
            + '<div class="col-md-6"><div class="kg-detail-section h-100"><h5>Kredi Bilgileri</h5>' + A.rows([
                ['Banka', app.bank_name],
                ['Kredi Türü', app.loan_type],
                ['Kredi Tutarı', A.tl(app.amount)],
                ['Vade', app.term_months ? app.term_months + ' ay' : ''],
                ['Faiz Oranı', A.rate(app.interest_rate)],
                ['Aylık Taksit', A.tl(app.monthly_payment)],
                ['Dosya Masrafı', A.tl(app.file_fee)],
                ['Toplam Geri Ödeme', A.tl(app.total_payment)]
            ]) + '</div></div>'
            + '<div class="col-md-6"><div class="kg-detail-section h-100"><h5>Başvuru Sahibi</h5>' + A.rows([
                ['Ad Soyad', app.applicant],
                ['Cep Telefonu', A.maskPhone(query.phone)],
                ['Başvuru Tarihi', A.dateTime(app.created_at)]
            ]) + '</div></div></div>';
    }

    async function lookup(ref, phone) {
        if (!KGAuth.configured) {
            return KGAuth.showMessage(form, 'Başvuru sorgulama şu anda yapılamıyor. Lütfen daha sonra tekrar deneyin.');
        }
        setBusy(true);
        let res;
        try {
            res = await KGAuth.client.rpc('track_application', { p_reference_no: ref, p_phone: phone });
        } catch (e) {
            res = { error: e };
        }
        setBusy(false);
        if (res.error) {
            console.error('Başvuru sorgulanamadı:', res.error);
            return KGAuth.showMessage(form, /Çok fazla/.test(res.error.message || '')
                ? 'Bu başvuru numarası için çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'
                : 'Başvuru sorgulama şu anda yapılamıyor. Lütfen daha sonra tekrar deneyin.');
        }
        if (!res.data) {
            return KGAuth.showMessage(form, 'Bu başvuru numarası ve cep telefonuyla eşleşen bir başvuru bulunamadı. Bilgilerinizi kontrol edip tekrar deneyin.');
        }
        KGAuth.showMessage(form, '');
        app = res.data;
        query = { ref, phone };
        render();
        box.classList.remove('d-none');
        box.focus({ preventScroll: true });
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        const ref = normalizeRef(form.reference_no.value);
        const phone = normalizePhone(form.phone.value);
        if (!/^KG[0-9A-Z]{6,20}$/.test(ref)) {
            return KGAuth.showMessage(form, 'Başvuru numaranızı KG ile başlayacak şekilde eksiksiz girin (ör. KG261009E9902B).');
        }
        if (!/^5[0-9]{9}$/.test(phone)) {
            return KGAuth.showMessage(form, '05XX XXX XX XX biçiminde geçerli bir cep telefonu girin.');
        }
        lookup(ref, phone);
    });

    form.reference_no.addEventListener('input', () => {
        const el = form.reference_no;
        const v = el.value.toUpperCase().replace(/\s/g, '');
        if (v !== el.value) el.value = v;
    });
    form.phone.addEventListener('input', () => { form.phone.value = formatPhone(form.phone.value); });

    document.getElementById('track-again').addEventListener('click', () => {
        app = null;
        box.classList.add('d-none');
        form.phone.value = '';
        form.reference_no.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Sonuç mesajındaki "Başvuru Sonucunu İncele" düğmesi aynı sayfadaki sonuç bölümüne kaydırır.
    body.addEventListener('click', e => {
        if (!e.target.closest('[data-app-result]')) return;
        const r = document.getElementById('app-result');
        if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Başvuru tamamlandığında gösterilen bağlantı numarayı ?no= ile getirir.
    const fromUrl = normalizeRef(new URLSearchParams(location.search).get('no'));
    if (fromUrl) {
        form.reference_no.value = fromUrl;
        form.phone.focus();
    }

    // Aşamalar zamana bağlı olduğu için sayfa açık kaldıkça güncellenir.
    setInterval(() => { if (app) render(); }, 60000);
})();
