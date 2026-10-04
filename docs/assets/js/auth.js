// KredimGeldi üyelik sistemi (Supabase Auth).
// Sayfalarda şu sırayla yüklenmelidir:
//   supabase-js (CDN) -> assets/js/auth-config.js -> assets/js/auth.js
(function () {
    "use strict";

    const REMEMBER_KEY = 'kg-remember-me';
    const config = window.KG_AUTH_CONFIG || {};
    const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);

    // "Beni Hatırla" işaretliyse oturum localStorage'da, değilse sekme kapanınca silinen
    // sessionStorage'da tutulur.
    function rememberMe() {
        try { return localStorage.getItem(REMEMBER_KEY) !== 'false'; } catch (e) { return true; }
    }

    const storage = {
        getItem(key) {
            try { return localStorage.getItem(key) ?? sessionStorage.getItem(key); } catch (e) { return null; }
        },
        setItem(key, value) {
            try {
                const [keep, drop] = rememberMe() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
                keep.setItem(key, value);
                drop.removeItem(key);
            } catch (e) { }
        },
        removeItem(key) {
            try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch (e) { }
        }
    };

    const client = configured
        ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
        })
        : null;

    // E-postadaki bağlantılardan dönüldüğünde Supabase bilgileri URL'nin # kısmında gönderir.
    // supabase-js bu kısmı okuyup temizlediği için yüklenir yüklenmez saklıyoruz.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    let recovery = hashParams.get('type') === 'recovery';
    const urlError = hashParams.get('error_description');

    function pageUrl(page) {
        return new URL(page, window.location.href).href.split('#')[0].split('?')[0];
    }

    const ERROR_MESSAGES = {
        'Invalid login credentials': 'E-posta veya şifre hatalı.',
        'Email not confirmed': 'Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzu kontrol edin.',
        'User already registered': 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.',
        'Unable to validate email address: invalid format': 'Geçerli bir e-posta adresi girin.',
        'New password should be different from the old password.': 'Yeni şifre eski şifrenizden farklı olmalı.',
        'Auth session missing!': 'Oturumunuzun süresi doldu. Lütfen tekrar deneyin.'
    };

    function translateError(error) {
        if (!error) return '';
        const msg = error.message || String(error);
        if (ERROR_MESSAGES[msg]) return ERROR_MESSAGES[msg];
        if (/Password should be at least/i.test(msg)) return 'Şifre en az 8 karakter olmalı.';
        if (/rate limit|too many/i.test(msg)) return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.';
        if (/provider is not enabled/i.test(msg)) return 'Bu giriş yöntemi henüz aktif değil.';
        if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
        return 'Bir hata oluştu: ' + msg;
    }

    function notConfiguredError() {
        return { message: 'Üyelik sistemi henüz yapılandırılmadı. Lütfen daha sonra tekrar deneyin.' };
    }

    // Formların üstünde Bootstrap alert'i ile mesaj gösterir.
    function showMessage(form, text, type) {
        let box = form.querySelector('.kg-auth-message');
        if (!box) {
            box = document.createElement('div');
            box.className = 'kg-auth-message alert';
            box.setAttribute('role', 'alert');
            const heading = form.querySelector('h2, h3');
            heading ? heading.insertAdjacentElement('afterend', box) : form.prepend(box);
        }
        box.className = 'kg-auth-message alert alert-' + (type || 'danger');
        box.textContent = text;
        box.classList.toggle('d-none', !text);
    }

    function setBusy(form, busy) {
        form.querySelectorAll('button, input').forEach(el => { el.disabled = busy; });
    }

    const KGAuth = {
        configured,
        client,
        showMessage,
        setBusy,
        translateError,

        // Şifre sıfırlama e-postasındaki bağlantıyla mı gelindi?
        isRecovery() { return recovery; },
        // E-posta bağlantısı geçersiz/süresi dolmuşsa hata mesajı.
        urlError() {
            if (!urlError) return '';
            return /expired|invalid/i.test(urlError)
                ? 'Bağlantının süresi dolmuş veya geçersiz. Lütfen yeni bir bağlantı isteyin.'
                : urlError;
        },

        async getUser() {
            if (!client) return null;
            const { data } = await client.auth.getSession();
            return data.session ? data.session.user : null;
        },

        async signIn(email, password, remember) {
            if (!client) return { error: notConfiguredError() };
            try { localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false'); } catch (e) { }
            return client.auth.signInWithPassword({ email, password });
        },

        async signUp(name, email, password) {
            if (!client) return { error: notConfiguredError() };
            return client.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name },
                    emailRedirectTo: pageUrl('hesabim.html')
                }
            });
        },

        async signInWithProvider(provider) {
            if (!client) return { error: notConfiguredError() };
            return client.auth.signInWithOAuth({
                provider,
                options: { redirectTo: pageUrl('hesabim.html') }
            });
        },

        async sendPasswordReset(email) {
            if (!client) return { error: notConfiguredError() };
            return client.auth.resetPasswordForEmail(email, { redirectTo: pageUrl('password.html') });
        },

        async updatePassword(password) {
            if (!client) return { error: notConfiguredError() };
            return client.auth.updateUser({ password });
        },

        async signOut() {
            if (client) await client.auth.signOut();
            window.location.href = 'index.html';
        },

        // Giriş yapılmamışsa login sayfasına yönlendirir.
        async requireUser() {
            const user = await KGAuth.getUser();
            if (!user) {
                window.location.replace('login.html?next=' + encodeURIComponent(window.location.pathname.split('/').pop()));
                return null;
            }
            return user;
        },

        displayName(user) {
            const meta = (user && user.user_metadata) || {};
            return meta.full_name || meta.name || (user && user.email ? user.email.split('@')[0] : '');
        }
    };

    window.KGAuth = KGAuth;

    // --- Header / mobil menüdeki "Giriş Yap" ve "Üye Ol" butonlarını oturuma göre günceller ---
    // Header ve mobil menü sayfaya fetch ile sonradan eklendiği için DOM değişikliklerini izliyoruz.
    let currentUser = null;

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function renderNav() {
        document.querySelectorAll('.others-options ul').forEach(ul => {
            const state = currentUser ? 'in' : 'out';
            if (ul.dataset.kgAuth === state) return;
            ul.dataset.kgAuth = state;
            if (currentUser) {
                if (!ul.dataset.kgOriginal) ul.dataset.kgOriginal = ul.innerHTML;
                ul.innerHTML =
                    '<li><a href="hesabim.html" class="search-btn login"><i class="ri-account-circle-line"></i> ' +
                    escapeHtml(KGAuth.displayName(currentUser)) + '</a></li>' +
                    '<li><a href="#" class="default-btn" data-kg-signout> Çıkış Yap <i class="ri-logout-box-r-line"></i></a></li>';
            } else if (ul.dataset.kgOriginal) {
                ul.innerHTML = ul.dataset.kgOriginal;
            }
        });
    }

    document.addEventListener('click', e => {
        const link = e.target.closest('[data-kg-signout]');
        if (link) {
            e.preventDefault();
            KGAuth.signOut();
        }
    });

    if (client) {
        client.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') recovery = true;
            currentUser = session ? session.user : null;
            renderNav();
        });

        const observer = new MutationObserver(() => { if (currentUser) renderNav(); });
        const startObserving = () => observer.observe(document.body, { childList: true, subtree: true });
        document.body ? startObserving() : document.addEventListener('DOMContentLoaded', startObserving);
    }
})();
