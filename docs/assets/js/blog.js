// Blog: arama kutusu ve paylaş butonları.
(function () {
    "use strict";

    // Arama: detay sayfalarında blog.html?q=... adresine gider, blog.html'de yazıları süzer.
    const params = new URLSearchParams(window.location.search);
    const query = (params.get('q') || '').trim();
    const cards = document.querySelectorAll('.single-blog-card');
    const normalize = s => s.toLocaleLowerCase('tr-TR');

    function filter(q) {
        let shown = 0;
        cards.forEach(card => {
            const col = card.parentElement;
            const match = !q || normalize(card.textContent).includes(normalize(q));
            col.classList.toggle('d-none', !match);
            if (match) shown++;
        });
        let empty = document.getElementById('blog-empty');
        if (!empty && cards.length) {
            empty = document.createElement('p');
            empty.id = 'blog-empty';
            empty.className = 'd-none';
            cards[0].parentElement.parentElement.appendChild(empty);
        }
        if (empty) {
            empty.textContent = '"' + q + '" ile ilgili yazı bulunamadı.';
            empty.classList.toggle('d-none', shown > 0);
        }
    }

    document.querySelectorAll('.sidebar-form').forEach(form => {
        const input = form.querySelector('input');
        if (!input) return;
        input.name = 'q';
        input.value = query;
        form.addEventListener('submit', e => {
            e.preventDefault();
            const q = input.value.trim();
            if (cards.length) {
                filter(q);
                history.replaceState(null, '', q ? '?q=' + encodeURIComponent(q) : window.location.pathname);
            } else {
                window.location.href = 'blog.html' + (q ? '?q=' + encodeURIComponent(q) : '');
            }
        });
    });
    if (query && cards.length) filter(query);

    // Paylaş butonları bu sayfanın adresini ilgili platformda paylaşır.
    const url = encodeURIComponent(window.location.href.split('#')[0].split('?')[0]);
    const title = encodeURIComponent((document.querySelector('h1, .blog-details-content h2, h2') || document.querySelector('title')).textContent.trim());
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
})();
