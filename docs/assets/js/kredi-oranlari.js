// Sitedeki tüm faiz oranları, kredi sınırları ve hesaplama kuralları tek yerde.
// Oranlar değiştiğinde yalnızca bu dosyayı güncelleyin ve sayfalardaki ?v= numarasını artırın.
(function () {
    "use strict";

    const KG_RATES = {
        // Ana sayfada ve krediler sayfasında "Son güncelleme" olarak gösterilir.
        updated: '04.10.2026',

        // Aylık akdi faiz (%). Mevduat yıllık brüt faiz (%).
        banks: {
            akbank: { name: 'Akbank', logo: 'akbank.svg?v=20261005', ihtiyac: 2.59, konut: 2.49, tasit: 2.29, mevduat: 53.4 },
            garanti: { name: 'Garanti BBVA', logo: 'garanti.svg?v=20261005', ihtiyac: 2.99, konut: 2.99, tasit: 2.99, mevduat: 53.5 },
            isbankasi: { name: 'İş Bankası', logo: 'isbankasi.svg?v=20261005', ihtiyac: 2.69, konut: 2.49, tasit: 2.39, mevduat: 53.4 },
            qnb: { name: 'QNB', logo: 'qnb.svg?v=20261005', ihtiyac: 2.59, konut: 2.49, tasit: 2.29, mevduat: 53.35 },
            ziraat: { name: 'Ziraat Bankası', logo: 'ziraat.svg?v=20261005', ihtiyac: 2.69, konut: 2.95, tasit: 2.39, mevduat: 53.45 }
        },

        // Faize eklenen vergiler: KKDF ve BSMV. Konut kredisi bu vergilerden muaftır.
        taxes: {
            ihtiyac: { kkdf: 0.15, bsmv: 0.15 },
            tasit: { kkdf: 0.15, bsmv: 0.15 },
            konut: { kkdf: 0, bsmv: 0 }
        },

        // Kredi tahsis ücreti (dosya masrafı): kredi tutarının binde 5'i.
        fileFeeRate: 0.005,

        typeNames: { ihtiyac: 'İhtiyaç Kredisi', konut: 'Konut Kredisi', tasit: 'Taşıt Kredisi' },

        defaults: {
            ihtiyac: { tutar: 10000, vade: 12 },
            konut: { tutar: 100000, vade: 12 },
            tasit: { tutar: 50000, vade: 12 }
        },

        // Tutar aralığına göre izin verilen vade (ay).
        limits: {
            ihtiyac: [
                { min: 10000, max: 125000, minTerm: 6, maxTerm: 36 },
                { min: 125001, max: 250000, minTerm: 6, maxTerm: 24 },
                { min: 250001, max: 1000000, minTerm: 6, maxTerm: 12 }
            ],
            konut: [
                { min: 100000, max: 5000000, minTerm: 12, maxTerm: 120 }
            ],
            tasit: [
                { min: 50000, max: 1750000, minTerm: 12, maxTerm: 48 },
                { min: 1750001, max: 2500000, minTerm: 12, maxTerm: 36 }
            ]
        }
    };

    // Eşit taksitli kredi: vergiler aylık faize eklenerek taksit bulunur.
    function calculate(principal, term, monthlyRate, loanType) {
        const P = Number(principal) || 0;
        const n = Number(term) || 1;
        const tax = KG_RATES.taxes[loanType] || { kkdf: 0, bsmv: 0 };
        const r = (monthlyRate / 100) * (1 + tax.kkdf + tax.bsmv);
        const monthly = r > 0 ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n;
        const installments = monthly * n;
        const fileFee = P * KG_RATES.fileFeeRate;
        return {
            principal: P,
            term: n,
            rate: monthlyRate,
            monthlyPayment: monthly,
            totalInterest: installments - P,
            fileFee: fileFee,
            totalPayment: installments + fileFee,
            // Yıllık maliyet oranı: vergiler ve dosya masrafı dahil, yaklaşık.
            annualCost: annualCostRate(P - fileFee, monthly, n)
        };
    }

    // Eline geçen tutar ile ödenen taksitleri eşitleyen aylık oran, yıllığa çevrilir.
    function annualCostRate(net, monthly, n) {
        if (net <= 0 || monthly <= 0) return 0;
        let lo = 0, hi = 1;
        for (let i = 0; i < 80; i++) {
            const mid = (lo + hi) / 2;
            const pv = mid === 0 ? monthly * n : monthly * (1 - Math.pow(1 + mid, -n)) / mid;
            if (pv > net) lo = mid; else hi = mid;
        }
        return (Math.pow(1 + lo, 12) - 1) * 100;
    }

    // Her kredi türü için en düşük oran (ana sayfadaki "Güncel Faiz Oranları").
    function lowestRate(type) {
        const rates = Object.values(KG_RATES.banks).map(b => b[type]).filter(v => typeof v === 'number');
        return type === 'mevduat' ? Math.max(...rates) : Math.min(...rates);
    }

    function formatRate(v) {
        return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    window.KG_RATES = KG_RATES;
    window.KGLoan = { calculate, lowestRate, formatRate };

    // data-rate="ihtiyac" gibi alanları ve data-rate-updated tarihini doldurur.
    function fill() {
        document.querySelectorAll('[data-rate]').forEach(el => {
            const v = lowestRate(el.dataset.rate);
            el.textContent = el.dataset.rate === 'mevduat'
                ? Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
                : formatRate(v);
        });
        document.querySelectorAll('[data-rate-updated]').forEach(el => { el.textContent = KG_RATES.updated; });
    }
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fill) : fill();
})();
