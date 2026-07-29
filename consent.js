/* docunova — Einwilligungsbanner
   Diese Website setzt keine Cookies. Notwendige Einstellungen (Barrierefreiheit,
   gewählte Ansicht) liegen funktional im localStorage und sind nach § 25 Abs. 2
   TDDDG einwilligungsfrei. Zustimmungspflichtig ist allein die anonyme Statistik.

   Statistik später einbinden:
     if (window.dnConsent.get().statistik) { … Analytics laden … }
     window.dnConsent.onChange(s => { if (s.statistik) … });
*/
(() => {
  'use strict';
  if (window.dnConsent) return;
  if (document.documentElement.classList.contains('embedded')) return;

  const KEY = 'dn-consent';
  const VERSION = 1;
  const forceOpen = new URLSearchParams(location.search).get('consent') === '1'
    || location.hash === '#cookie-einstellungen';
  const CATS = [
    { id: 'notwendig', label: 'Notwendig', fixed: true,
      desc: 'Ihre Barrierefreiheits-Einstellungen und die gewählte Ansicht. Bleiben nur in Ihrem Browser, werden nicht übertragen.' },
    { id: 'statistik', label: 'Anonyme Statistik', fixed: false,
      desc: 'Hilft uns zu sehen, welche Inhalte gefragt sind. Ohne Cookies, ohne Profilbildung, ohne Weitergabe an Dritte.' },
  ];

  const read = () => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && s.version === VERSION ? s : null;
    } catch { return null; }
  };
  const write = (statistik) => {
    const s = { version: VERSION, statistik: !!statistik, zeitpunkt: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
    listeners.forEach((fn) => { try { fn(s); } catch {} });
    return s;
  };

  const listeners = [];
  const accent = (getComputedStyle(document.documentElement).getPropertyValue('--red') || '').trim() || '#D60A2E';

  const style = document.createElement('style');
  style.textContent = `
    .dn-consent{position:fixed;left:0;right:0;bottom:0;z-index:99997;display:flex;justify-content:center;padding:16px;pointer-events:none}
    .dn-consent[hidden]{display:none}
    .dn-consent-box{pointer-events:auto;width:min(760px,100%);background:#0B0B0C;color:#fff;border-radius:8px;
      box-shadow:0 18px 60px rgba(0,0,0,.45);padding:22px 24px;font-family:inherit;line-height:1.6}
    .dn-consent-box h2{font-size:1.05rem;font-weight:700;margin:0 0 8px;color:#fff;line-height:1.3}
    .dn-consent-box p{font-size:.88rem;color:#cfcfd5;margin:0 0 16px}
    .dn-consent-box a{color:${accent};text-decoration:underline}
    .dn-consent-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
    .dn-consent-actions button{font-family:inherit;font-size:.88rem;font-weight:600;padding:12px 20px;border-radius:3px;cursor:pointer;border:1px solid transparent}
    .dn-btn-accept{background:${accent};color:#fff}
    .dn-btn-accept:hover{filter:brightness(.9)}
    .dn-btn-min{background:transparent;color:#fff;border-color:#3a3a40}
    .dn-btn-min:hover{border-color:#fff}
    .dn-btn-settings{background:transparent;color:#9a9aa2;border:none;text-decoration:underline;padding:12px 4px}
    .dn-btn-settings:hover{color:#fff}
    .dn-consent-cats{display:none;margin:4px 0 18px;border-top:1px solid #26262b;padding-top:16px}
    .dn-consent-cats.open{display:block}
    .dn-cat{display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #1c1c1f}
    .dn-cat:last-child{border-bottom:none}
    .dn-cat-txt{flex:1;min-width:0}
    .dn-cat-txt b{display:block;font-size:.88rem;margin-bottom:3px}
    .dn-cat-txt span{font-size:.8rem;color:#9a9aa2}
    .dn-switch{flex:none;width:46px;height:26px;border-radius:26px;background:#3a3a40;border:none;position:relative;cursor:pointer;transition:background .18s}
    .dn-switch::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .18s}
    .dn-switch[aria-checked="true"]{background:${accent}}
    .dn-switch[aria-checked="true"]::after{transform:translateX(20px)}
    .dn-switch[disabled]{opacity:.55;cursor:not-allowed}
    .dn-consent-box :focus-visible{outline:3px solid ${accent};outline-offset:2px;border-radius:3px}
    @media (max-width:560px){
      .dn-consent{padding:0}
      .dn-consent-box{border-radius:8px 8px 0 0;padding:20px 18px}
      .dn-consent-actions button{flex:1 1 100%;text-align:center}
      .dn-btn-settings{flex-basis:auto !important}
    }
    @media (prefers-reduced-motion:reduce){.dn-switch,.dn-switch::after{transition:none}}
    html.a11y-noanim .dn-switch,html.a11y-noanim .dn-switch::after{transition:none}
  `;

  const el = document.createElement('div');
  el.className = 'dn-consent';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-labelledby', 'dnConsentTitle');
  el.hidden = true;
  el.innerHTML = `
    <div class="dn-consent-box">
      <h2 id="dnConsentTitle">Wir speichern nur, was nötig ist</h2>
      <p>Diese Website setzt keine Werbe- oder Tracking-Cookies. Notwendige Einstellungen bleiben in Ihrem Browser.
      Für anonyme Statistik bitten wir Sie um Ihre Einwilligung — jederzeit widerrufbar.
      <a href="datenschutz.html">Mehr in der Datenschutzerklärung</a></p>
      <div class="dn-consent-cats" id="dnConsentCats">
        ${CATS.map((c) => `
          <div class="dn-cat">
            <div class="dn-cat-txt"><b>${c.label}</b><span>${c.desc}</span></div>
            <button type="button" class="dn-switch" data-cat="${c.id}" role="switch"
              aria-checked="${c.fixed ? 'true' : 'false'}" ${c.fixed ? 'disabled' : ''}
              aria-label="${c.label} ${c.fixed ? '(immer aktiv)' : 'erlauben'}"></button>
          </div>`).join('')}
      </div>
      <div class="dn-consent-actions">
        <button type="button" class="dn-btn-accept" data-act="all">Statistik erlauben</button>
        <button type="button" class="dn-btn-min" data-act="min">Nur notwendige</button>
        <button type="button" class="dn-btn-settings" data-act="toggle">Einstellungen</button>
      </div>
    </div>`;

  const mount = () => {
    document.head.appendChild(style);
    document.body.appendChild(el);

    const cats = el.querySelector('#dnConsentCats');
    const statSwitch = el.querySelector('.dn-switch[data-cat="statistik"]');

    const close = () => { el.hidden = true; };
    const openBanner = () => {
      const s = read();
      statSwitch.setAttribute('aria-checked', String(!!(s && s.statistik)));
      el.hidden = false;
    };

    statSwitch.addEventListener('click', () => {
      const on = statSwitch.getAttribute('aria-checked') === 'true';
      statSwitch.setAttribute('aria-checked', String(!on));
    });

    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      if (b.dataset.act === 'toggle') {
        const open = cats.classList.toggle('open');
        b.textContent = open ? 'Einstellungen schließen' : 'Einstellungen';
        return;
      }
      if (b.dataset.act === 'all') {
        // Bei geöffneten Einstellungen zählt die dort gewählte Position
        write(cats.classList.contains('open') ? statSwitch.getAttribute('aria-checked') === 'true' : true);
      } else {
        write(false);
      }
      close();
    });

    // Widerruf-Links im Footer
    document.querySelectorAll('[data-consent-open]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); cats.classList.add('open'); openBanner(); });
    });

    if (!read() || forceOpen) {
      if (forceOpen) cats.classList.add('open');
      openBanner();
    }

    window.dnConsent = {
      get: () => read() || { statistik: false },
      set: (statistik) => write(statistik),
      onChange: (fn) => { listeners.push(fn); },
      open: openBanner,
    };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
