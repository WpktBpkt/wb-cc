# wb-cc — Cookie Consent for Webflow
Lightweight, attribute-based Opt-In (GDPR-friendly). Blocks 3rd-party scripts & iframes until consent.

## Include (CDN)
```html
<script defer src="https://cdn.jsdelivr.net/gh/WpktBpkt/wb-cc@v0.1.0/dist/wb-cc.js"></script>

UI Markup (Webflow)
	•	Banner: [wb-cc=“banner”]
	•	Preferences modal: [wb-cc=“preferences”]
	•	Buttons: [wb-cc=“accept-all”] [wb-cc=“accept-necessary”] [wb-cc=“save-preferences”] [wb-cc=“open-preferences”] [wb-cc=“manager”] [wb-cc=“close”]
	•	Toggles: [wb-cc-checkbox=“marketing|personalization|analytics”]

Block a script
<iframe data-wb-cc-src="https://www.youtube.com/embed/ID"
        wb-cc-categories="marketing" width="560" height="315"></iframe>

Block an iframe (A: native)
<iframe data-wb-cc-src="https://www.youtube.com/embed/ID"
        wb-cc-categories="marketing" width="560" height="315"></iframe>

Block an iframe (B: placeholder)
<div wb-cc-categories="personalization"
     data-iframe-url="https://www.google.com/maps/embed?pb=...">
  <p>Content loads after consent.</p>
  <a wb-cc="open-preferences">Manage cookies</a>
</div>


Cookie

wbCookieConsent (JSON), default opt-in false for: marketing, personalization, analytics. Validity: 180 days.

Notes
	•	No IAB TCF/GPP (by design).
	•	Works great for typical sites without programmatic ads.
	•	No legal advice. Verify with your DPO/legal.

License

MIT © 2025 WpktBpkt
