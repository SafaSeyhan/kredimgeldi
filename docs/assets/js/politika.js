// Politika sayfaları: içindekiler vurgusu, mobilde katlanır liste ve yazdırma
(function () {
    var toc = document.querySelector('.kg-policy-toc');
    if (!toc) return;

    var mobile = window.matchMedia('(max-width: 991.98px)');
    if (mobile.matches) toc.removeAttribute('open');

    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    links.forEach(function (link) {
        link.addEventListener('click', function () {
            if (mobile.matches) toc.removeAttribute('open');
        });
    });

    var sections = links.map(function (link) {
        return document.getElementById(link.getAttribute('href').slice(1));
    }).filter(Boolean);

    function setActive() {
        var current = sections[0];
        sections.forEach(function (sec) {
            if (sec.getBoundingClientRect().top < 160) current = sec;
        });
        links.forEach(function (link) {
            link.classList.toggle('is-active', link.getAttribute('href') === '#' + current.id);
        });
    }

    if (sections.length) {
        window.addEventListener('scroll', setActive, { passive: true });
        setActive();
    }

    var print = document.querySelector('[data-kg-print]');
    if (print) {
        print.addEventListener('click', function () {
            window.print();
        });
    }
})();
