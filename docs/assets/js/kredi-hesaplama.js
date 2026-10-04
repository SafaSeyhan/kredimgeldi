// Kredi hesaplama kartının görsel kısmı: vade kaydırıcısının dolu bölümü ve
// seçilen kredi türüne göre tutar/vade aralığı yazıları.
// Hesaplama mantığı sayfadaki betikte; bu dosya o fonksiyonlar çalıştıktan sonra görünümü yeniler.
(function () {
    "use strict";

    function fmt(n) { return Number(n).toLocaleString('tr-TR'); }

    function refresh() {
        const slider = document.getElementById('vade-slider');
        if (!slider) return;
        const min = Number(slider.min) || 1;
        const max = Number(slider.max) || 36;
        const value = Number(slider.value) || min;
        slider.style.setProperty('--fill', (max > min ? (value - min) / (max - min) * 100 : 100) + '%');

        const minEl = document.querySelector('[data-calc-min]');
        const maxEl = document.querySelector('[data-calc-max]');
        if (minEl) minEl.textContent = min + ' ay';
        if (maxEl) maxEl.textContent = max + ' ay';

        const rangeEl = document.querySelector('[data-calc-range]');
        if (rangeEl && typeof LOAN_LIMITS !== 'undefined' && typeof getSelectedLoanType === 'function') {
            const limits = LOAN_LIMITS[getSelectedLoanType()];
            if (limits) {
                const lo = Math.min(...limits.map(l => l.min));
                const hi = Math.max(...limits.map(l => l.max));
                rangeEl.textContent = fmt(lo) + ' ₺ – ' + fmt(hi) + ' ₺';
            }
        }
    }

    // Sayfadaki fonksiyonlar değerleri kod ile değiştirdiğinde (olay tetiklenmez) görünümü güncellemek için sarmalıyoruz.
    ['syncSliderWithInput', 'syncInputWithSlider', 'setDefaultValues', 'updateLimitsBasedOnType', 'formatNumber'].forEach(name => {
        const fn = window[name];
        if (typeof fn !== 'function') return;
        window[name] = function () {
            const result = fn.apply(this, arguments);
            refresh();
            return result;
        };
    });

    document.addEventListener('input', e => { if (e.target.closest && e.target.closest('.kg-calc')) refresh(); });
    document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest('.kg-calc-type')) setTimeout(refresh, 0);
    });
    // Vade sınırları sayfa açılırken de seçili kredi türüne göre ayarlansın.
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
        if (typeof updateLimitsBasedOnType === 'function' && typeof getSelectedLoanType === 'function') {
            updateLimitsBasedOnType(getSelectedLoanType());
        }
        refresh();
    }, 0));
    refresh();
})();
