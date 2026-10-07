// KredimGeldi dil seçimi (Türkçe / English).
// Site her zaman Türkçe açılır. Ziyaretçi header'daki TR / EN düğmesiyle İngilizceyi seçerse
// seçim localStorage'da saklanır ve sayfa metinleri assets/i18n/en/ altındaki sözlüklerle çevrilir.
// Bu dosya her sayfanın <head> bölümünde, diğer scriptlerden önce yüklenmelidir.
(function () {
    "use strict";

    var STORAGE_KEY = 'kg-lang';
    var VERSION = '1';
    var DEFAULT_LANG = 'tr';
    var SUPPORTED = ['tr', 'en'];

    function readStored() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    function store(lang) {
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { }
    }

    // ?lang=en / ?lang=tr bağlantıları seçimi değiştirir ve kaydeder.
    var params = new URLSearchParams(window.location.search);
    var fromUrl = params.get('lang');
    if (SUPPORTED.indexOf(fromUrl) > -1) store(fromUrl);

    var lang = SUPPORTED.indexOf(fromUrl) > -1 ? fromUrl : readStored();
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;

    var root = document.documentElement;
    root.setAttribute('data-kg-lang', lang);
    if (lang !== DEFAULT_LANG) root.lang = lang;

    // --- Dil düğmesi stilleri ---
    var css =
        '.kg-lang-switch{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:999px;' +
        'background:#f1f5f3;border:1px solid rgba(8,39,32,.12);line-height:1;vertical-align:middle;flex-shrink:0}' +
        '.kg-lang-switch button{appearance:none;border:0;background:transparent;color:#4d5f59;font:600 13px/1 "Inter Tight",sans-serif;' +
        'letter-spacing:.04em;padding:7px 10px;border-radius:999px;cursor:pointer;transition:background .2s,color .2s}' +
        '.kg-lang-switch button:hover{color:#082720}' +
        '.kg-lang-switch button:focus-visible{outline:2px solid #0c9b6a;outline-offset:1px}' +
        'html[data-kg-lang="tr"] .kg-lang-switch [data-kg-lang="tr"],html[data-kg-lang="en"] .kg-lang-switch [data-kg-lang="en"]' +
        '{background:#082720;color:#fff;cursor:default}' +
        '.navbar .kg-lang-desktop{margin-right:28px}' +
        '.navbar .kg-lang-mobile{display:none}' +
        '@media (max-width:991.98px){.navbar .kg-lang-mobile{display:inline-flex;position:absolute;right:62px;top:50%;transform:translateY(-50%)}}' +
        '.kg-lang-floating{position:fixed;right:16px;bottom:16px;z-index:1050;box-shadow:0 6px 20px rgba(8,39,32,.15)}' +
        '.kg-lang-legal-note{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 24px;padding:12px 16px;border-radius:12px;' +
        'background:#f1f5f3;border:1px solid rgba(8,39,32,.12);color:#4d5f59;font-size:14px;line-height:1.5}' +
        '.kg-lang-legal-note i{color:#082720;font-size:16px}' +
        '.kg-lang-legal-note button{border:0;background:none;padding:0;color:#082720;font-weight:600;text-decoration:underline;cursor:pointer}' +
        'html.kg-i18n-pending body{visibility:hidden}';
    var style = document.createElement('style');
    style.id = 'kg-lang-style';
    style.textContent = css;
    (document.head || root).appendChild(style);

    function setLang(next) {
        if (SUPPORTED.indexOf(next) === -1 || next === lang) return;
        store(next);
        var url = new URL(window.location.href);
        url.searchParams.delete('lang');
        window.location.replace(url.pathname + url.search + url.hash);
        // Sadece # değiştiyse replace sayfayı yenilemez.
        setTimeout(function () { window.location.reload(); }, 50);
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-kg-lang]');
        if (!btn || btn === root) return;
        e.preventDefault();
        setLang(btn.getAttribute('data-kg-lang'));
    });

    function switchHtml(extraClass) {
        return '<div class="kg-lang-switch ' + extraClass + '" role="group" aria-label="Dil / Language" translate="no">' +
            '<button type="button" data-kg-lang="tr" lang="tr" title="Türkçe">TR</button>' +
            '<button type="button" data-kg-lang="en" lang="en" title="English">EN</button></div>';
    }

    // Header'ı olmayan sayfalarda (ör. 404) düğme sağ alt köşede gösterilir.
    function addFloatingSwitch() {
        if (!document.body || document.body.hasAttribute('data-kg-no-lang')) return;
        if (document.querySelector('.kg-lang-switch') || document.getElementById('header-placeholder')) return;
        document.body.insertAdjacentHTML('beforeend', switchHtml('kg-lang-floating'));
    }

    var KGLang = window.KGLang = {
        lang: lang,
        set: setLang,
        switchHtml: switchHtml,
        t: function (s) { return s; }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addFloatingSwitch);
    else addFloatingSwitch();

    if (lang === DEFAULT_LANG) return;

    // ================= Çeviri =================
    root.classList.add('kg-i18n-pending');
    var revealTimer = setTimeout(reveal, 3000);
    function reveal() {
        clearTimeout(revealTimer);
        root.classList.remove('kg-i18n-pending');
    }

    var base = (document.currentScript && document.currentScript.src)
        ? document.currentScript.src.replace(/js\/dil\.js.*$/, '')
        : 'assets/';
    var page = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
    if (!/^[a-z0-9-]+$/i.test(page)) page = 'index';

    function load(name) {
        return fetch(base + 'i18n/' + lang + '/' + name + '.json?v=' + VERSION)
            .then(function (r) { return r.ok ? r.json() : {}; })
            .catch(function () { return {}; });
    }

    var TEXT = Object.create(null);
    var HTML = Object.create(null);
    var PATTERNS = [];
    var SUBS = [];

    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, SVG: 1, TEMPLATE: 1, IFRAME: 1 };
    var INLINE_TAGS = { A: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, SMALL: 1, SUP: 1, SUB: 1, MARK: 1, BR: 1, ABBR: 1, WBR: 1 };
    var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-bs-original-title'];
    var HAS_LETTER = /[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû]/;

    function norm(s) {
        s = s.replace(/\s+/g, ' ').trim();
        return s.normalize ? s.normalize('NFC') : s;
    }

    function lookup(key) {
        if (!key) return null;
        if (HAS_LETTER.test(key)) {
            var hit = TEXT[key];
            if (typeof hit === 'string') return hit;
        } else if (key.indexOf('%') === -1) {
            return null;
        }
        for (var i = 0; i < PATTERNS.length; i++) {
            var p = PATTERNS[i];
            if (p.re.test(key)) return applySubs(key.replace(p.re, p.en));
        }
        return null;
    }

    // Kalıplarla çevrilen metinlerdeki ay adları gibi parçalar (ör. "7 Ekim 2026") ayrıca çevrilir.
    function applySubs(s) {
        for (var i = 0; i < SUBS.length; i++) s = s.replace(SUBS[i].re, SUBS[i].en);
        return s;
    }

    function translateString(s) {
        if (s == null) return s;
        var str = String(s);
        var key = norm(str);
        var hit = lookup(key);
        if (hit == null) return str;
        var lead = str.match(/^\s*/)[0];
        var trail = str.match(/\s*$/)[0];
        return lead + hit + trail;
    }
    KGLang.t = translateString;

    function isSkipped(el) {
        for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
            if (SKIP_TAGS[n.tagName.toUpperCase()]) return true;
            if (n.getAttribute('translate') === 'no' || n.hasAttribute('data-kg-no-translate')) return true;
        }
        return false;
    }

    // Satır içi etiketler (<strong>, <a> ...) barındıran paragraflar bir bütün olarak çevrilir;
    // böylece İngilizce cümle düzeni korunabilir. Kimliği (id) ya da data-* niteliği olan
    // öğeler JS tarafından kullanılabileceği için bu öğelerin içi hiçbir zaman yeniden yazılmaz.
    function isRichBlock(el) {
        var hasText = false;
        var hasChild = false;
        for (var c = el.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 3) { if (c.nodeValue.trim()) hasText = true; }
            else if (c.nodeType === 1) hasChild = true;
        }
        if (!hasText || !hasChild) return false;
        var all = el.getElementsByTagName('*');
        for (var i = 0; i < all.length; i++) {
            var d = all[i];
            if (!INLINE_TAGS[d.tagName.toUpperCase()] || d.id) return false;
            for (var a = 0; a < d.attributes.length; a++) {
                if (d.attributes[a].name.indexOf('data-') === 0) return false;
            }
        }
        return true;
    }

    function translateAttrs(el) {
        for (var i = 0; i < ATTRS.length; i++) {
            var v = el.getAttribute(ATTRS[i]);
            if (v) {
                var t = translateString(v);
                if (t !== v) el.setAttribute(ATTRS[i], t);
            }
        }
        if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) {
            var tv = translateString(el.value);
            if (tv !== el.value) el.value = tv;
        }
    }

    function translateText(node) {
        var v = node.nodeValue;
        var t = translateString(v);
        if (t === v) return;
        // value niteliği olmayan seçeneklerde değer metnin kendisidir; kaydedilen değer Türkçe kalsın.
        var p = node.parentNode;
        if (p && p.tagName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', p.value);
        node.nodeValue = t;
    }

    function translateTree(el) {
        if (el.nodeType === 3) {
            if (el.parentNode && el.parentNode.nodeType === 1 && !isSkipped(el.parentNode)) {
                if (isRichBlock(el.parentNode) && translateRich(el.parentNode)) return;
                translateText(el);
            }
            return;
        }
        if (el.nodeType !== 1) return;
        if (el.getAttribute('translate') === 'no' || el.hasAttribute('data-kg-no-translate')) return;
        var tag = el.tagName.toUpperCase();
        if (tag === 'TEXTAREA' || tag === 'IFRAME') translateAttrs(el);
        if (SKIP_TAGS[tag]) return;
        translateAttrs(el);
        if (isRichBlock(el) && translateRich(el)) return;
        var child = el.firstChild;
        while (child) {
            var next = child.nextSibling;
            if (child.nodeType === 3) translateText(child);
            else if (child.nodeType === 1) translateTree(child);
            child = next;
        }
    }

    function translateRich(el) {
        var key = norm(el.innerHTML);
        var hit = HTML[key];
        if (typeof hit !== 'string') return false;
        el.innerHTML = hit;
        return true;
    }

    function translateTitle() {
        var t = translateString(document.title);
        if (t !== document.title) document.title = t;
        var meta = document.querySelector('meta[name="description"]');
        if (meta) {
            var d = meta.getAttribute('content');
            var td = translateString(d);
            if (td !== d) meta.setAttribute('content', td);
        }
    }

    var observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
            var r = records[i];
            if (r.type === 'childList') {
                for (var j = 0; j < r.addedNodes.length; j++) {
                    var n = r.addedNodes[j];
                    if (n.nodeType === 1 && isSkipped(n)) continue;
                    if (n.nodeType === 1 && n.parentNode && isRichBlock(n.parentNode) && !isSkipped(n.parentNode)) {
                        if (translateRich(n.parentNode)) continue;
                    }
                    translateTree(n);
                }
            } else if (r.type === 'characterData') {
                var p = r.target.parentNode;
                if (p && p.nodeType === 1 && !isSkipped(p)) translateText(r.target);
            } else if (r.type === 'attributes') {
                var tg = r.target.tagName;
                if (tg === 'TEXTAREA' || tg === 'IFRAME' || !isSkipped(r.target)) translateAttrs(r.target);
            }
        }
    });

    // JS ile gösterilen uyarı, onay ve form doğrulama mesajları da çevrilir.
    var nativeAlert = window.alert;
    var nativeConfirm = window.confirm;
    window.alert = function (m) { return nativeAlert.call(window, translateString(m)); };
    window.confirm = function (m) { return nativeConfirm.call(window, translateString(m)); };
    ['HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement'].forEach(function (name) {
        var proto = window[name] && window[name].prototype;
        if (!proto || !proto.setCustomValidity) return;
        var native = proto.setCustomValidity;
        proto.setCustomValidity = function (m) { return native.call(this, m ? translateString(m) : m); };
    });

    var ready = false;
    var dictsLoaded = false;

    // Politika metinlerinde çevirinin bilgi amaçlı olduğu, Türkçe metnin esas alındığı belirtilir.
    function addLegalNote() {
        var doc = document.querySelector('.kg-policy-doc');
        if (!doc || doc.querySelector('.kg-lang-legal-note')) return;
        var note = document.createElement('p');
        note.className = 'kg-lang-legal-note';
        note.setAttribute('translate', 'no');
        note.innerHTML = '<i class="ri-translate-2" aria-hidden="true"></i> This English version is provided for information only. ' +
            'In case of any discrepancy, the Turkish version of this text prevails. ' +
            '<button type="button" data-kg-lang="tr">Read in Turkish</button>';
        doc.insertBefore(note, doc.firstChild);
    }

    function start() {
        if (!ready || !dictsLoaded) return;
        addLegalNote();
        translateTitle();
        translateTree(document.body);
        observer.observe(document.body, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ATTRS
        });
        new MutationObserver(translateTitle).observe(document.head, { childList: true, subtree: true, characterData: true });
        reveal();
    }

    function absorb(dict) {
        if (!dict) return;
        var k;
        if (dict.text) for (k in dict.text) TEXT[norm(k)] = dict.text[k];
        if (dict.html) for (k in dict.html) HTML[norm(k)] = dict.html[k];
        if (dict.patterns) dict.patterns.forEach(function (p) {
            try { PATTERNS.push({ re: new RegExp(p[0]), en: p[1] }); } catch (e) { }
        });
        if (dict.subs) dict.subs.forEach(function (p) {
            try { SUBS.push({ re: new RegExp(p[0], 'g'), en: p[1] }); } catch (e) { }
        });
    }

    Promise.all([load('ortak'), load(page)]).then(function (dicts) {
        dicts.forEach(absorb);
        dictsLoaded = true;
        start();
    });

    function onReady() { ready = true; start(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
})();
