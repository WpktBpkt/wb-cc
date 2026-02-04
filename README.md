# wb-cc — Cookie Consent for Webflow
Lightweight, attribute-based opt-in (GDPR-friendly). Blocks third-party scripts & iframes until consent, syncs Webflow toggles, and sends Google Consent Mode v2 signals. Provider-agnostic (YouTube, Maps, booking widgets, etc.).

## Include (CDN)
Features
	•	Opt-in only: marketing, personalization, analytics (extendable in code)
	•	Blocks <script> via type="wb-cc" and <iframe> via data-wb-cc-src / data-iframe-url
	•	Google Consent Mode v2 bridge: updates analytics_storage, ad_storage, ad_user_data, ad_personalization
	•	Per-category placeholders: wb-cc-placeholder="…", auto-hide after opt-in
	•	Webflow-friendly checkbox visuals (applies w--redirected-checked)
	•	No IAB TCF/GPP by design (lean setup for typical sites without programmatic ads)

## Installation

### 1) Include the script (CDN)

Webflow Project Settings → Custom Code → Footer:
<script defer src="https://cdn.jsdelivr.net/gh/WpktBpkt/wb-cc@v0.3.0/dist/wb-cc.js"></script>

| Use versioned tags like @v0.3.0 for production. @main is fine for quick tests.

### 2) Google Consent Mode v2 defaults (Head, do not block)

Webflow Project Settings → Custom Code → Head — place above any Google tags:
<script>
  // Google Consent Mode v2 — defaults: all 'denied'
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });
</script>

## UI Markup (Webflow)

### Banner & Modal
	•	Banner: wb-cc="banner"
	•	Preferences modal: wb-cc="preferences"

### Buttons / actions
	•	wb-cc="accept-all" — Accept all
	•	wb-cc="accept-necessary" — Accept necessary
	•	wb-cc="open-preferences" — Open settings (e.g., from the banner)
	•	wb-cc="save-preferences" — Confirm selection
	•	wb-cc="close" — Close (modal X)
	•	wb-cc="manager" — Reopen manager later (e.g., a floating button)

### Category toggles (inputs)
	•	Put on the checkbox input itself:
wb-cc-checkbox="marketing"
wb-cc-checkbox="personalization"
wb-cc-checkbox="analytics"
(Essential is always on — no toggle required.)

## Block third-party scripts (opt-in)

**Rule:** Any third-party script that sets cookies/tracks must have:
	•	type="wb-cc"
	•	wb-cc-categories="..." (comma-separated allowed)

**Example — GA4 (gtag.js)**

<!-- Loader (blocked) -->
<script type="wb-cc" wb-cc-categories="analytics"
        async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>

<!-- Init (blocked) -->
<script type="wb-cc" wb-cc-categories="analytics">
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXX', { anonymize_ip: true /*, debug_mode: true */ });
</script>

**Alternative — Google Tag Manager (GTM)**

<script type="wb-cc" wb-cc-categories="analytics"
        src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXXXXX"></script>

| In GTM enable Consent Overview and require analytics_storage / ad_storage on relevant tags.
Important: Use either GA4 or GTM directly — not both.

## Block iframes

### Option A — native <iframe> (no src until consent)

<iframe wb-cc-categories="marketing"
        data-wb-cc-src="https://www.youtube-nocookie.com/embed/VIDEO_ID?rel=0&modestbranding=1"
        width="100%" height="315" style="border:0;"></iframe>

### Option B — placeholder div (script creates the real iframe after consent)

<div wb-cc-categories="personalization"
     data-iframe-url="https://www.google.com/maps/embed?pb=YOUR_EMBED"
     data-iframe-width="100%" data-iframe-height="400" data-iframe-loading="lazy"
     data-iframe-referrerpolicy="strict-origin-when-cross-origin">
  <p>Content loads after consent.</p>
  <a wb-cc="open-preferences">Manage cookie settings</a>
</div>

## Custom placeholders per category

Show your own placeholder UI until consent for a category is granted. It auto-hides after opt-in.

<div class="my-placeholder" wb-cc-placeholder="personalization">
  <p>This content loads after consent.</p>
  <a wb-cc="open-preferences">Manage cookie settings</a>
</div>

**Rules**
	•	Visible while personalization is not granted
	•	Hidden immediately after opt-in
	•	Pair with your blocked resource (scripts/iframes as shown above)

## Google Consent Mode v2 — mapping

**Defaults:** 	see Head snippet (denied).
**On change**	wb-cc automatically updates:

**wb-cc category						Consent Mode key		Value when true**
	analytics							analytics_storage		granted
	marketing							ad_storage				granted
	marketing							ad_user_data			granted
	marketing or personalization		ad_personalization		granted	

**Without consent all keys remain denied. GA/GTM may model but do not send full personalized hits.**

## Cookie
	•	Name: wbCookieConsent
	•	Value: JSON { marketing:boolean, personalization:boolean, analytics:boolean }
	•	Lifetime: 180 days, path=/

## Debug & troubleshooting

### Quick checks
	•	First visit: banner visible, no third-party requests (verify in Network).
	•	After opt-in: allowed scripts/iframes load immediately.
	•	Reload: state is persisted (cookie).

### Console

window.__wbConsent      // -> { marketing:..., personalization:..., analytics:... }
window.dataLayer        // -> ['consent','default',...], then ['consent','update',...]

### No GA4 data?
	•	Use either GTM or GA4 (not both)
	•	Check VPN/ad-blocker/DNS: allow *.google-analytics.com and *.googletagmanager.com
	•	Optional debug_mode:true in GA4 config and use GA DebugView
	•	If you set a CSP, ensure:
	•	script-src / connect-src / frame-src allow relevant Google/YouTube/Maps domains

### Webflow checkbox visuals
	•	Put wb-cc-checkbox on the input; visuals rely on w--redirected-checked.

## Versioning & CDN
	•	SemVer: features → minor (v0.3.0), fixes → patch (v0.3.1), breaking → major
	•	New release = new immutable tag; don’t overwrite tags
	•	Point Webflow to the desired version:

<script defer src="https://cdn.jsdelivr.net/gh/WpktBpkt/wb-cc@v0.3.0/dist/wb-cc.js"></script>

|	•	For quick tests you can use @main (not recommended for production)

## Examples

### YouTube (privacy-enhanced, placeholder)

<div wb-cc-categories="marketing"
     data-iframe-url="https://www.youtube-nocookie.com/embed/O8PI9UPnAZk?rel=0&modestbranding=1&enablejsapi=1"
     data-iframe-width="100%" data-iframe-height="315" data-iframe-loading="lazy"
     data-iframe-allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
     data-iframe-allowfullscreen>
  <p>Video loads after consent.</p>
  <a wb-cc="open-preferences">Manage cookie settings</a>
</div>

### Google Maps (native iframe)

<iframe wb-cc-categories="personalization"
        data-wb-cc-src="https://www.google.com/maps/embed?pb=YOUR_EMBED"
        width="100%" height="400" style="border:0;"></iframe>

## Legal
This project is a technical aid. Not legal advice.
Verify requirements for your site/region (data processing, policies, documentation).

## License

MIT © 2025 WpktBpkt

## Changelog (excerpt)
	•	v0.3.0 — Per-category placeholders: wb-cc-placeholder="…", auto-hide after opt-in
	•	v0.2.0 — Consent Mode v2 bridge: automatic gtag('consent','update') signals
	•	v0.1.0 — Initial release (opt-in blocking for scripts/iframes, Webflow toggles)
