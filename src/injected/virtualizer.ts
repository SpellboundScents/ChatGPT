// src/injected/virtualizer.ts (discrete/placeholder mode + immediate assistant replies)
type Stats = { total: number; mounted: number; totalHeight: number };
export interface API {
  install: () => void;
  enable: () => void;
  disable: () => void;
  stats: () => Stats;
}
declare global { interface Window { virtualizer?: API; __VIRT_MSG_SEL?: string } }

function findScrollContainer(start: Element): HTMLElement {
  let n: Element | null = start;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n as HTMLElement);
    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return n as HTMLElement;
    n = n.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}
function whenMessagesReady(fn: () => void) {
  const sel = (window as any).__VIRT_MSG_SEL ?? '[data-message-author-role]';
  if (document.querySelector(sel)) return fn();
  const mo = new MutationObserver(() => {
    if (document.querySelector(sel)) { mo.disconnect(); fn(); }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

export function createVirtualizer(): API {
  let installed = false;

  function inject(): API {
    if (installed) return { install(){}, enable(){}, disable(){}, stats: () => ({ total:0, mounted:0, totalHeight:0 }) };
    installed = true;

    // --- CONFIG ---
    const MSG_SEL: string = (window as any).__VIRT_MSG_SEL ?? '[data-message-author-role]';
    const MIN_H = 56;           // px; fallback line height
    const OVERSCAN_PX = 1200;   // render items within ± this many px of viewport
    const BATCH = 10;
    const YIELD = 6;

    type Item = {
      el: HTMLElement;          // original message element
      ph: HTMLDivElement;       // placeholder div living where the message lives
      mounted: boolean;         // currently showing real element?
      h: number;                // last measured height
      html?: string;            // stashed html to free memory
      parent: HTMLElement;      // original parent
      next: ChildNode | null;   // original nextSibling position marker
      scroller: HTMLElement;    // scroll container for this item
    };

    // Collect ALL messages in document order
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(MSG_SEL));
    const items: Item[] = nodes.map((el) => {
      const ph = document.createElement('div');
      ph.setAttribute('data-nv-ph', '1');
      ph.style.height = `${MIN_H}px`;
      ph.style.width = '100%';
      ph.style.boxSizing = 'border-box';
      const parent = el.parentElement as HTMLElement;
      const next = el.nextSibling;
      const scroller = findScrollContainer(parent);
      // insert placeholder exactly where the element sits
      parent.insertBefore(ph, el);
      // detach the element initially (we’ll mount selectively)
      el.remove();
      return { el, ph, mounted: false, h: MIN_H, parent, next, scroller };
    });

    if (items.length === 0) {
      return { install(){}, enable(){}, disable(){}, stats: () => ({ total:0, mounted:0, totalHeight:0 }) };
    }

    // Choose the most common scroll container among items
    const scroller = (() => {
      const map = new Map<HTMLElement, number>();
      for (const it of items) map.set(it.scroller, (map.get(it.scroller) ?? 0) + 1);
      return Array.from(map.entries()).sort((a,b)=>b[1]-a[1])[0][0];
    })();

    const idle = (t = YIELD) => new Promise<void>(r => setTimeout(r, t));
    const mountItem = (it: Item) => {
      if (it.mounted) return;
      if (it.el.innerHTML === '' && it.html) it.el.innerHTML = it.html;
      it.parent.insertBefore(it.el, it.ph);
      it.mounted = true;
    };
    const unmountItem = (it: Item) => {
      if (!it.mounted) return;
      // measure before we detach, to keep layout stable
      const newH = Math.max(MIN_H, Math.round(it.el.getBoundingClientRect().height) || MIN_H);
      it.h = newH;
      it.ph.style.height = `${newH}px`;
      // free heavy children to cut memory
      if (!it.html) it.html = it.el.innerHTML;
      it.el.innerHTML = '';
      it.el.remove();
      it.mounted = false;
    };

    function getViewport(sc: HTMLElement) {
      const top = sc.scrollTop;
      const h = sc.clientHeight;
      return { top, bottom: top + h };
    }

    async function update(force=false) {
      const { top, bottom } = getViewport(scroller);
      const nearTop = top - OVERSCAN_PX;
      const nearBot = bottom + OVERSCAN_PX;

      // Decide which items to mount or unmount
      const todoMount: Item[] = [];
      const todoUnmount: Item[] = [];
      for (const it of items) {
        const r = it.ph.getBoundingClientRect();
        const docTop = scroller.scrollTop + r.top - scroller.getBoundingClientRect().top;
        const inWindow = (docTop + it.h) >= nearTop && docTop <= nearBot;
        if (inWindow) {
          if (!it.mounted || force) todoMount.push(it);
        } else {
          if (it.mounted) todoUnmount.push(it);
        }
      }
      // Unmount first to free memory earlier
      for (let i = 0; i < todoUnmount.length; i += BATCH) {
        for (const it of todoUnmount.slice(i, i + BATCH)) unmountItem(it);
        await idle();
      }
      // Mount window items
      for (let i = 0; i < todoMount.length; i += BATCH) {
        for (const it of todoMount.slice(i, i + BATCH)) mountItem(it);
        await idle();
      }
      // Measure mounted to refine placeholder heights
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      for (const it of items) {
        if (!it.mounted) continue;
        const h = Math.max(MIN_H, Math.round(it.el.getBoundingClientRect().height) || MIN_H);
        if (h !== it.h) {
          it.h = h;
          it.ph.style.height = `${h}px`;
        }
      }
    }

    // --- New reply behavior helpers ---
    function isAssistant(el: HTMLElement): boolean {
      const role = el.getAttribute('data-message-author-role') || '';
      if (role) return role === 'assistant';
      const testid = el.getAttribute('data-testid') || '';
      return /assistant/i.test(testid);
    }
    function isNearBottom(sc: HTMLElement, px = 240): boolean {
      const gap = sc.scrollHeight - (sc.scrollTop + sc.clientHeight);
      return gap <= px;
    }
    function lastMounted(): Item {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].mounted) return items[i];
      }
      return items[items.length - 1];
    }

    // Kick off initial pass
    void update(true);

    // Scroll/resize hooks
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { void update(false).then(() => { ticking = false; }); });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof (window as any).ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { void update(true); });
      ro.observe(scroller);
    } else {
      window.addEventListener('resize', () => { void update(true); }, { passive: true });
    }

    // --- NEW: MutationObserver to handle NEW messages immediately ---
    let mo: MutationObserver | null = new MutationObserver(async (muts) => {
      let added: HTMLElement[] = [];
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as HTMLElement;
          if (el.matches?.(MSG_SEL)) added.push(el);
          el.querySelectorAll?.(MSG_SEL)?.forEach((child) => added.push(child as HTMLElement));
        });
      }
      if (!added.length) return;

      // de-dup and keep only fresh ones
      const seen = new Set<HTMLElement>();
      added = added.filter((el) => (el instanceof HTMLElement) && !seen.has(el) && seen.add(el));
      if (!added.length) return;

      const immediate: Item[] = [];

      for (const el of added) {
        // skip if we already track it
        if (items.some(i => i.el === el)) continue;

        const ph = document.createElement('div');
        ph.setAttribute('data-nv-ph', '1');
        ph.style.height = `${MIN_H}px`;
        ph.style.width = '100%';
        ph.style.boxSizing = 'border-box';

        const parent = el.parentElement as HTMLElement | null;
        if (!parent) continue;

        parent.insertBefore(ph, el);
        el.remove();

        const it: Item = {
          el,
          ph,
          mounted: false,
          h: MIN_H,
          html: undefined,
          parent,
          next: ph.nextSibling,
          scroller
        };
        items.push(it);

        // Mount assistant replies immediately
        if (isAssistant(el)) immediate.push(it);
      }

      if (immediate.length) {
        const follow = isNearBottom(scroller, 240);
        // keep memory under control for older regions
        await update(false);

        // mount the new assistant replies now
        for (let i = 0; i < immediate.length; i += BATCH) {
          const chunk = immediate.slice(i, i + BATCH);
          for (const it of chunk) {
            if (it.el.innerHTML === '' && it.html) it.el.innerHTML = it.html;
            it.parent.insertBefore(it.el, it.ph);
            it.mounted = true;
          }
          await idle();
        }

        // measure and adjust their placeholders
        await new Promise<void>(r => requestAnimationFrame(() => r()));
        for (const it of immediate) {
          const h = Math.max(MIN_H, Math.round(it.el.getBoundingClientRect().height) || MIN_H);
          it.h = h;
          it.ph.style.height = `${h}px`;
        }

        // if the user was following the bottom, stay pinned
        if (follow) {
          // make sure last mounted item is in view
          try { lastMounted().el.scrollIntoView({ block: 'end', behavior: 'auto' }); } catch {}
          setTimeout(() => { scroller.scrollTop = scroller.scrollHeight; }, 0);
        }
      } else {
        // No assistant replies: normal update cycle decides mounting
        await update(false);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Teardown restores everything & disconnects observers
    function disable() {
      try { scroller.removeEventListener('scroll', onScroll); } catch {}
      try { ro?.disconnect(); } catch {}
      try { mo?.disconnect(); } catch {}
      // Ensure all items are restored
      for (const it of items) {
        if (!it.mounted) {
          if (it.el.innerHTML === '' && it.html) it.el.innerHTML = it.html;
          it.parent.insertBefore(it.el, it.ph);
          it.mounted = true;
        }
        it.ph.remove();
      }
      installed = false;
    }

    const api: API = {
      install: () => { /* already installed */ },
      enable: () => { /* reserved */ },
      disable,
      stats: () => ({
        total: items.length,
        mounted: items.filter(i => i.mounted).length,
        totalHeight: items.reduce((s,i)=>s+i.h, 0)
      })
    };
    return api;
  }

  let inner: API | null = null;
  const get = (): API => (inner ?? (inner = inject()));

  return {
    install: () => { void get(); },
    enable:  () => { get().enable(); },
    disable: () => { get().disable(); inner = null; installed = false; },
    stats:   () => get().stats(),
  };
}

// --- autoload for Tauri injection (leave as-is) ---
(() => {
  // Use your fixed selector (loader can override it too)
  (window as any).__VIRT_MSG_SEL = (window as any).__VIRT_MSG_SEL ?? '[data-message-author-role]';
  const v = createVirtualizer();
  if (document.readyState !== 'loading') v.install();
  else document.addEventListener('DOMContentLoaded', () => v.install(), { once: true });
  (window as any).virtualizer = v;
})();
// --- loader overlay + wiring (idempotent) -----------------------------------
declare global {
  interface Window {
    __loaderInstalled?: boolean;
    __loaderShow?: () => void;
    __loaderHide?: () => void;
  }
}

(function installLoader() {
  if (window.__loaderInstalled) return;
  window.__loaderInstalled = true;

  const ensureStyle = () => {
    if (document.getElementById('nick-loader-style')) return;
    const s = document.createElement('style');
    s.id = 'nick-loader-style';
    s.textContent = `
      #nick-loader{
        position:fixed;top:24px;left:50%;transform:translateX(-50%);
        padding:.55rem .8rem;border-radius:999px;
        background:color-mix(in oklab, Canvas, CanvasText 6%);
        color:CanvasText;box-shadow:0 6px 24px rgba(0,0,0,.18);
        display:inline-flex;align-items:center;gap:.5rem;
        font:600 13px system-ui,ui-sans-serif,Segoe UI,Roboto,Arial;
        z-index:2147483647
      }
      #nick-loader svg{display:block}
      #nick-loader .arc{transform-origin:8.5px 9px;animation:nick-rotate 1s linear infinite}
      @keyframes nick-rotate{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion:reduce){#nick-loader .arc{animation:none}}
    `;
    document.head.appendChild(s);
  };

  const ensureNode = () => {
    if (document.getElementById('nick-loader')) return;
    const d = document.createElement('div');
    d.id = 'nick-loader';
    d.setAttribute('aria-busy', 'true');
    d.setAttribute('aria-live', 'polite');
    d.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 18 18" role="img" aria-label="Loading">'
      + '<circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" stroke-width="2" opacity=".15"/>'
      + '<path class="arc" d="M9 2 a7 7 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      + '<span>Loading…</span>';
    document.documentElement.appendChild(d);
  };

  const show = () => {
    try {
      ensureStyle(); ensureNode();
      const n = document.getElementById('nick-loader') as HTMLElement | null;
      if (n) n.style.display = 'inline-flex';
    } catch {}
  };
  const hide = () => {
    try {
      const n = document.getElementById('nick-loader') as HTMLElement | null;
      if (n) n.style.display = 'none';
    } catch {}
  };

  window.__loaderShow = show;
  window.__loaderHide = hide;

  // --- show immediately on doc start; hide at onload ------------------------
  // (init scripts run very early, so we show now)
  show();
  window.addEventListener('load', () => hide(), { once: true });

  // --- Network + SPA route watchers (debounced to avoid flicker) ------------
  let inFlight = 0;
  let debounce: number | null = null;

  const bump = () => {
    if (debounce == null) {
      debounce = window.setTimeout(() => {
        debounce = null;
        if (inFlight > 0) show();
      }, 120);
    }
  };
  const dec = () => {
    inFlight = Math.max(0, inFlight - 1);
    if (inFlight === 0) hide();
  };

  // fetch
  const _fetch = window.fetch?.bind(window);
  if (_fetch) {
    window.fetch = (...args: Parameters<typeof fetch>) => {
      inFlight++; bump();
      return _fetch(...args).finally(dec);
    };
  }

  // XHR
  const XO = XMLHttpRequest as any;
  if (XO?.prototype) {
    const _open = XO.prototype.open;
    const _send = XO.prototype.send;
    XO.prototype.open = function (...a: any[]) {
      this.addEventListener('loadend', dec);
      return _open.apply(this, a);
    };
    XO.prototype.send = function (...a: any[]) {
      inFlight++; bump();
      return _send.apply(this, a);
    };
  }

  // SPA navigations (push/replace/popstate)
  const onNav = () => {
    // show briefly; if real network follows, fetch/XHR hooks keep it visible
    show();
    requestAnimationFrame(() => requestAnimationFrame(() => hide()));
  };
  const _push = history.pushState?.bind(history);
  const _replace = history.replaceState?.bind(history);
  if (_push) {
  history.pushState = function (...a: [any, string, string?]) {
    const r = _push(...a);
    onNav();
    return r;
  } as typeof history.pushState;
}

if (_replace) {
  history.replaceState = function (...a: [any, string, string?]) {
    const r = _replace(...a);
    onNav();
    return r;
  } as typeof history.replaceState;
}
  window.addEventListener('popstate', onNav);

  // Full page unload
  window.addEventListener('beforeunload', show);
})();
// Injected Tauri "notice" listener (no imports; safe in-page).
(function () {
  const g = window as any;
  if (g.__notice_bound) return;
  const tauri: any = g.__TAURI__;
  const listen = tauri?.event?.listen;
  if (typeof listen !== 'function') return;
  g.__notice_bound = true;

  function ensureToast(): HTMLDivElement {
    let el = document.getElementById('nick-notice') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'nick-notice';
      el.style.cssText = [
        'position:fixed','left:50%','bottom:16px','transform:translateX(-50%)',
        'padding:10px 14px','border-radius:999px','font:600 13px system-ui,sans-serif',
        'background:color-mix(in oklab, Canvas, CanvasText 10%)','color:CanvasText',
        'box-shadow:0 8px 24px rgba(0,0,0,.20)','z-index:2147483647','display:none',
        'pointer-events:none','max-width:80vw','white-space:nowrap','overflow:hidden','text-overflow:ellipsis'
      ].join(';');
      document.documentElement.appendChild(el);
    }
    return el;
  }

  // No generic type args here; treat payload as any.
  listen('notice', (ev: any) => {
    try {
      const el = ensureToast();
      el.textContent = String(ev?.payload ?? '');
      el.style.display = 'inline-block';
      clearTimeout((el as any).__t);
      (el as any).__t = setTimeout(() => { el.style.display = 'none'; }, 3000);
    } catch {}
    try { console.log('[notice]', ev?.payload); } catch {}
  });
})();
