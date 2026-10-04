// Yönetim paneli: başvurular, iletişim mesajları ve bülten aboneleri.
// Yetki Supabase'deki admin_users tablosundan gelir (supabase/formlar_ve_yonetim.sql).
(function () {
    "use strict";

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    const db = window.KGAuth && KGAuth.client;

    const STATUS = {
        alindi: ['Değerlendiriliyor', 'warn'],
        onaylandi: ['Onaylandı', 'success'],
        reddedildi: ['Reddedildi', 'danger']
    };

    let apps = [];
    let messages = [];
    let subscribers = [];
    let appFilter = 'all';
    let messageFilter = 'all';
    let current = null;

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function tl(v) {
        return v == null || v === '' ? '-' : Number(v).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    }
    function dateTime(v) {
        return v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    }
    function birth(v) {
        return v ? String(v).slice(0, 10).split('-').reverse().join('.') : '-';
    }
    function phone(v) {
        let d = String(v || '').replace(/\D/g, '');
        if (d.length === 10) d = '0' + d;
        return d.length === 11 ? d.replace(/(\d{4})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4') : (v || '-');
    }
    function pill(status) {
        const s = STATUS[status] || [status, 'muted'];
        return '<span class="kg-pill ' + s[1] + '">' + esc(s[0]) + '</span>';
    }
    function num(v) {
        const t = String(v || '').trim().replace(/\./g, '').replace(',', '.');
        return t === '' ? null : (isNaN(Number(t)) ? NaN : Number(t));
    }
    function show(id) {
        ['admin-loading', 'admin-denied', 'admin-content'].forEach(x => $('#' + x).classList.toggle('d-none', x !== id));
    }

    // ---------- Yükleme ----------

    async function init() {
        if (!db) {
            $('#admin-denied-text').textContent = 'Üyelik sistemi yapılandırılmadığı için panel açılamadı.';
            return show('admin-denied');
        }
        const user = await KGAuth.requireUser();
        if (!user) return;
        $('#admin-email').textContent = user.email || '';

        const { data: isAdmin, error } = await db.rpc('is_admin');
        if (error || !isAdmin) {
            if (error) {
                console.error(error);
                $('#admin-denied-text').textContent = 'Yönetici yetkileri henüz kurulmamış. supabase/formlar_ve_yonetim.sql dosyasını Supabase SQL Editor\'da çalıştırın.';
            }
            return show('admin-denied');
        }

        await Promise.all([loadApps(), loadMessages(), loadSubscribers()]);
        show('admin-content');
    }

    async function loadApps() {
        const { data, error } = await db.from('loan_applications').select('*').order('created_at', { ascending: false }).limit(1000);
        if (error) console.error(error);
        apps = data || [];
        renderApps();
    }

    async function loadMessages() {
        const { data, error } = await db.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(1000);
        if (error) console.error(error);
        messages = data || [];
        renderMessages();
    }

    async function loadSubscribers() {
        const { data, error } = await db.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }).limit(5000);
        if (error) console.error(error);
        subscribers = data || [];
        renderSubscribers();
    }

    function renderStats() {
        const dayAgo = Date.now() - 24 * 3600 * 1000;
        $('#stat-new').textContent = apps.filter(a => a.status === 'alindi' && new Date(a.created_at).getTime() > dayAgo).length;
        $('#stat-review').textContent = apps.filter(a => a.status === 'alindi').length;
        $('#stat-approved').textContent = apps.filter(a => a.status === 'onaylandi').length;
        $('#stat-unread').textContent = messages.filter(m => !m.is_read).length;
        $('#count-apps').textContent = apps.length;
        $('#count-messages').textContent = messages.length;
        $('#count-subscribers').textContent = subscribers.length;
    }

    // ---------- Başvurular ----------

    function filteredApps() {
        const q = $('#apps-search').value.trim().toLocaleLowerCase('tr-TR');
        return apps.filter(a => {
            if (appFilter !== 'all' && a.status !== appFilter) return false;
            if (!q) return true;
            return [a.first_name, a.last_name, a.tc_kimlik_no, a.phone, a.reference_no, a.bank_name]
                .join(' ').toLocaleLowerCase('tr-TR').includes(q);
        });
    }

    function renderApps() {
        const list = filteredApps();
        $('#apps-body').innerHTML = list.map(a => '<tr data-app="' + esc(a.id) + '" tabindex="0">'
            + '<td>' + esc(dateTime(a.created_at)) + '</td>'
            + '<td><strong>' + esc(a.reference_no) + '</strong></td>'
            + '<td>' + esc((a.first_name || '') + ' ' + (a.last_name || '')) + '<small>' + (a.user_id ? 'Üye' : 'Misafir') + ' · T.C. ' + esc(a.tc_kimlik_no || '-') + '</small></td>'
            + '<td><a href="tel:' + esc(a.phone) + '">' + esc(phone(a.phone)) + '</a></td>'
            + '<td>' + esc(a.bank_name || '-') + '<small>' + esc(a.loan_type || '') + '</small></td>'
            + '<td>' + esc(tl(a.amount)) + '</td>'
            + '<td>' + (a.term_months ? esc(a.term_months) + ' ay' : '-') + '</td>'
            + '<td>' + pill(a.status) + '</td>'
            + '</tr>').join('');
        $('#apps-empty').classList.toggle('d-none', list.length > 0);
        renderStats();
    }

    function openApp(id) {
        current = apps.find(a => a.id === id);
        if (!current) return;
        const a = current;
        $('#app-modal-ref').textContent = 'Başvuru No ' + a.reference_no + ' · ' + dateTime(a.created_at);
        $('#app-modal-title').textContent = (a.first_name || '') + ' ' + (a.last_name || '');
        const rows = items => items.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>').join('');
        $('#app-modal-person').innerHTML = rows([
            ['Ad Soyad', esc((a.first_name || '') + ' ' + (a.last_name || ''))],
            ['T.C. Kimlik No', esc(a.tc_kimlik_no || '-')],
            ['Doğum Tarihi', esc(birth(a.birth_date))],
            ['Cep Telefonu', a.phone ? '<a href="tel:' + esc(a.phone) + '">' + esc(phone(a.phone)) + '</a>' : '-'],
            ['Hesap', a.user_id ? 'Üye' : 'Misafir (üye değil)']
        ]);
        $('#app-modal-offer').innerHTML = rows([
            ['Banka', esc(a.bank_name || '-')],
            ['Ürün', esc(a.loan_type || '-')],
            ['Tutar', esc(tl(a.amount))],
            ['Vade', a.term_months ? esc(a.term_months) + ' ay' : '-'],
            ['Aylık Faiz', a.interest_rate != null ? '%' + esc(String(a.interest_rate).replace('.', ',')) : '-'],
            ['Aylık Taksit', esc(tl(a.monthly_payment))],
            ['Toplam Geri Ödeme', esc(tl(a.total_payment))]
        ]);
        const form = $('#result-form');
        form.status.value = a.status || 'alindi';
        form.result_amount.value = a.result_amount != null ? String(a.result_amount).replace('.', ',') : '';
        form.result_rate.value = a.result_rate != null ? String(a.result_rate).replace('.', ',') : '';
        form.result_term.value = a.result_term != null ? a.result_term : '';
        form.result_monthly.value = a.result_monthly != null ? String(a.result_monthly).replace('.', ',') : '';
        form.result_note.value = a.result_note || '';
        toggleApprove();
        message('');
        bootstrap.Modal.getOrCreateInstance($('#app-modal')).show();
    }

    function toggleApprove() {
        const approved = $('#result-form').status.value === 'onaylandi';
        $$('.kg-approve-only').forEach(el => el.classList.toggle('d-none', !approved));
    }

    function message(text, type) {
        const box = $('#result-message');
        box.className = 'kg-admin-message alert alert-' + (type || 'danger') + ' mt-3' + (text ? '' : ' d-none');
        box.textContent = text;
    }

    async function saveResult(e) {
        e.preventDefault();
        if (!current) return;
        const form = e.target;
        const status = form.status.value;
        const change = { status, result_note: form.result_note.value.trim() || null };
        if (status === 'onaylandi') {
            const fields = { result_amount: form.result_amount.value, result_rate: form.result_rate.value, result_term: form.result_term.value, result_monthly: form.result_monthly.value };
            for (const [k, v] of Object.entries(fields)) {
                const n = num(v);
                if (Number.isNaN(n)) return message('Sayı alanlarına yalnızca rakam girin.');
                change[k] = k === 'result_term' && n != null ? Math.round(n) : n;
            }
        } else {
            Object.assign(change, { result_amount: null, result_rate: null, result_term: null, result_monthly: null });
        }
        change.result_at = status === 'alindi' ? null : (current.status === status && current.result_at ? current.result_at : new Date().toISOString());

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        const { data, error } = await db.from('loan_applications').update(change).eq('id', current.id).select('*').single();
        button.disabled = false;
        if (error) {
            console.error(error);
            return message('Kaydedilemedi: ' + (error.message || 'bilinmeyen hata'));
        }
        Object.assign(current, data || change);
        renderApps();
        message('Kaydedildi.', 'success');
    }

    // ---------- Mesajlar ----------

    function renderMessages() {
        const list = messages.filter(m => messageFilter === 'all' || !m.is_read);
        $('#messages-list').innerHTML = list.map(m => '<article class="kg-admin-msg' + (m.is_read ? '' : ' unread') + '" data-msg="' + esc(m.id) + '">'
            + '<header><strong>' + esc(m.name) + '</strong>'
            + '<span>' + esc(dateTime(m.created_at)) + (m.page ? ' · ' + esc(m.page) : '') + '</span></header>'
            + (m.subject ? '<h5>' + esc(m.subject) + '</h5>' : '')
            + '<p>' + esc(m.message) + '</p>'
            + '<footer><a href="mailto:' + esc(m.email) + '?subject=' + encodeURIComponent('Re: ' + (m.subject || 'KredimGeldi')) + '"><i class="ri-reply-line"></i> ' + esc(m.email) + '</a>'
            + (m.phone ? '<a href="tel:' + esc(m.phone) + '"><i class="ri-phone-line"></i> ' + esc(m.phone) + '</a>' : '')
            + (m.is_read ? '' : '<button type="button" class="kg-admin-btn" data-read="' + esc(m.id) + '"><i class="ri-check-line"></i> Okundu</button>')
            + '</footer></article>').join('');
        $('#messages-empty').classList.toggle('d-none', list.length > 0);
        renderStats();
    }

    async function markRead(id) {
        const { error } = await db.from('contact_messages').update({ is_read: true }).eq('id', id);
        if (error) return console.error(error);
        const m = messages.find(x => x.id === id);
        if (m) m.is_read = true;
        renderMessages();
    }

    // ---------- Bülten ----------

    function renderSubscribers() {
        $('#subscribers-body').innerHTML = subscribers.map(s => '<tr><td>' + esc(s.email) + '</td><td>' + esc(dateTime(s.created_at)) + '</td></tr>').join('');
        $('#subscribers-empty').classList.toggle('d-none', subscribers.length > 0);
        renderStats();
    }

    // ---------- CSV ----------

    function csv(name, header, rows) {
        const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const text = '﻿' + [header, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
        a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    const EXPORTS = {
        apps: () => csv('basvurular',
            ['Tarih', 'Başvuru No', 'Ad', 'Soyad', 'T.C. Kimlik No', 'Doğum Tarihi', 'Telefon', 'Hesap', 'Banka', 'Ürün', 'Tutar', 'Vade', 'Aylık Faiz', 'Aylık Taksit', 'Durum', 'Not'],
            filteredApps().map(a => [dateTime(a.created_at), a.reference_no, a.first_name, a.last_name, a.tc_kimlik_no, birth(a.birth_date), a.phone,
                a.user_id ? 'Üye' : 'Misafir', a.bank_name, a.loan_type, a.amount, a.term_months, a.interest_rate, a.monthly_payment,
                (STATUS[a.status] || [a.status])[0], a.result_note])),
        messages: () => csv('mesajlar', ['Tarih', 'Ad Soyad', 'E-posta', 'Telefon', 'Konu', 'Mesaj', 'Sayfa'],
            messages.map(m => [dateTime(m.created_at), m.name, m.email, m.phone, m.subject, m.message, m.page])),
        subscribers: () => csv('bulten', ['E-posta', 'Tarih'], subscribers.map(s => [s.email, dateTime(s.created_at)]))
    };

    // ---------- Olaylar ----------

    document.addEventListener('click', e => {
        const tab = e.target.closest('.kg-admin-tabs button');
        if (tab) {
            $$('.kg-admin-tabs button').forEach(b => b.classList.toggle('active', b === tab));
            $$('.kg-admin-panel').forEach(p => p.classList.toggle('d-none', p.dataset.panel !== tab.dataset.tab));
            return;
        }
        const af = e.target.closest('#apps-filter button');
        if (af) {
            appFilter = af.dataset.filter;
            $$('#apps-filter button').forEach(b => b.classList.toggle('active', b === af));
            return renderApps();
        }
        const mf = e.target.closest('#messages-filter button');
        if (mf) {
            messageFilter = mf.dataset.filter;
            $$('#messages-filter button').forEach(b => b.classList.toggle('active', b === mf));
            return renderMessages();
        }
        const row = e.target.closest('[data-app]');
        if (row && !e.target.closest('a')) return openApp(row.dataset.app);
        const read = e.target.closest('[data-read]');
        if (read) return markRead(read.dataset.read);
        const exp = e.target.closest('[data-export]');
        if (exp) return EXPORTS[exp.dataset.export]();
        if (e.target.closest('#copy-emails')) {
            const btn = e.target.closest('#copy-emails');
            navigator.clipboard.writeText(subscribers.map(s => s.email).join(', ')).then(() => {
                const old = btn.innerHTML;
                btn.innerHTML = '<i class="ri-check-line"></i> Kopyalandı';
                setTimeout(() => { btn.innerHTML = old; }, 1500);
            });
        }
    });
    document.addEventListener('keydown', e => {
        const row = e.target.closest && e.target.closest('[data-app]');
        if (row && e.key === 'Enter') openApp(row.dataset.app);
    });
    $('#apps-search').addEventListener('input', renderApps);
    $('#result-form').addEventListener('submit', saveResult);
    $('#result-form').status.addEventListener('change', toggleApprove);

    init();
})();
