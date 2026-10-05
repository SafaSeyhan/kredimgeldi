// Ana sayfadaki "Bugünün En Düşük Oranları" kutusunda oranı veren bankaları yazar.
(function () {
    "use strict";

    function fillBanks() {
        if (!window.KG_RATES || !window.KGLoan) return;
        document.querySelectorAll('[data-rate-banks]').forEach(el => {
            const type = el.dataset.rateBanks;
            const best = KGLoan.lowestRate(type);
            const names = Object.values(KG_RATES.banks)
                .filter(b => b[type] === best)
                .map(b => b.name);
            el.textContent = names.join(', ');
        });
    }

    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fillBanks) : fillBanks();
})();
