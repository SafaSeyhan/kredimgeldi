// Hesabım > Başvurularım: müşterinin "Başvur" penceresinden yaptığı başvuruları ve aşamalarını gösterir.
// Başvurular Supabase'deki loan_applications tablosundan okunur (bkz. supabase/loan_applications.sql).
//
// Aşamalar:
//   1. Başvuru Alındı: başvurudan sonraki ilk 12 saat. Ad, soyad, T.C. kimlik no, doğum tarihi ve cep
//      telefonundan biri eksikse 12 saatin sonunda "Eksik Bilgilerden Ötürü Başvuru Alınamadı" olur.
//   2. Banka İncelemesinde: bilgiler eksiksizse 12 saatin sonunda başlar.
//   3. Başvuru Sonucunu İncele: status 'onaylandi' veya 'reddedildi' yapıldığında açılır.
(function () {
    "use strict";

    const TABLE = 'loan_applications';
    const CHECK_HOURS = 12;
    const REQUIRED = {
        first_name: 'Ad',
        last_name: 'Soyad',
        tc_kimlik_no: 'T.C. Kimlik No',
        birth_date: 'Doğum Tarihi',
        phone: 'Cep Telefonu'
    };
    const BANK_LOGOS = {
        akbank: { file: 'akbank_logo.png', scale: 1 },
        garanti: { file: 'garanti_logo.png', scale: 1 },
        isbankasi: { file: 'isbankası.svg', scale: 3 },
        qnb: { file: 'QNBFinansbank.svg', scale: 1.5 },
        ziraat: { file: 'ziraatlogo.svg', scale: 4.2 }
    };

    let apps = [];
    let filter = 'all';

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    // ---------- Biçimlendirme ----------

    function esc(v) {
        return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    function has(v) { return v !== null && v !== undefined && v !== ''; }

    function tl(v) {
        return has(v) ? Number(v).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : '';
    }

    function rate(v) { return has(v) ? '%' + Number(v).toFixed(2).replace('.', ',') : ''; }

    function dateTime(d) {
        return new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function shortDate(d) {
        return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function maskTc(v) { return v ? v.slice(0, 3) + '•'.repeat(6) + v.slice(-2) : ''; }

    function maskPhone(v) { return v ? '0' + v.slice(0, 3) + ' ••• •• ' + v.slice(-2) : ''; }

    function remaining(ms) {
        const mins = Math.max(1, Math.ceil(ms / 60000));
        const h = Math.floor(mins / 60), m = mins % 60;
        return (h ? h + ' saat ' : '') + (m ? m + ' dakika' : '').trim();
    }

    function title(app) { return app.loan_type || 'Kredi Başvurusu'; }

    function bankName(app) { return app.bank_name || 'Anlaşmalı bankalarımız'; }

    // ---------- Aşama ----------

    function stageOf(app) {
        const created = new Date(app.created_at).getTime();
        const checkAt = created + CHECK_HOURS * 3600 * 1000;
        const missing = Object.keys(REQUIRED).filter(k => !has(app[k]));
        const base = { created, checkAt, missing };
        if (app.status === 'onaylandi' || app.status === 'reddedildi') {
            return Object.assign(base, { step: 3, key: app.status, closed: true });
        }
        if (Date.now() < checkAt) return Object.assign(base, { step: 1, key: 'received', closed: false });
        if (missing.length) return Object.assign(base, { step: 1, key: 'missing', closed: true });
        return Object.assign(base, { step: 2, key: 'review', closed: false });
    }

    const PILLS = {
        received: ['info', 'ri-inbox-archive-line', 'Başvuru Alındı'],
        review: ['warn', 'ri-bank-line', 'Banka İncelemesinde'],
        missing: ['danger', 'ri-error-warning-line', 'Başvuru Alınamadı'],
        onaylandi: ['success', 'ri-checkbox-circle-line', 'Onaylandı'],
        reddedildi: ['muted', 'ri-close-circle-line', 'Olumsuz Sonuçlandı']
    };

    function pill(stage) {
        const [tone, icon, text] = PILLS[stage.key];
        return '<span class="kg-pill ' + tone + '"><i class="' + icon + '"></i> ' + text + '</span>';
    }

    // ---------- Parçalar ----------

    function logo(app) {
        const l = BANK_LOGOS[app.bank_code];
        if (l) {
            const style = l.scale > 1 ? ' style="transform: scale(' + l.scale + ')"' : '';
            return '<span class="kg-bank-logo"><img src="assets/images/brands/' + esc(app.bank_code) + '/' + esc(l.file) + '" alt="' + esc(app.bank_name) + '"' + style + '></span>';
        }
        return '<span class="kg-bank-logo kg-bank-mono"><i class="ri-bank-line"></i></span>';
    }

    function stepper(app, stage) {
        const steps = [];

        // 1. Başvuru Alındı
        if (stage.key === 'missing') {
            steps.push(['failed', 'ri-close-line', 'Eksik Bilgilerden Ötürü Başvuru Alınamadı', shortDate(app.created_at)]);
        } else {
            steps.push([stage.step === 1 ? 'current' : 'done', stage.step === 1 ? 'ri-inbox-archive-line' : 'ri-check-line',
                'Başvuru Alındı', dateTime(app.created_at)]);
        }

        // 2. Banka İncelemesinde
        if (stage.step === 2) steps.push(['current', 'ri-bank-line', 'Banka İncelemesinde', 'Değerlendiriliyor']);
        else if (stage.step === 3) steps.push(['done', 'ri-check-line', 'Banka İncelemesi Tamamlandı', app.result_at ? shortDate(app.result_at) : '']);
        else steps.push(['', 'ri-bank-line', 'Banka İncelemesinde', stage.key === 'missing' ? '' : 'Sıradaki adım']);

        // 3. Başvuru Sonucunu İncele
        if (stage.step === 3) steps.push(['done result', 'ri-file-search-line', 'Başvuru Sonucunu İncele', '']);
        else steps.push(['', 'ri-lock-line', 'Başvuru Sonucunu İncele', stage.key === 'missing' ? '' : 'Banka değerlendirmesinin ardından']);

        const fill = stage.step === 3 ? 1 : stage.step === 2 ? 0.5 : 0;
        return '<ol class="kg-stepper" style="--fill:' + fill + '">' + steps.map((s, i) => {
            const label = s[0].includes('result')
                ? '<button type="button" class="kg-step-link" data-app-open="' + esc(app.id) + '" data-app-result>' + s[2] + ' <i class="ri-arrow-right-line"></i></button>'
                : '<strong>' + s[2] + '</strong>';
            return '<li class="' + s[0] + '"><span class="kg-step-dot"><i class="' + s[1] + '"></i></span>'
                + '<span class="kg-step-text"><small class="kg-step-no">' + (i + 1) + '. Aşama</small>' + label
                + (s[3] ? '<small>' + esc(s[3]) + '</small>' : '') + '</span></li>';
        }).join('') + '</ol>';
    }

    function message(app, stage) {
        const bank = esc(bankName(app));
        switch (stage.key) {
            case 'received': {
                const total = stage.checkAt - stage.created;
                const pct = Math.min(100, Math.max(4, (Date.now() - stage.created) / total * 100));
                return '<div class="kg-app-msg info"><i class="ri-time-line"></i><div>'
                    + '<p>Başvurunuz alındı ve bilgileriniz kontrol ediliyor. Kontrol tamamlandığında başvurunuz değerlendirme için bankaya iletilecek.</p>'
                    + '<div class="kg-mini-progress"><span style="width:' + pct.toFixed(0) + '%"></span></div>'
                    + '<small>Tahmini kalan süre: ' + remaining(stage.checkAt - Date.now()) + '</small></div></div>';
            }
            case 'review':
                return '<div class="kg-app-msg warn"><span class="kg-pulse"></span><div>'
                    + '<p>Başvurunuz ' + bank + ' tarafından inceleniyor. Değerlendirme tamamlandığında sonucu bu sayfadan inceleyebileceksiniz.</p>'
                    + '<small>Bankaya iletilme: ' + dateTime(stage.checkAt) + '</small></div></div>';
            case 'missing':
                return '<div class="kg-app-msg danger"><i class="ri-error-warning-line"></i><div>'
                    + '<p>Başvurunuzda ' + stage.missing.map(k => REQUIRED[k]).join(', ') + ' bilgisi eksik olduğu için başvurunuz alınamadı. '
                    + 'Bilgilerinizi tamamlayıp yeniden başvurabilirsiniz.</p>'
                    + '<div class="kg-app-msg-actions"><button type="button" class="kg-chip-btn" data-goto-tab="kimlik">Bilgilerimi Tamamla</button>'
                    + '<a class="kg-chip-btn ghost" href="products.html">Yeniden Başvur</a></div></div></div>';
            case 'onaylandi':
                return '<div class="kg-app-msg success"><i class="ri-checkbox-circle-line"></i><div>'
                    + '<p>Tebrikler! Başvurunuz ' + bank + ' tarafından onaylandı. Kredi koşullarını ve sonraki adımları inceleyebilirsiniz.</p>'
                    + '<div class="kg-app-msg-actions"><button type="button" class="kg-chip-btn" data-app-open="' + esc(app.id) + '" data-app-result>Başvuru Sonucunu İncele</button></div></div></div>';
            case 'reddedildi':
                return '<div class="kg-app-msg muted"><i class="ri-information-line"></i><div>'
                    + '<p>Başvurunuz ' + bank + ' tarafından olumlu değerlendirilemedi. Diğer bankaların tekliflerini inceleyebilirsiniz.</p>'
                    + '<div class="kg-app-msg-actions"><button type="button" class="kg-chip-btn" data-app-open="' + esc(app.id) + '" data-app-result>Başvuru Sonucunu İncele</button>'
                    + '<a class="kg-chip-btn ghost" href="products.html">Diğer Teklifler</a></div></div></div>';
        }
        return '';
    }

    function figures(app) {
        const items = [
            ['Kredi Tutarı', tl(app.amount)],
            ['Vade', app.term_months ? app.term_months + ' ay' : ''],
            ['Aylık Taksit', tl(app.monthly_payment)],
            ['Faiz Oranı', rate(app.interest_rate)]
        ].filter(i => i[1]);
        if (!items.length) return '';
        return '<dl class="kg-app-figures">' + items.map(i => '<div><dt>' + i[0] + '</dt><dd>' + esc(i[1]) + '</dd></div>').join('') + '</dl>';
    }

    function card(app, compact) {
        const stage = stageOf(app);
        return '<article class="kg-app' + (compact ? ' compact' : '') + '" data-state="' + stage.key + '">'
            + '<header class="kg-app-head">' + logo(app)
            + '<div class="kg-app-title"><h3>' + esc(title(app)) + '</h3>'
            + '<small>' + esc(app.bank_name || 'KredimGeldi') + ' · No: ' + esc(app.reference_no) + '</small></div>'
            + pill(stage) + '</header>'
            + (compact ? '' : figures(app))
            + stepper(app, stage)
            + (compact ? '' : message(app, stage))
            + (compact ? '' : '<footer class="kg-app-foot"><span><i class="ri-calendar-line"></i> ' + dateTime(app.created_at) + '</span>'
                + '<button type="button" class="kg-link-more" data-app-open="' + esc(app.id) + '">Başvuru Detayları <i class="ri-arrow-right-line"></i></button></footer>')
            + '</article>';
    }

    // ---------- Detay penceresi ----------

    function rows(items) {
        return '<dl class="kg-detail-list">' + items.filter(i => has(i[1])).map(i =>
            '<div><dt>' + i[0] + '</dt><dd>' + esc(i[1]) + '</dd></div>').join('') + '</dl>';
    }

    function result(app, stage) {
        if (stage.key === 'onaylandi') {
            return '<section class="kg-result approved" id="app-result"><span class="kg-result-icon"><i class="ri-checkbox-circle-fill"></i></span>'
                + '<h4>Krediniz onaylandı</h4><p>' + esc(bankName(app)) + ' başvurunuzu aşağıdaki koşullarla onayladı.</p>'
                + rows([
                    ['Onaylanan Tutar', tl(has(app.result_amount) ? app.result_amount : app.amount)],
                    ['Faiz Oranı', rate(has(app.result_rate) ? app.result_rate : app.interest_rate)],
                    ['Vade', (app.result_term || app.term_months) ? (app.result_term || app.term_months) + ' ay' : ''],
                    ['Aylık Taksit', tl(has(app.result_monthly) ? app.result_monthly : app.monthly_payment)],
                    ['Sonuç Tarihi', app.result_at ? dateTime(app.result_at) : '']
                ])
                + (app.result_note ? '<p class="kg-result-note">' + esc(app.result_note) + '</p>' : '')
                + '<p class="kg-result-next"><i class="ri-customer-service-2-line"></i> Kredinin kullandırılması için banka yetkilisi kayıtlı telefon numaranız üzerinden sizinle iletişime geçecektir.</p>'
                + '</section>';
        }
        if (stage.key === 'reddedildi') {
            return '<section class="kg-result rejected" id="app-result"><span class="kg-result-icon"><i class="ri-information-fill"></i></span>'
                + '<h4>Başvurunuz olumlu sonuçlanmadı</h4><p>' + esc(bankName(app)) + ' bu başvuruyu şu an için onaylayamadı.</p>'
                + (app.result_note ? '<p class="kg-result-note">' + esc(app.result_note) + '</p>' : '')
                + (app.result_at ? rows([['Sonuç Tarihi', dateTime(app.result_at)]]) : '')
                + '<a class="default-btn" href="products.html">Diğer Teklifleri İncele <i class="ri-arrow-right-up-line"></i></a>'
                + '</section>';
        }
        return '';
    }

    function history(app, stage) {
        const items = [['done', 'Başvurunuz oluşturuldu', dateTime(app.created_at)]];
        if (stage.key === 'received') {
            items.push(['current', 'Bilgileriniz kontrol ediliyor', 'Tahmini kalan süre: ' + remaining(stage.checkAt - Date.now())]);
        } else if (stage.key === 'missing') {
            items.push(['failed', 'Eksik bilgilerden ötürü başvuru alınamadı', dateTime(stage.checkAt)]);
        } else {
            items.push(['done', 'Bilgileriniz doğrulandı', dateTime(stage.checkAt)]);
            items.push(['done', 'Başvurunuz ' + bankName(app) + ' değerlendirmesine iletildi', dateTime(stage.checkAt)]);
            if (stage.step === 2) items.push(['current', 'Banka değerlendirmesi sürüyor', 'Sonuçlandığında bu sayfada görüntülenecek']);
            else items.push([stage.key === 'onaylandi' ? 'done' : 'failed',
                stage.key === 'onaylandi' ? 'Başvurunuz onaylandı' : 'Başvurunuz olumlu sonuçlanmadı',
                app.result_at ? dateTime(app.result_at) : '']);
        }
        return '<ol class="kg-history">' + items.map(i => '<li class="' + i[0] + '"><strong>' + esc(i[1]) + '</strong>'
            + (i[2] ? '<small>' + esc(i[2]) + '</small>' : '') + '</li>').join('') + '</ol>';
    }

    function openDetails(id, toResult) {
        const app = apps.find(a => a.id === id);
        if (!app) return;
        const stage = stageOf(app);
        $('#app-modal-ref').textContent = 'Başvuru No: ' + app.reference_no;
        $('#app-modal-title').textContent = [app.bank_name, title(app)].filter(Boolean).join(' · ');
        $('#app-modal-status').innerHTML = pill(stage);
        $('#app-modal-body').innerHTML = result(app, stage)
            + '<div class="kg-detail-section"><h5>Süreç</h5>' + stepper(app, stage) + history(app, stage) + '</div>'
            + '<div class="row g-3">'
            + '<div class="col-md-6"><div class="kg-detail-section h-100"><h5>Kredi Bilgileri</h5>' + rows([
                ['Banka', app.bank_name],
                ['Kredi Türü', app.loan_type],
                ['Kredi Tutarı', tl(app.amount)],
                ['Vade', app.term_months ? app.term_months + ' ay' : ''],
                ['Faiz Oranı', rate(app.interest_rate)],
                ['Aylık Taksit', tl(app.monthly_payment)],
                ['Dosya Masrafı', tl(app.file_fee)],
                ['Toplam Geri Ödeme', tl(app.total_payment)]
            ]) + '</div></div>'
            + '<div class="col-md-6"><div class="kg-detail-section h-100"><h5>Başvuru Sahibi</h5>' + rows([
                ['Ad Soyad', [app.first_name, app.last_name].filter(Boolean).join(' ')],
                ['T.C. Kimlik No', maskTc(app.tc_kimlik_no)],
                ['Doğum Tarihi', app.birth_date ? String(app.birth_date).slice(0, 10).split('-').reverse().join('.') : ''],
                ['Cep Telefonu', maskPhone(app.phone)],
                ['Başvuru Tarihi', dateTime(app.created_at)]
            ]) + '</div></div></div>';
        const modalEl = $('#app-modal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        if (toResult) {
            modalEl.addEventListener('shown.bs.modal', () => {
                const r = $('#app-result');
                if (r) r.scrollIntoView({ block: 'start' });
            }, { once: true });
        }
        modal.show();
    }

    // ---------- Liste ----------

    function render() {
        const stages = apps.map(stageOf);
        const active = stages.filter(s => !s.closed).length;
        $('#apps-stat-total').textContent = apps.length;
        $('#apps-stat-active').textContent = active;
        $('#apps-stat-done').textContent = apps.length - active;

        const count = $('#apps-count');
        count.textContent = active || apps.length;
        count.classList.toggle('d-none', !apps.length);
        count.classList.toggle('live', active > 0);

        const shown = apps.filter((a, i) => filter === 'all' || (filter === 'active') === !stages[i].closed);
        $('#apps-list').innerHTML = shown.map(a => card(a)).join('');
        $('#apps-empty').classList.toggle('d-none', apps.length > 0);
        $('#apps-filter').classList.toggle('d-none', !apps.length);
        $('.kg-apps-stats').classList.toggle('d-none', !apps.length);
        $('#apps-empty-filter').classList.toggle('d-none', !apps.length || shown.length > 0);

        $('#apps-latest').classList.toggle('d-none', !apps.length);
        $('#apps-latest-body').innerHTML = apps.length ? card(apps[0], true) : '';
    }

    function openTab(key) {
        const btn = $('#account-tabs [data-tab="' + key + '"]');
        if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
    }

    async function load() {
        if (!window.KGAuth || !KGAuth.configured) return render();
        const user = await KGAuth.getUser();
        if (!user) return;
        $('#apps-loading').classList.remove('d-none');
        try {
            const { data, error } = await KGAuth.client.from(TABLE).select('*')
                .eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) console.error('Başvurular yüklenemedi:', error);
            apps = data || [];
        } catch (e) {
            console.error('Başvurular yüklenemedi:', e);
        }
        $('#apps-loading').classList.add('d-none');
        render();
    }

    function bind() {
        $('#apps-filter').addEventListener('click', e => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            filter = btn.dataset.filter;
            $$('#apps-filter [data-filter]').forEach(b => b.classList.toggle('active', b === btn));
            render();
        });
        document.addEventListener('click', e => {
            const open = e.target.closest('[data-app-open]');
            if (open) return openDetails(open.dataset.appOpen, open.hasAttribute('data-app-result'));
            const go = e.target.closest('[data-goto-tab]');
            if (go) openTab(go.dataset.gotoTab);
        });
        // Aşamalar zamana bağlı olduğu için sayfa açık kaldıkça güncellenir.
        setInterval(() => { if (apps.length) render(); }, 60000);
    }

    bind();
    load();
})();
