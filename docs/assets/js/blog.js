// Blog: arama, kategori filtresi, içindekiler, vade tabloları ve paylaş butonları.
(function () {
    "use strict";

    const params = new URLSearchParams(window.location.search);
    const cards = document.querySelectorAll('.kg-blog-list .kg-post-card');
    const filters = document.querySelectorAll('.kg-filter');
    const empty = document.getElementById('blog-empty');
    const normalize = s => (s || '').toLocaleLowerCase('tr-TR');
    let query = (params.get('q') || '').trim();
    let category = params.get('kategori') || '';

    // Liste sayfası: arama ve kategoriye göre kartları süzer.
    function apply() {
        let shown = 0;
        const q = normalize(query);
        cards.forEach(card => {
            const text = normalize(card.dataset.search + ' ' + card.textContent);
            const match = (!category || card.dataset.category === category) && (!q || text.includes(q));
            card.classList.toggle('d-none', !match);
            if (match) shown++;
        });
        filters.forEach(btn => btn.classList.toggle('is-active', btn.dataset.filter === category));
        if (empty) empty.classList.toggle('d-none', shown > 0);
        const featured = document.querySelector('.kg-featured');
        if (featured) featured.classList.toggle('d-none', !featured.querySelector('.kg-post-card:not(.d-none)'));
        const next = new URLSearchParams();
        if (query) next.set('q', query);
        if (category) next.set('kategori', category);
        const qs = next.toString();
        history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
    }

    document.querySelectorAll('.kg-search').forEach(form => {
        const input = form.querySelector('input');
        input.name = 'q';
        input.value = query;
        form.addEventListener('submit', e => {
            e.preventDefault();
            query = input.value.trim();
            if (cards.length) apply();
            else window.location.href = 'blog.html' + (query ? '?q=' + encodeURIComponent(query) : '');
        });
        if (cards.length) {
            input.addEventListener('input', () => {
                query = input.value.trim();
                apply();
            });
        }
    });

    filters.forEach(btn => btn.addEventListener('click', () => {
        category = btn.dataset.filter;
        apply();
    }));

    document.querySelectorAll('[data-reset]').forEach(btn => btn.addEventListener('click', () => {
        query = '';
        category = '';
        document.querySelectorAll('.kg-search input').forEach(i => { i.value = ''; });
        apply();
    }));

    if (cards.length && (query || category)) apply();

    // Yazı sayfası: okunan bölümü içindekiler listesinde işaretler.
    const tocLinks = document.querySelectorAll('.kg-toc a');
    if (tocLinks.length && 'IntersectionObserver' in window) {
        const byId = {};
        tocLinks.forEach(a => { byId[a.getAttribute('href').slice(1)] = a; });
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                tocLinks.forEach(a => a.classList.remove('is-active'));
                const link = byId[entry.target.id];
                if (link) link.classList.add('is-active');
            });
        }, { rootMargin: '0px 0px -70% 0px' });
        document.querySelectorAll('.kg-prose h2[id]').forEach(h => observer.observe(h));
    }

    // Vade sınırı tabloları kredi-oranlari.js'deki güncel değerlerden doldurulur.
    const money = n => Number(n).toLocaleString('tr-TR') + ' TL';
    document.querySelectorAll('[data-limits]').forEach(tbody => {
        const limits = window.KG_RATES && KG_RATES.limits[tbody.dataset.limits];
        if (!limits) {
            tbody.closest('.kg-table-wrap').remove();
            return;
        }
        tbody.innerHTML = limits.map(l =>
            '<tr><td>' + money(l.min) + ' – ' + money(l.max) + '</td><td>' + l.minTerm + ' – ' + l.maxTerm + ' ay</td></tr>'
        ).join('');
    });

    // Paylaş butonları bu sayfanın adresini ilgili platformda paylaşır.
    const pageUrl = window.location.href.split('#')[0].split('?')[0];
    const url = encodeURIComponent(pageUrl);
    const title = encodeURIComponent((document.querySelector('h1') || document.querySelector('title')).textContent.trim());
    const targets = {
        facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url,
        x: 'https://x.com/intent/post?url=' + url + '&text=' + title,
        whatsapp: 'https://wa.me/?text=' + title + '%20' + url,
        linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + url
    };
    document.querySelectorAll('[data-share]').forEach(a => {
        a.href = targets[a.dataset.share];
        a.target = '_blank';
        a.rel = 'noopener';
    });

    document.querySelectorAll('[data-copy-link]').forEach(btn => btn.addEventListener('click', () => {
        const done = () => {
            btn.classList.add('is-copied');
            btn.innerHTML = '<i class="ri-check-line"></i>';
            setTimeout(() => {
                btn.classList.remove('is-copied');
                btn.innerHTML = '<i class="ri-link"></i>';
            }, 2000);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(pageUrl).then(done, () => {});
    }));
})();
