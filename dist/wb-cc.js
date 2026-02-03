/*! wb-cc (c) 2025 WpktBpkt - MIT */
(function(){
  const ATTR = 'wb-cc';
  const ACTIONS = new Set([
    'open-preferences','close','accept-all','accept-necessary','manager','save-preferences'
  ]);

  const COOKIE_NAME = 'wbCookieConsent';
  const COOKIE_DAYS = 180;
  const DEBUG = false;
  const log = (...a)=>{ if (DEBUG) console.log('[wb-cc]', ...a); };

  // Opt-In default
  let userConsent = { marketing:false, personalization:false, analytics:false };

  // ---------- UI helpers ----------
  function show(sel){ const el = document.querySelector(sel); if (el) el.style.display = 'flex'; }
  function hide(sel){ const el = document.querySelector(sel); if (el) el.style.display = 'none'; }

  // ---------- Cookie ----------
  function setCookie(name, value, days){
    const d = new Date(); d.setDate(d.getDate() + days);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/;`;
    log('setCookie', name, value);
  }
  function getCookie(name){
    const parts = (document.cookie || '').split(';');
    for (const part of parts){
      const c = part.trim();
      if (c.indexOf(name + '=') === 0){
        const val = decodeURIComponent(c.substring(name.length + 1));
        log('getCookie', name, val);
        return val;
      }
    }
    log('getCookie miss', name);
    return null;
  }

  // ---------- Google Consent Mode v2 Bridge ----------
  function gtagConsentUpdateFrom(consent){
    // payload aus deinen Kategorien mappen
    const granted = v => v ? 'granted' : 'denied';
    const payload = {
      analytics_storage: granted(consent.analytics),
      ad_storage: granted(consent.marketing),
      ad_user_data: granted(consent.marketing),
      ad_personalization: granted(consent.marketing || consent.personalization)
    };
    try {
      // wenn gtag existiert → direkt updaten
      if (typeof window.gtag === 'function') {
        window.gtag('consent','update', payload);
      } else {
        // sonst in die dataLayer queue pushen (wird von gtag/gtm später verarbeitet)
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(['consent','update', payload]);
      }
      log('consent mode update', payload);
    } catch(e){ log('consent mode error', e); }
  }

  function saveConsent(){
    setCookie(COOKIE_NAME, JSON.stringify(userConsent), COOKIE_DAYS);
    window.__wbConsent = userConsent; // debug helper
    // Consent Mode zuerst updaten …
    gtagConsentUpdateFrom(userConsent);
    // … dann erlaubte Ressourcen laden
    loadAllowedScripts(userConsent);
    loadAllowedIframes(userConsent);
  }

  // ---------- Webflow toggle visual sync ----------
  function resolveCheckbox(el){
    if (!el) return null;
    if (el.matches && el.matches('input[type="checkbox"]')) return el;
    return el.querySelector ? el.querySelector('input[type="checkbox"]') : null;
  }
  function findCustomUIFor(input){
    if (!input) return null;
    const label = input.closest('label, .w-checkbox, .w-form-formcheckbox, .w-switch');
    if (label){
      const ui = label.querySelector('.w-checkbox-input, .w-checkbox-input--inputType-custom, .w-switch-input, [class*="w-checkbox-input"]');
      if (ui) return ui;
    }
    const n = input.nextElementSibling;
    if (n && /w-.*checkbox|switch/i.test(n.className || '')) return n;
    return null;
  }
  function applyVisualState(input, checked){
    if (!input) return;
    input.checked = !!checked;
    const ui = findCustomUIFor(input);
    if (ui) ui.classList.toggle('w--redirected-checked', !!checked);
  }
  function syncPreferencesUIFromConsent(){
    const nodes = document.querySelectorAll('[wb-cc-checkbox]');
    nodes.forEach(node => {
      const cat = (node.getAttribute('wb-cc-checkbox') || '').trim().toLowerCase();
      const input = resolveCheckbox(node);
      if (!input || !(cat in userConsent)) return;
      applyVisualState(input, !!userConsent[cat]);
    });
    log('synced UI from consent', userConsent);
  }
  function readPreferencesFromUI(){
    const nodes = document.querySelectorAll('[wb-cc-checkbox]');
    nodes.forEach(node => {
      const cat = (node.getAttribute('wb-cc-checkbox') || '').trim().toLowerCase();
      const input = resolveCheckbox(node);
      if (!input || !cat) return;
      userConsent[cat] = !!input.checked;
    });
    log('read from UI', userConsent);
  }

  // ---------- Blocking engine ----------
  function parseCategories(attr){
    return (attr || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }
  function isAllowed(categories, consent){
    return categories.length === 0 || categories.every(cat => consent[cat] === true);
  }
  function loadAllowedScripts(consent){
    const blocked = document.querySelectorAll('script[type="wb-cc"]');
    blocked.forEach(srcEl => {
      if (srcEl.dataset.wbLoaded === '1') return;
      const cats = parseCategories(srcEl.getAttribute('wb-cc-categories'));
      if (!isAllowed(cats, consent)) return;

      const s = document.createElement('script');
      if (srcEl.src){
        s.src = srcEl.src;
        if (srcEl.async) s.async = true;
        if (srcEl.defer) s.defer = true;
      } else {
        s.text = srcEl.textContent || '';
      }
      if (srcEl.id) s.id = srcEl.id;
      for (const {name, value} of Array.from(srcEl.attributes)){
        if (name.startsWith('data-') && name !== 'data-wb-loaded') s.setAttribute(name, value);
      }
      srcEl.dataset.wbLoaded = '1';
      (document.head || document.body).appendChild(s);
      log('loaded 3rd script', s.src || '[inline]');
    });
  }
  function loadAllowedIframes(consent){
    // Platzhalter-DIV → echtes iframe
    const placeholders = document.querySelectorAll('[data-iframe-url][wb-cc-categories]');
    placeholders.forEach(el => {
      if (el.dataset.wbLoaded === '1') return;
      const cats = parseCategories(el.getAttribute('wb-cc-categories'));
      if (!isAllowed(cats, consent)) return;

      const url = el.getAttribute('data-iframe-url');
      if (!url) return;

      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.width = el.getAttribute('data-iframe-width') || '100%';
      iframe.height = el.getAttribute('data-iframe-height') || '100%';
      iframe.style.border = '0';

      const attrs = ['allow','allowfullscreen','loading','referrerpolicy','sandbox'];
      attrs.forEach(a => {
        const v = el.getAttribute('data-iframe-' + a);
        if (v != null) iframe.setAttribute(a, v === '' ? '' : v);
      });

      el.innerHTML = '';
      el.appendChild(iframe);
      el.dataset.wbLoaded = '1';
      log('mounted iframe (placeholder)', url);
    });

    // natives <iframe> ohne src, mit data-wb-cc-src
    const blockedIframes = document.querySelectorAll('iframe[data-wb-cc-src][wb-cc-categories]');
    blockedIframes.forEach(ifr => {
      if (ifr.dataset.wbLoaded === '1') return;
      const cats = parseCategories(ifr.getAttribute('wb-cc-categories'));
      if (!isAllowed(cats, consent)) return;

      const url = ifr.getAttribute('data-wb-cc-src');
      if (!url) return;

      ifr.setAttribute('src', url);
      ifr.dataset.wbLoaded = '1';
      log('mounted iframe (native)', url);
    });
  }

  // ---------- Init ----------
  function makePreferenceButtonsNonSubmitting(){
    const prefs = document.querySelector('[wb-cc="preferences"]');
    if (!prefs) return;
    prefs.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(btn=>{
      btn.setAttribute('type','button');
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    const raw = getCookie(COOKIE_NAME);
    if (raw){
      try { userConsent = JSON.parse(raw) || userConsent; } catch(e){ log('parse error', e); }
      hide('[wb-cc="banner"]'); hide('[wb-cc="preferences"]');
      // Consent Mode sofort mit bestehender Auswahl updaten …
      gtagConsentUpdateFrom(userConsent);
      // … und erlaubte Ressourcen laden
      loadAllowedScripts(userConsent);
      loadAllowedIframes(userConsent);
    } else {
      show('[wb-cc="banner"]'); hide('[wb-cc="preferences"]');
    }
    makePreferenceButtonsNonSubmitting();
  });

  document.addEventListener('submit', function(e){
    if (e.target?.closest?.('[wb-cc="preferences"]')) {
      e.preventDefault(); e.stopPropagation(); log('blocked submit');
    }
  }, true);

  document.addEventListener('click', function(e){
    const el = e.target?.closest?.('[wb-cc]'); if (!el) return;
    const action = el.getAttribute(ATTR); if (!ACTIONS.has(action)) return;
    e.preventDefault();

    if (action === 'open-preferences'){
      hide('[wb-cc="banner"]'); syncPreferencesUIFromConsent(); show('[wb-cc="preferences"]');
    }
    if (action === 'manager'){
      syncPreferencesUIFromConsent(); show('[wb-cc="preferences"]');
    }
    if (action === 'close'){
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action === 'accept-all'){
      userConsent = { marketing:true, personalization:true, analytics:true };
      saveConsent();
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action === 'accept-necessary'){
      userConsent = { marketing:false, personalization:false, analytics:false };
      saveConsent();
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action === 'save-preferences'){
      readPreferencesFromUI(); saveConsent();
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
  });
})();
