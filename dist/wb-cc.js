/*! wb-cc (c) 2025 WpktBpkt - MIT — v0.3.4 */
(function(){
  const ATTR = 'wb-cc';
  const ACTIONS = new Set(['open-preferences','close','accept-all','accept-necessary','manager','save-preferences']);
  const COOKIE_NAME = 'wbCookieConsent';
  const COOKIE_DAYS = 180;
  const DEBUG = (window.WBCC_DEBUG === true);
  const log = (...a)=>{ if (DEBUG) console.log('[wb-cc]', ...a); };

  let userConsent = { marketing:false, personalization:false, analytics:false };

  const qs = sel => document.querySelector(sel);
  const isDialog = el => el && el.nodeName === 'DIALOG';
  function getDefaultDisplay(el){ const d = getComputedStyle(el).display; return (d && d !== 'none') ? d : 'flex'; }
  function show(sel){ const el = qs(sel); if (!el) return; if (isDialog(el)) { if (!el.open) el.showModal(); } else { el.style.display = getDefaultDisplay(el); } }
  function hide(sel){ const el = qs(sel); if (!el) return; if (isDialog(el)) el.close(); else el.style.display = 'none'; }

  // Cookies
  function setCookie(n,v,d){ const t=new Date(); t.setDate(t.getDate()+d); document.cookie=`${n}=${encodeURIComponent(v)}; expires=${t.toUTCString()}; path=/;`; }
  function getCookie(n){ return (document.cookie||'').split(';').map(s=>s.trim()).reduce((acc,c)=>acc||(c.indexOf(n+'=')===0?decodeURIComponent(c.substring(n.length+1)):null),null); }

  // Consent Mode v2
  function gtagConsentUpdateFrom(c){
    const g=v=>v?'granted':'denied';
    const payload = {
      analytics_storage: g(c.analytics),
      ad_storage: g(c.marketing),
      ad_user_data: g(c.marketing),
      ad_personalization: g(c.marketing || c.personalization)
    };
    try{
      if (typeof window.gtag === 'function') window.gtag('consent','update',payload);
      else { window.dataLayer = window.dataLayer || []; window.dataLayer.push(['consent','update',payload]); }
    }catch(e){ log('consent mode error', e); }
  }

  // Placeholders
  function updatePlaceholders(c){
    document.querySelectorAll('[wb-cc-placeholder]').forEach(el=>{
      const cat=(el.getAttribute('wb-cc-placeholder')||'').trim().toLowerCase();
      if (!cat) return;
      el.style.display = (c[cat]===true) ? 'none' : '';
    });
  }
  function tempHidePlaceholders(hideAll){
    document.querySelectorAll('[wb-cc-placeholder]').forEach(el=>{
      if (hideAll){
        if (!el.dataset._wbPrevVis) el.dataset._wbPrevVis = el.style.visibility || '';
        el.style.visibility='hidden'; el.style.pointerEvents='none';
      } else {
        el.style.visibility = el.dataset._wbPrevVis ?? ''; delete el.dataset._wbPrevVis;
        el.style.pointerEvents='';
      }
    });
  }

  // **Lumos aware**: Site-Modals/Overlays schließen
  const MODAL_SELECTORS = [
    // Cal / generisch
    '#cal-portal', '.cal-portal', '[data-cal-portal]',
    '.modal', '.u-modal', '.u-overlay',
    '[data-modal]', '[data-modal-overlay]', '[aria-modal="true"]',
    '.w-lightbox-backdrop', '.w-lightbox-container'
  ];
  function closeAllSiteModals(){
    // Native <dialog> außer unserem
    document.querySelectorAll('dialog[open]').forEach(d=>{ if(!d.matches('[wb-cc="preferences"]')){ try{ d.close(); }catch(_){}}});
    // Alles, was wie ein Overlay aussieht, ausknipsen
    document.querySelectorAll(MODAL_SELECTORS.join(',')).forEach(el=>{
      if (el.closest('[wb-cc="preferences"]')) return;
      // Klassische Open-Klassen entfernen
      ['is-open','open','active','visible','show'].forEach(cls=>el.classList.remove(cls));
      // ARIA schließen
      if (el.getAttribute && el.getAttribute('aria-hidden')==='false') el.setAttribute('aria-hidden','true');
      // Sichtbarkeit aus
      el.style.display='none';
    });
    // Body-Lock rückgängig
    document.body.style.overflow=''; document.body.style.paddingRight='';
    log('closed all site modals');
  }

  // Drittanbieter-Portale temporär verstecken (falls JS sie neu injiziert)
  function toggleThirdPartyPortals(show){
    document.querySelectorAll('#cal-portal, .cal-portal, [data-cal-portal]').forEach(el=>{
      el.style.display = show ? '' : 'none';
    });
  }

  // Persist + apply
  function saveConsent(){
    setCookie(COOKIE_NAME, JSON.stringify(userConsent), COOKIE_DAYS);
    window.__wbConsent = userConsent;
    gtagConsentUpdateFrom(userConsent);
    updatePlaceholders(userConsent);
    loadAllowedScripts(userConsent);
    loadAllowedIframes(userConsent);
  }

  // Webflow checkbox sync
  function resolveCheckbox(el){ if (!el) return null; if (el.matches && el.matches('input[type="checkbox"]')) return el; return el.querySelector? el.querySelector('input[type="checkbox"]'):null; }
  function findCustomUIFor(input){
    if (!input) return null;
    const label=input.closest('label, .w-checkbox, .w-form-formcheckbox, .w-switch');
    if (label){ const ui=label.querySelector('.w-checkbox-input, .w-checkbox-input--inputType-custom, .w-switch-input, [class*="w-checkbox-input"]'); if (ui) return ui; }
    const n=input.nextElementSibling; if (n && /w-.*checkbox|switch/i.test(n.className||'')) return n;
    return null;
  }
  function applyVisualState(input, checked){ if (!input) return; input.checked=!!checked; const ui=findCustomUIFor(input); if (ui) ui.classList.toggle('w--redirected-checked', !!checked); }
  function syncPreferencesUIFromConsent(){ document.querySelectorAll('[wb-cc-checkbox]').forEach(node=>{ const cat=(node.getAttribute('wb-cc-checkbox')||'').trim().toLowerCase(); const input=resolveCheckbox(node); if (!input || !(cat in userConsent)) return; applyVisualState(input, !!userConsent[cat]); }); }
  function readPreferencesFromUI(){ document.querySelectorAll('[wb-cc-checkbox]').forEach(node=>{ const cat=(node.getAttribute('wb-cc-checkbox')||'').trim().toLowerCase(); const input=resolveCheckbox(node); if (!input || !cat) return; userConsent[cat]=!!input.checked; }); }

  // Blocking
  function parseCategories(a){ return (a||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean); }
  function isAllowed(cats, c){ return cats.length===0 || cats.every(cat=>c[cat]===true); }
  function loadAllowedScripts(c){
    document.querySelectorAll('script[type="wb-cc"]').forEach(srcEl=>{
      if (srcEl.dataset.wbLoaded==='1') return;
      const cats=parseCategories(srcEl.getAttribute('wb-cc-categories')); if (!isAllowed(cats,c)) return;
      const s=document.createElement('script');
      if (srcEl.src){ s.src=srcEl.src; if (srcEl.async) s.async=true; if (srcEl.defer) s.defer=true; }
      else { s.text=srcEl.textContent||''; }
      if (srcEl.id) s.id=srcEl.id;
      for (const {name,value} of Array.from(srcEl.attributes)){ if (name.startsWith('data-') && name!=='data-wb-loaded') s.setAttribute(name,value); }
      srcEl.dataset.wbLoaded='1'; (document.head||document.body).appendChild(s);
      log('loaded 3rd script', s.src||'[inline]');
    });
  }
  function loadAllowedIframes(c){
    document.querySelectorAll('[data-iframe-url][wb-cc-categories]').forEach(el=>{
      if (el.dataset.wbLoaded==='1') return;
      const cats=parseCategories(el.getAttribute('wb-cc-categories')); if (!isAllowed(cats,c)) return;
      const url=el.getAttribute('data-iframe-url'); if (!url) return;
      const iframe=document.createElement('iframe');
      iframe.src=url; iframe.width=el.getAttribute('data-iframe-width')||'100%'; iframe.height=el.getAttribute('data-iframe-height')||'100%'; iframe.style.border='0';
      ['allow','allowfullscreen','loading','referrerpolicy','sandbox'].forEach(a=>{ const v=el.getAttribute('data-iframe-'+a); if (v!=null) iframe.setAttribute(a, v===''?'':v); });
      el.innerHTML=''; el.appendChild(iframe); el.dataset.wbLoaded='1';
      log('mounted iframe (placeholder)', url);
    });
    document.querySelectorAll('iframe[data-wb-cc-src][wb-cc-categories]').forEach(ifr=>{
      if (ifr.dataset.wbLoaded==='1') return;
      const cats=parseCategories(ifr.getAttribute('wb-cc-categories')); if (!isAllowed(cats,c)) return;
      const url=ifr.getAttribute('data-wb-cc-src'); if (!url) return;
      ifr.setAttribute('src', url); ifr.dataset.wbLoaded='1';
      log('mounted iframe (native)', url);
    });
  }

  // Portalize
  function portalizeToBody(sel, z){
    const el=qs(sel); if (!el) return;
    if (el.parentElement!==document.body){ document.body.appendChild(el); }
    el.style.position=el.style.position||'fixed'; if (sel==='[wb-cc="preferences"]'){ el.style.inset=el.style.inset||'0'; }
    el.style.zIndex=String(z);
  }

  // Init
  function makePreferenceButtonsNonSubmitting(){
    const prefs=qs('[wb-cc="preferences"]'); if (!prefs) return;
    prefs.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(btn=>btn.setAttribute('type','button'));
  }

  document.addEventListener('DOMContentLoaded', function(){
    portalizeToBody('[wb-cc="preferences"]', 2147483647);
    portalizeToBody('[wb-cc="banner"]', 2147483646);

    const raw=getCookie(COOKIE_NAME);
    if (raw){
      try{ userConsent=JSON.parse(raw)||userConsent; }catch(e){ log('parse error',e); }
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

  document.addEventListener('submit', function(e){
    if (e.target?.closest?.('[wb-cc="preferences"]')){ e.preventDefault(); e.stopPropagation(); log('blocked submit'); }
  }, true);

  document.addEventListener('click', function(e){
    const el = e.target?.closest?.('[wb-cc]'); if (!el) return;
    const action = el.getAttribute(ATTR); if (!ACTIONS.has(action)) return;
    e.preventDefault();

    if (action==='open-preferences'){
      document.documentElement.classList.add('wb-cc-open');
      tempHidePlaceholders(true);
      closeAllSiteModals();      // Lumos & Co
      toggleThirdPartyPortals(false);
      hide('[wb-cc="banner"]'); syncPreferencesUIFromConsent(); show('[wb-cc="preferences"]');
    }
    if (action==='manager'){
      document.documentElement.classList.add('wb-cc-open');
      tempHidePlaceholders(true);
      closeAllSiteModals();
      toggleThirdPartyPortals(false);
      syncPreferencesUIFromConsent(); show('[wb-cc="preferences"]');
    }
    if (action==='close'){
      document.documentElement.classList.remove('wb-cc-open');
      tempHidePlaceholders(false);
      toggleThirdPartyPortals(true);
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action==='accept-all'){
      userConsent={ marketing:true, personalization:true, analytics:true };
      saveConsent();
      document.documentElement.classList.remove('wb-cc-open');
      tempHidePlaceholders(false);
      toggleThirdPartyPortals(true);
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action==='accept-necessary'){
      userConsent={ marketing:false, personalization:false, analytics:false };
      saveConsent();
      document.documentElement.classList.remove('wb-cc-open');
      tempHidePlaceholders(false);
      toggleThirdPartyPortals(true);
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
    if (action==='save-preferences'){
      readPreferencesFromUI(); saveConsent();
      document.documentElement.classList.remove('wb-cc-open');
      tempHidePlaceholders(false);
      toggleThirdPartyPortals(true);
      hide('[wb-cc="preferences"]'); hide('[wb-cc="banner"]');
    }
  });
})();
