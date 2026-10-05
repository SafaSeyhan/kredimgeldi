// Hizmetler sayfalarındaki hesaplayıcılar ve kampanya filtresi.
// Her araç yalnızca sayfada ilgili data-tool alanı varsa çalışır.
(function () {
    "use strict";

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    const tl = v => Math.round(v).toLocaleString('tr-TR') + ' TL';
    const pct = v => '%' + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

    // "125.000" gibi yazılan tutarı sayıya çevirir.
    function num(input) {
        if (!input) return 0;
        const raw = String(input.value).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
        return Number(raw) || 0;
    }

    // Tutar alanlarını yazarken binlik ayraçla gösterir.
    function moneyInput(input, onChange) {
        input.addEventListener('input', () => {
            const digits = input.value.replace(/\D/g, '').slice(0, 10);
            input.value = digits ? Number(digits).toLocaleString('tr-TR') : '';
            onChange();
        });
    }

    function bind(root, run) {
        $$('[data-money]', root).forEach(el => moneyInput(el, run));
        $$('input:not([data-money]), select', root).forEach(el => {
            el.addEventListener('input', run);
            el.addEventListener('change', run);
        });
        run();
    }

    // Kaydırıcı ile sayı alanını birbirine bağlar.
    function pair(root, field, slider) {
        const a = $(field, root);
        const b = $(slider, root);
        if (!a || !b) return;
        a.addEventListener('input', () => { b.value = a.value; });
        b.addEventListener('input', () => { a.value = b.value; a.dispatchEvent(new Event('change')); });
    }

    // ---------- Kredi notu ----------
    const BANDS = [
        { max: 699, name: 'En Riskli', color: '#e5533d', text: 'Bu aralıkta kredi ve kart başvuruları çoğunlukla olumsuz sonuçlanır. Önce gecikmiş borçlarını kapatmaya ve ödemeleri düzenli hale getirmeye odaklan.' },
        { max: 1099, name: 'Orta Riskli', color: '#f39b2f', text: 'Bazı bankalar başvurunu değerlendirebilir ama limit ve faiz şartları sınırlı kalabilir. Kart borcunu limitinin altında tutmak notunu hızla yukarı taşır.' },
        { max: 1499, name: 'Az Riskli', color: '#d9b500', text: 'Çoğu bankada başvurun değerlendirmeye alınır. Birkaç ay düzenli ödeme ve az sayıda yeni başvuru ile daha iyi tekliflere ulaşabilirsin.' },
        { max: 1699, name: 'İyi', color: '#6fa300', text: 'Bankaların büyük çoğunluğu için güçlü bir profil. Teklifleri karşılaştırarak daha düşük faizli seçenekleri tercih edebilirsin.' },
        { max: 1900, name: 'Çok İyi', color: '#3fa34d', text: 'En avantajlı faiz ve limit tekliflerine ulaşabileceğin aralıktasın. Bu seviyeyi korumak için ödemelerini aksatma.' }
    ];

    function karne(root) {
        const input = $('[name="score"]', root);
        pair(root, '[name="score"]', '[name="score-range"]');
        bind(root, () => {
            const score = Math.min(1900, Math.max(1, Math.round(num(input)) || 1));
            const band = BANDS.find(b => score <= b.max);
            $('[data-score-pin]', root).style.left = ((score - 1) / 1899 * 100) + '%';
            const badge = $('[data-score-band]', root);
            badge.textContent = band.name;
            badge.style.background = band.color;
            $('[data-score-value]', root).textContent = score.toLocaleString('tr-TR');
            $('[data-score-text]', root).textContent = band.text;
        });
    }

    // ---------- Kredi kartı borcu ----------
    function kart(root) {
        bind(root, () => {
            const debt = num($('[name="debt"]', root));
            const pay = num($('[name="pay"]', root));
            const rate = num($('[name="rate"]', root));
            // Kart faizine KKDF (%15) ve BSMV (%15) eklenir.
            const r = rate / 100 * 1.3;
            const warn = $('[data-kart-warn]', root);
            let months = 0, interest = 0, left = debt;
            const enough = pay > left * r;
            if (debt > 0 && pay > 0 && enough) {
                while (left > 0.5 && months < 600) {
                    const i = left * r;
                    interest += i;
                    left = left + i - pay;
                    months++;
                }
            }
            warn.classList.toggle('d-none', !(debt > 0 && pay > 0 && !enough));
            const y = Math.floor(months / 12), m = months % 12;
            $('[data-kart-months]', root).textContent = debt > 0 && pay > 0 && enough
                ? (y ? y + ' yıl ' : '') + (m ? m + ' ay' : '') : '-';
            $('[data-kart-interest]', root).textContent = enough && debt ? tl(interest) : '-';
            $('[data-kart-total]', root).textContent = enough && debt ? tl(debt + interest) : '-';
            $('[data-kart-rate]', root).textContent = rate ? pct(rate * 1.3) : '-';
        });
    }

    // ---------- Mevduat getirisi ----------
    function mevduat(root) {
        const rows = $('[data-mevduat-rows]');
        bind(root, () => {
            const amount = num($('[name="amount"]', root));
            const days = Number($('[name="days"]', root).value) || 32;
            const tax = num($('[name="tax"]', root));
            const banks = window.KG_RATES ? Object.entries(KG_RATES.banks)
                .filter(([, b]) => typeof b.mevduat === 'number')
                .map(([key, b]) => {
                    const gross = amount * b.mevduat / 100 * days / 365;
                    return { key, b, gross, net: gross * (1 - tax / 100) };
                })
                .sort((a, b) => b.net - a.net) : [];
            const best = banks[0];
            if (!best) return;
            $('[data-mevduat-net]', root).textContent = tl(best.net);
            $('[data-mevduat-bank]', root).textContent = best.b.name + ' · ' + pct(best.b.mevduat) + ' yıllık';
            $('[data-mevduat-gross]', root).textContent = tl(best.gross);
            $('[data-mevduat-tax]', root).textContent = tl(best.gross - best.net);
            $('[data-mevduat-end]', root).textContent = tl(amount + best.net);
            if (rows) {
                $$('[data-mevduat-days]').forEach(el => { el.textContent = days; });
                rows.innerHTML = banks.map((x, i) => '<tr' + (i === 0 ? ' class="is-best"' : '') + '>' +
                    '<td><span class="kg-table-bank">' + x.b.name + (i === 0 ? '<span class="kg-table-best">En yüksek</span>' : '') + '</span></td>' +
                    '<td>' + pct(x.b.mevduat) + '</td>' +
                    '<td class="kg-hide-sm">' + tl(x.gross) + '</td>' +
                    '<td><b>' + tl(x.net) + '</b></td></tr>').join('');
            }
        });
    }

    // ---------- Birikim / yatırım ----------
    function yatirim(root) {
        pair(root, '[name="years"]', '[name="years-range"]');
        bind(root, () => {
            const start = num($('[name="start"]', root));
            const monthly = num($('[name="monthly"]', root));
            const years = Math.min(40, Math.max(1, num($('[name="years"]', root)) || 1));
            const rate = num($('[name="rate"]', root));
            const n = years * 12;
            const r = rate / 100 / 12;
            const fv = r > 0
                ? start * Math.pow(1 + r, n) + monthly * (Math.pow(1 + r, n) - 1) / r
                : start + monthly * n;
            const paid = start + monthly * n;
            $('[data-yatirim-total]', root).textContent = tl(fv);
            $('[data-yatirim-years]', root).textContent = years + ' yıl sonra';
            $('[data-yatirim-paid]', root).textContent = tl(paid);
            $('[data-yatirim-gain]', root).textContent = tl(fv - paid);
        });
    }

    // ---------- Sigorta ihtiyaç listesi ----------
    const COVERS = {
        dask: { name: 'DASK (Zorunlu Deprem Sigortası)', short: 'DASK', must: true },
        konut: { name: 'Konut Sigortası', short: 'Konut', must: false },
        esya: { name: 'Konut Sigortası (eşya teminatı)', short: 'Eşya', must: false },
        trafik: { name: 'Zorunlu Trafik Sigortası', short: 'Trafik', must: true },
        kasko: { name: 'Kasko', short: 'Kasko', must: false },
        hayat: { name: 'Hayat Sigortası', short: 'Hayat', must: false },
        tss: { name: 'Tamamlayıcı Sağlık Sigortası', short: 'TSS', must: false },
        seyahat: { name: 'Seyahat Sağlık Sigortası', short: 'Seyahat', must: false }
    };
    const NEEDS = {
        evsahibi: ['dask', 'konut'],
        kiraci: ['esya'],
        arac: ['trafik', 'kasko'],
        kredi: ['hayat'],
        aile: ['hayat'],
        saglik: ['tss'],
        seyahat: ['seyahat']
    };

    function sigorta(root) {
        bind(root, () => {
            const picked = $$('input[type="checkbox"]:checked', root).map(el => el.value);
            const keys = [...new Set(picked.flatMap(p => NEEDS[p] || []))];
            const list = $('[data-sigorta-list]', root);
            const empty = $('[data-sigorta-empty]', root);
            empty.classList.toggle('d-none', keys.length > 0);
            list.innerHTML = keys
                .sort((a, b) => COVERS[b].must - COVERS[a].must)
                .map(k => '<li><span>' + COVERS[k].name + '</span><b>' + (COVERS[k].must ? 'Zorunlu' : 'Önerilir') + '</b></li>')
                .join('');
            const btn = $('[data-sigorta-apply]', root);
            if (btn) btn.dataset.typeName = keys.length ? 'Sigorta Teklifi: ' + keys.map(k => COVERS[k].short).join(', ') : 'Sigorta Teklifi';
        });
    }

    // ---------- Kampanya filtresi ----------
    function filters(bar) {
        const cards = $$('[data-cat]');
        const buttons = $$('[data-filter]', bar);
        buttons.forEach(btn => {
            const f = btn.dataset.filter;
            const count = f ? cards.filter(c => c.dataset.cat.split(' ').includes(f)).length : cards.length;
            const small = $('small', btn);
            if (small) small.textContent = count;
            btn.addEventListener('click', () => {
                buttons.forEach(b => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', b === btn); });
                cards.forEach(c => { c.hidden = Boolean(f) && !c.dataset.cat.split(' ').includes(f); });
            });
        });
    }

    function init() {
        const tools = { karne, kart, mevduat, yatirim, sigorta };
        $$('[data-tool]').forEach(root => {
            const fn = tools[root.dataset.tool];
            if (fn) fn(root);
        });
        const bar = $('[data-filters]');
        if (bar) filters(bar);
    }

    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
