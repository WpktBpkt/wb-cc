/*! wb-cc (c) 2025 WpktBpkt - MIT — v0.3.3 */
(function(){
  const ATTR = 'wb-cc';
  const ACTIONS = new Set(['open-preferences','close','accept-all','accept-necessary','manager','save-preferences']);
  const COOKIE_NAME = 'wbCookieConsent';
  const COOKIE_DAYS = 180;
  const DEBUG = (window.WBCC_DEBUG === true) ? true : false;
  const log = (...a)=>{ if (DEBUG) console.log('[wb-cc]', ...a); };

  // Opt-In default
  let userConsent = { marketing:false, personalization:false, analytics:false };

  // ---------- UI helpers ----------
  const qs = sel => document.querySelector(sel);
  function getDefaultDisplay(el){
    const d = window.getComputedStyle(el).display;
    return (d && d !== 'none') ? d : 'flex';
  }
  function isDialog(el){ return el && el.nodeName === 'DIALOG'; }
  function show(sel){
    const el = qs(sel); if (!el) return;
    if (isDialog(el)) { if (!el.open) el.showModal(); }
    else { el.style.display = getDefaultDisplay(el); }
  }
  function hide(sel){
    const el = qs(sel); if (!el) return;
    if (isDialog(el)) el.close(); else el.style.display = 'none';
  }

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
    const granted = v => v ? 'granted' : 'denied';
    const payload = {
      analytics_storage: granted(consent.analytics),
      ad_storage: granted(consent.marketing),
      ad_user_data: granted(consent.marketing),
      ad_personalization: granted(consent.marketing || consent.personalization)
    };
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('consent','update', payload);
      } else {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(['consent','update', payload]);
      }
      log('consent mode update', payload);
    } catch(e){ log('consent mode error', e); }
  }

  // ---------- Placeholder handling ----------
  function updatePlaceholders(consent){
    document.querySelectorAll('[wb-cc-placeholder]').forEach(el => {
      const cat = (el.getAttribute('wb-cc-placeholder') || '').trim().toLowerCase();
      if (!cat) return;
      const allowed = consent[cat] === true;
      el.style.display = allowed ? 'none' : '';
    });
    log('placeholders updated', consent);
  }
  function tempHidePlaceholders(hideAll){
    document.querySelectorAll('[wb-cc-placeholder]').forEach(el => {
      if (hideAll){
        if (!el.dataset._wbPrevVis) el.dataset._wbPrevVis = el.style.visibility || '';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
      } else {
        if (el.dataset._wbPrevVis != null){
          el.style.visibility = el.dataset._wbPrevVis; delete el.dataset._wbPrevVis;
        } else { el.style.visibility = ''; }
        el.style.pointerEvents = '';
      }
    });
  }

  // ---------- Site modals/overlays hart schließen ----------
  // Passe die Selektoren bei Bedarf an dein Setup an:
  const MODAL_SELECTORS = [
    '#cal-portal', '.cal-portal', '[data-cal-portal]',
    '.modal', '[data-modal]', '[role="dialog"]',
    '.w-lightbox-backdrop', '.w-lightbox-container'
  ];
  function closeAllSiteModals(){
    // 1) Native <dialog> (nicht unser Cookie-Dialog)
    document.querySelectorAll('dialog[open]').forEach(d => {
      if (d.matches('[wb-cc="preferences"]')) return;
      try { d.close(); } catch(_){}
    });
    // 2) Häufige Modal/Overlay-Container
    document.querySelectorAll(MODAL_SELECTORS.join(',')).forEach(el => {
      if (!el || el.closest('[wb-cc="preferences"]')) return;
      // Klassen, die oft "offen" bedeuten
      ['is-open','open','active','visible','show'].forEach(cls => el.classList.remove(cls));
      // ARIA state
      if (el.getAttribute && el.getAttribute('aria-hidden') === 'false') el.setAttribute('aria-hidden','true');
      // Sichtbarkeit knipsen
      el.style.display = 'none';
    });
    // 3) Body Lock rückgängig machen
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    log('closed all site modals/overlays');
  }

  // ---------- Drittanbieter-Portale (z. B. Cal) nur temporär ausblenden ----------
  function toggleThirdPartyPortals(show){
    document.querySelectorAll('#cal-portal, .cal-portal, [data-cal-portal]').forEach(el=>{
      el.style.display = show ? '' : 'none';
    });
  }

  // ---------- Persist + apply ----------
  function saveConsent(){
    setCookie(COOKIE_NAME, JSON.stringify(userConsent), COOKIE_DAYS);
    window.__wbConsent = userConsent;
    gtagConsentUpdateFrom(userConsent);
    updatePlaceholders(userConsent);
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
    document.querySelectorAll('[wb-cc-checkbox]').forEach(node => {
      const cat = (node.getAttribute('wb-cc-checkbox') || '').trim().toLowerCase();
      const input = resolveCheckbox(node);
      if (!input || !(cat in userConsent)) return;
      applyVisualState(input, !!userConsent[cat]);
    });
    log('synced UI from consent', userConsent);
  }
  function readPreferencesFromUI(){
    document.querySelectorAll('[wb-cc-checkbox]').forEach(node => {
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
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  function isAllowed(categories, consent){
    return categories.length === 0 || categories.every(cat => consent[cat] === true);
  }
  function loadAllowedScripts(consent){
    document.querySelectorAll('script[type="wb-cc"]').forEach(srcEl => {
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
    document.querySelectorAll('[data-iframe-url][wb-cc-categories]').forEach(el => {
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

      ['allow','allowfullscreen','loading','referrerpolicy','sandbox'].forEach(a => {
        const v = el.getAttribute('data-iframe-' + a);
        if (v != null) iframe.setAttribute(a, v === '' ? '' : v);
      });

      el.innerHTML = '';
      el.appendChild(iframe);
      el.dataset.wbLoaded = '1';
      log('mounted iframe (placeholder)', url);
    });

    document.querySelectorAll('iframe[data-wb-cc-src][wb-cc-categories]').forEach(ifr => {
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

  // ---------- Portalize cookie UI to <body> ----------
  function portalizeToBody(sel, z){
    const el = qs(sel); if (!el) return;
    if (el.parentElement !== document.body){ document.body.appendChild(el); }
    el.style.position = el.style.position || 'fixed';
    if (sel === '[wb-cc="preferences"]'){ el.style.inset = el.style.inset || '0'; }
    el.style.zIndex = String(z);
  }

  // ---------- Init ----------
  function makePreferenceButtonsNonSubmitting(){
    const prefs = qs('[wb-cc="preferences"]');
    if (!prefs) return;
    prefs.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(btn=>{
      btn.setAttribute('type','button');
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    portalizeToBody('[wb-cc="preferences"]', 2147483647);
    portalizeToBody('[wb-cc="banner"]', 2147483646);

    const raw = getCookie(COOKIE_NAME);
    if (raw){
      try { userConsent = JSON.parse(raw) || userConsent; } catch(e){ log('parse error', e); }
      hide('[wb-cc="banner"]'); hide('[wb-cc="preferences"]');
      gtagConsentUpdateFrom(userConsent);
      updatePlaceholders(userConsent);
      loadAllowedScripts(userConsent);
      loadAllowedIframes(userConsent);
    } else {
      show('[wb-cc="banner"]'); hide('[wb-cc="preferences"]');
      updatePlaceholders(userConsent);
    }
    makePreferenceButtonsNonSubmitting();
  });

  // Block submits im Preferences-Modal
  document.addEventListener('submit', function(e){
    if (e.target?.closest?.('[wb-cc="preferences"]')) {
      e.preventDefault(); e.stopPropagation(); log('blocked submit');
    }
  }, true);

  // Actions
  document.addEventListener('click', function(e){
    const el = e.target?.closest?.('[wb-cc]'); if (!el) return;
    const action = el.getAttribute(ATTR); if (!ACTIONS.has(action)) return;
    e.preventDefault();

    if (action === 'open-preferences'){
      document.documentElement.classList.add('wb-cc-open');
      tempHidePlaceholders(true);
      closeAllSiteModals();          // <— alle Site-Modals schließen
      toggleThirdPartyPortals(false);
      hide('[wb-cc="banner"]'); syncPreferencesUIFromConsent(); show('[wb-cc="preferences"]');
    }
    if (action === 'manager'){
      document.documentElement.classList.add('wb-cc-open');
      tempHidePlaceholders(true);
      closeAllSiteModals();
      toggleThirdPartyPortals(false);
      syncPreferencesUIFromConsent(); show('[wb-cc="preferences"]');
    }
    if (action === 'close'){
      document.documentElement.classList.remove('wb-cc-open');
      tempHidePlaceholders(false);
      toggleThirdPartyPortals(true);
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action === 'accept-all'){
      userConsent = { marketing:true, personalization:true, analytics:true };
      saveConsent();
      document.documentElement.classList.remove('wb-cc-open');
      tempHidePlaceholders(false);
      toggleThirdPartyPortals(true);
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action === 'accept-necessary'){
      userConsent = { marketing:false, personalization:false, analytics:false };
      saveConsent();
      document.documentElement.classList.remove('wb-cc-open');
      tempHidePlaceholders(false);
      toggleThirdPartyPortals(true);
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action === 'save-preferences'){
      readPreferencesFromUI(); saveConsent();
      document.documentElement.classList.remove('wb-cc-open');
      tempHidePlaceholders(false);
      toggleThirdPartyPortals(true);
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
  });
})();
