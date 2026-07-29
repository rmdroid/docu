/* docunova — gemeinsames Verhalten: Barrierefreiheit, Navigation, Modal, Einblendungen */
(() => {
  'use strict';

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.classList.contains('a11y-noanim');

  /* Barrierefreiheits-Toolbar */
  (() => {
    const KEY = 'dn-a11y';
    const html = document.documentElement;
    const fabBtn = $('#a11yBtn');
    const panel = $('#a11yPanel');
    if (!fabBtn || !panel) return;

    let state;
    try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { state = {}; }

    const apply = () => {
      html.classList.toggle('a11y-bigtext', !!state.bigtext);
      html.classList.toggle('a11y-contrast', !!state.contrast);
      html.classList.toggle('a11y-gray', !!state.gray);
      html.classList.toggle('a11y-noanim', !!state.noanim);
      $$('button[data-a11y]', panel).forEach(b => {
        const on = !!state[b.dataset.a11y];
        b.setAttribute('aria-pressed', String(on));
        b.querySelector('.state').textContent = on ? 'An' : 'Aus';
      });
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    };

    fabBtn.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      fabBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (panel.classList.contains('open') && !e.target.closest('.a11y-fab')) {
        panel.classList.remove('open');
        fabBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        panel.classList.remove('open');
        fabBtn.setAttribute('aria-expanded', 'false');
        fabBtn.focus();
      }
    });
    $$('button[data-a11y]', panel).forEach(b => {
      b.addEventListener('click', () => {
        state[b.dataset.a11y] = !state[b.dataset.a11y];
        apply();
      });
    });
    apply();
  })();

  /* Mobile-Navigation */
  (() => {
    const burger = $('.burger');
    const menu = $('#navMobile');
    if (!burger || !menu) return;
    burger.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    });
    $$('a', menu).forEach(a => a.addEventListener('click', () => {
      menu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }));
  })();

  /* Modal mit iframe — ausgelöst über [data-modal] */
  (() => {
    const root = $('#modal');
    if (!root) return;
    const frame = $('#modalFrame');
    const titleEl = $('#modalTitle');
    const extLink = $('#modalExt');
    let lastFocus = null;

    const open = (url, title, fallback) => {
      lastFocus = document.activeElement;
      titleEl.textContent = title;
      frame.title = title;
      frame.src = url;
      extLink.href = fallback || url;
      root.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.modal-head button', root).focus();
    };
    const close = () => {
      root.hidden = true;
      frame.src = 'about:blank';
      document.body.style.overflow = '';
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    };

    $$('[data-close]', root).forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', e => {
      if (root.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const items = $$('a[href], button:not([disabled]), iframe', root);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-modal]');
      if (!trigger) return;
      e.preventDefault();
      open(trigger.dataset.modal, trigger.dataset.modalTitle || 'Dialog', trigger.getAttribute('href'));
    });
  })();

  /* Einblenden beim Scrollen */
  (() => {
    const els = $$('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || reduced()) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    els.forEach(el => io.observe(el));
  })();

  /* Standorte: Karte und zugehöriges Bild gemeinsam umschalten */
  (() => {
    $$('.ort-cards').forEach(cardsRoot => {
      const section = cardsRoot.closest('section') || document;
      const cards = $$('.ort-card[data-ort]', cardsRoot);
      const images = $$('.standorte-frame img[data-ort]', section);
      if (!cards.length || !images.length) return;

      const select = value => {
        cards.forEach(card => {
          const active = card.dataset.ort === value;
          card.dataset.active = String(active);
          const toggle = $('.ort-toggle', card);
          if (toggle) toggle.setAttribute('aria-pressed', String(active));
        });
        images.forEach(img => {
          const active = img.dataset.ort === value;
          img.classList.toggle('on', active);
          img.setAttribute('aria-hidden', String(!active));
        });
      };

      cards.forEach(card => {
        card.addEventListener('click', event => {
          if (event.target.closest('a')) {
            select(card.dataset.ort);
            return;
          }
          if (!event.target.closest('.ort-toggle')) $('.ort-toggle', card)?.focus();
          select(card.dataset.ort);
        });
      });

      select((cards.find(card => card.dataset.active === 'true') || cards[0]).dataset.ort);
    });
  })();

  /* Zahlen hochzählen */
  (() => {
    const els = $$('[data-count]');
    if (!els.length || !('IntersectionObserver' in window) || reduced()) return;
    const run = el => {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const suffix = el.dataset.suffix || '';
      const dur = 1400;
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * ease).toFixed(decimals).replace('.', ',') + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    els.forEach(el => io.observe(el));
  })();

  /* Formular-Versand an n8n — ausgelöst über [data-webhook] am <form> */
  (() => {
    $$('form[data-webhook]').forEach(form => {
      const btn = $('button[type=submit]', form);
      const box = $('.form-msg, .msg', form);
      const label = btn ? btn.textContent : '';

      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        if (btn) { btn.disabled = true; btn.textContent = 'Wird gesendet …'; }
        if (box) { box.className = box.className.replace(/\s*(ok|err)\b/g, ''); box.textContent = ''; }

        const data = Object.fromEntries(new FormData(form).entries());
        data.formular = form.dataset.formular || 'anfrage';
        data.zeitpunkt = new Date().toISOString();

        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 15000);
          const res = await fetch(form.dataset.webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: ctrl.signal
          });
          clearTimeout(to);
          if (!res.ok) throw new Error('bad status');
          if (box) {
            box.classList.add('ok');
            box.textContent = form.dataset.success || 'Danke! Ihre Nachricht ist bei uns eingegangen.';
          }
          form.reset();
        } catch {
          if (box) {
            box.classList.add('err');
            box.textContent = 'Die Übermittlung hat gerade nicht geklappt. Bitte rufen Sie uns unter 06003 9414-0 an oder schreiben Sie an info@docunova.de.';
          }
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = label; }
        }
      });
    });
  })();
})();
