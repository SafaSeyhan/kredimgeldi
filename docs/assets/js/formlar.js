// İletişim formları (data-kg-contact) ve footer'daki bülten aboneliği.
// Mesajlar Supabase'deki contact_messages, aboneler newsletter_subscribers tablosuna kaydedilir
// (supabase/formlar_ve_yonetim.sql). Yönetim panelinden (yonetim.html) okunur.
(function () {
    "use strict";

    const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    function client() {
        return window.KGAuth && KGAuth.client ? KGAuth.client : null;
    }

    function message(form, text, type) {
        let box = form.querySelector('.kg-form-message');
        if (!box) {
            box = document.createElement('div');
            box.className = 'kg-form-message';
            box.setAttribute('role', 'status');
            const button = form.querySelector('button[type="submit"]');
            if (form.matches('.footer-form')) form.insertAdjacentElement('afterend', box);
            else button ? button.insertAdjacentElement('beforebegin', box) : form.appendChild(box);
        }
        box.className = 'kg-form-message alert alert-' + (type || 'danger') + ' py-2 px-3 mb-3' + (form.matches('.footer-form') ? ' mt-3' : '') + (text ? '' : ' d-none');
        box.textContent = text || '';
    }

    function busy(form, on) {
        form.querySelectorAll('button, input, textarea').forEach(el => { el.disabled = on; });
    }

    async function sendContact(form) {
        const get = name => (form.elements[name] ? form.elements[name].value.trim() : '');
        const row = {
            name: get('name'),
            email: get('email'),
            phone: get('phone') || null,
            subject: get('subject') || null,
            message: get('message'),
            page: (window.location.pathname.split('/').pop() || 'index.html').slice(0, 100)
        };
        if (!row.name || !row.email || !row.message) return message(form, 'Lütfen adınızı, e-posta adresinizi ve mesajınızı yazın.');
        if (!EMAIL.test(row.email)) return message(form, 'Geçerli bir e-posta adresi girin.');
        const db = client();
        if (!db) return message(form, 'Mesajınız şu anda gönderilemedi. Lütfen info@kredimgeldi.com adresine yazın.');

        message(form, '');
        busy(form, true);
        const { error } = await db.from('contact_messages').insert(row);
        busy(form, false);
        if (error) {
            console.error('Mesaj gönderilemedi:', error);
            return message(form, 'Mesajınız şu anda gönderilemedi. Lütfen biraz sonra tekrar deneyin veya info@kredimgeldi.com adresine yazın.');
        }
        form.reset();
        message(form, 'Teşekkürler! Mesajınız bize ulaştı, en kısa sürede size dönüş yapacağız.', 'success');
    }

    async function subscribe(form) {
        const input = form.querySelector('input[type="email"]');
        const email = input ? input.value.trim().toLowerCase() : '';
        if (!EMAIL.test(email)) return message(form, 'Geçerli bir e-posta adresi girin.');
        const db = client();
        if (!db) return message(form, 'Aboneliğiniz şu anda alınamadı. Lütfen biraz sonra tekrar deneyin.');

        message(form, '');
        busy(form, true);
        const { error } = await db.from('newsletter_subscribers').insert({ email });
        busy(form, false);
        // Zaten aboneyse (23505) de başarılı sayılır.
        if (error && error.code !== '23505') {
            console.error('Abonelik alınamadı:', error);
            return message(form, 'Aboneliğiniz şu anda alınamadı. Lütfen biraz sonra tekrar deneyin.');
        }
        form.reset();
        message(form, 'Teşekkürler! Kampanya ve fırsatları e-posta ile göndereceğiz.', 'success');
    }

    // Footer sayfaya sonradan eklendiği için olay document üzerinden dinlenir.
    document.addEventListener('submit', e => {
        const form = e.target;
        if (form.matches('[data-kg-contact]')) {
            e.preventDefault();
            sendContact(form);
        } else if (form.matches('.footer-form')) {
            e.preventDefault();
            subscribe(form);
        }
    });
})();
