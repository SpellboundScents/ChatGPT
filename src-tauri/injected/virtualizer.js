"use strict";
(() => {
  // src/injected/virtualizer.ts
  function findScrollContainer(start) {
    let n = start;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (cs.overflowY === "auto" || cs.overflowY === "scroll") return n;
      n = n.parentElement;
    }
    return document.scrollingElement ?? document.documentElement;
  }
  function createVirtualizer() {
    let installed = false;
    function inject() {
      if (installed) return { install() {
      }, enable() {
      }, disable() {
      }, stats: () => ({ total: 0, mounted: 0, totalHeight: 0 }) };
      installed = true;
      const MSG_SEL = window.__VIRT_MSG_SEL ?? "[data-message-author-role]";
      const MIN_H = 56;
      const OVERSCAN_PX = 1200;
      const BATCH = 10;
      const YIELD = 6;
      const nodes = Array.from(document.querySelectorAll(MSG_SEL));
      const items = nodes.map((el) => {
        const ph = document.createElement("div");
        ph.setAttribute("data-nv-ph", "1");
        ph.style.height = `${MIN_H}px`;
        ph.style.width = "100%";
        ph.style.boxSizing = "border-box";
        const parent = el.parentElement;
        const next = el.nextSibling;
        const scroller2 = findScrollContainer(parent);
        parent.insertBefore(ph, el);
        el.remove();
        return { el, ph, mounted: false, h: MIN_H, parent, next, scroller: scroller2 };
      });
      if (items.length === 0) {
        return { install() {
        }, enable() {
        }, disable() {
        }, stats: () => ({ total: 0, mounted: 0, totalHeight: 0 }) };
      }
      const scroller = (() => {
        const map = /* @__PURE__ */ new Map();
        for (const it of items) map.set(it.scroller, (map.get(it.scroller) ?? 0) + 1);
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0][0];
      })();
      const idle = (t = YIELD) => new Promise((r) => setTimeout(r, t));
      const mountItem = (it) => {
        if (it.mounted) return;
        if (it.el.innerHTML === "" && it.html) it.el.innerHTML = it.html;
        it.parent.insertBefore(it.el, it.ph);
        it.mounted = true;
      };
      const unmountItem = (it) => {
        if (!it.mounted) return;
        const newH = Math.max(MIN_H, Math.round(it.el.getBoundingClientRect().height) || MIN_H);
        it.h = newH;
        it.ph.style.height = `${newH}px`;
        if (!it.html) it.html = it.el.innerHTML;
        it.el.innerHTML = "";
        it.el.remove();
        it.mounted = false;
      };
      function getViewport(sc) {
        const top = sc.scrollTop;
        const h = sc.clientHeight;
        return { top, bottom: top + h };
      }
      async function update(force = false) {
        const { top, bottom } = getViewport(scroller);
        const nearTop = top - OVERSCAN_PX;
        const nearBot = bottom + OVERSCAN_PX;
        const todoMount = [];
        const todoUnmount = [];
        for (const it of items) {
          const r = it.ph.getBoundingClientRect();
          const docTop = scroller.scrollTop + r.top - scroller.getBoundingClientRect().top;
          const inWindow = docTop + it.h >= nearTop && docTop <= nearBot;
          if (inWindow) {
            if (!it.mounted || force) todoMount.push(it);
          } else {
            if (it.mounted) todoUnmount.push(it);
          }
        }
        for (let i = 0; i < todoUnmount.length; i += BATCH) {
          for (const it of todoUnmount.slice(i, i + BATCH)) unmountItem(it);
          await idle();
        }
        for (let i = 0; i < todoMount.length; i += BATCH) {
          for (const it of todoMount.slice(i, i + BATCH)) mountItem(it);
          await idle();
        }
        await new Promise((r) => requestAnimationFrame(() => r()));
        for (const it of items) {
          if (!it.mounted) continue;
          const h = Math.max(MIN_H, Math.round(it.el.getBoundingClientRect().height) || MIN_H);
          if (h !== it.h) {
            it.h = h;
            it.ph.style.height = `${h}px`;
          }
        }
      }
      function isAssistant(el) {
        const role = el.getAttribute("data-message-author-role") || "";
        if (role) return role === "assistant";
        const testid = el.getAttribute("data-testid") || "";
        return /assistant/i.test(testid);
      }
      function isNearBottom(sc, px = 240) {
        const gap = sc.scrollHeight - (sc.scrollTop + sc.clientHeight);
        return gap <= px;
      }
      function lastMounted() {
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i].mounted) return items[i];
        }
        return items[items.length - 1];
      }
      void update(true);
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          void update(false).then(() => {
            ticking = false;
          });
        });
      };
      scroller.addEventListener("scroll", onScroll, { passive: true });
      let ro = null;
      if (typeof window.ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => {
          void update(true);
        });
        ro.observe(scroller);
      } else {
        window.addEventListener("resize", () => {
          void update(true);
        }, { passive: true });
      }
      let mo = new MutationObserver(async (muts) => {
        let added = [];
        for (const m of muts) {
          m.addedNodes && m.addedNodes.forEach((n) => {
            if (n.nodeType !== 1) return;
            const el = n;
            if (el.matches?.(MSG_SEL)) added.push(el);
            el.querySelectorAll?.(MSG_SEL)?.forEach((child) => added.push(child));
          });
        }
        if (!added.length) return;
        const seen = /* @__PURE__ */ new Set();
        added = added.filter((el) => el instanceof HTMLElement && !seen.has(el) && seen.add(el));
        if (!added.length) return;
        const immediate = [];
        for (const el of added) {
          if (items.some((i) => i.el === el)) continue;
          const ph = document.createElement("div");
          ph.setAttribute("data-nv-ph", "1");
          ph.style.height = `${MIN_H}px`;
          ph.style.width = "100%";
          ph.style.boxSizing = "border-box";
          const parent = el.parentElement;
          if (!parent) continue;
          parent.insertBefore(ph, el);
          el.remove();
          const it = {
            el,
            ph,
            mounted: false,
            h: MIN_H,
            html: void 0,
            parent,
            next: ph.nextSibling,
            scroller
          };
          items.push(it);
          if (isAssistant(el)) immediate.push(it);
        }
        if (immediate.length) {
          const follow = isNearBottom(scroller, 240);
          await update(false);
          for (let i = 0; i < immediate.length; i += BATCH) {
            const chunk = immediate.slice(i, i + BATCH);
            for (const it of chunk) {
              if (it.el.innerHTML === "" && it.html) it.el.innerHTML = it.html;
              it.parent.insertBefore(it.el, it.ph);
              it.mounted = true;
            }
            await idle();
          }
          await new Promise((r) => requestAnimationFrame(() => r()));
          for (const it of immediate) {
            const h = Math.max(MIN_H, Math.round(it.el.getBoundingClientRect().height) || MIN_H);
            it.h = h;
            it.ph.style.height = `${h}px`;
          }
          if (follow) {
            try {
              lastMounted().el.scrollIntoView({ block: "end", behavior: "auto" });
            } catch {
            }
            setTimeout(() => {
              scroller.scrollTop = scroller.scrollHeight;
            }, 0);
          }
        } else {
          await update(false);
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      function disable() {
        try {
          scroller.removeEventListener("scroll", onScroll);
        } catch {
        }
        try {
          ro?.disconnect();
        } catch {
        }
        try {
          mo?.disconnect();
        } catch {
        }
        for (const it of items) {
          if (!it.mounted) {
            if (it.el.innerHTML === "" && it.html) it.el.innerHTML = it.html;
            it.parent.insertBefore(it.el, it.ph);
            it.mounted = true;
          }
          it.ph.remove();
        }
        installed = false;
      }
      const api = {
        install: () => {
        },
        enable: () => {
        },
        disable,
        stats: () => ({
          total: items.length,
          mounted: items.filter((i) => i.mounted).length,
          totalHeight: items.reduce((s, i) => s + i.h, 0)
        })
      };
      return api;
    }
    let inner = null;
    const get = () => inner ?? (inner = inject());
    return {
      install: () => {
        void get();
      },
      enable: () => {
        get().enable();
      },
      disable: () => {
        get().disable();
        inner = null;
        installed = false;
      },
      stats: () => get().stats()
    };
  }
  (() => {
    window.__VIRT_MSG_SEL = window.__VIRT_MSG_SEL ?? "[data-message-author-role]";
    const v = createVirtualizer();
    if (document.readyState !== "loading") v.install();
    else document.addEventListener("DOMContentLoaded", () => v.install(), { once: true });
    window.virtualizer = v;
  })();
  (function installLoader() {
    if (window.__loaderInstalled) return;
    window.__loaderInstalled = true;
    const ensureStyle = () => {
      if (document.getElementById("nick-loader-style")) return;
      const s = document.createElement("style");
      s.id = "nick-loader-style";
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
      if (document.getElementById("nick-loader")) return;
      const d = document.createElement("div");
      d.id = "nick-loader";
      d.setAttribute("aria-busy", "true");
      d.setAttribute("aria-live", "polite");
      d.innerHTML = '<svg width="28" height="28" viewBox="0 0 18 18" role="img" aria-label="Loading"><circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" stroke-width="2" opacity=".15"/><path class="arc" d="M9 2 a7 7 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Loading\u2026</span>';
      document.documentElement.appendChild(d);
    };
    const show = () => {
      try {
        ensureStyle();
        ensureNode();
        const n = document.getElementById("nick-loader");
        if (n) n.style.display = "inline-flex";
      } catch {
      }
    };
    const hide = () => {
      try {
        const n = document.getElementById("nick-loader");
        if (n) n.style.display = "none";
      } catch {
      }
    };
    window.__loaderShow = show;
    window.__loaderHide = hide;
    show();
    window.addEventListener("load", () => hide(), { once: true });
    let inFlight = 0;
    let debounce = null;
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
    const _fetch = window.fetch?.bind(window);
    if (_fetch) {
      window.fetch = (...args) => {
        inFlight++;
        bump();
        return _fetch(...args).finally(dec);
      };
    }
    const XO = XMLHttpRequest;
    if (XO?.prototype) {
      const _open = XO.prototype.open;
      const _send = XO.prototype.send;
      XO.prototype.open = function(...a) {
        this.addEventListener("loadend", dec);
        return _open.apply(this, a);
      };
      XO.prototype.send = function(...a) {
        inFlight++;
        bump();
        return _send.apply(this, a);
      };
    }
    const onNav = () => {
      show();
      requestAnimationFrame(() => requestAnimationFrame(() => hide()));
    };
    const _push = history.pushState?.bind(history);
    const _replace = history.replaceState?.bind(history);
    if (_push) {
      history.pushState = function(...a) {
        const r = _push(...a);
        onNav();
        return r;
      };
    }
    if (_replace) {
      history.replaceState = function(...a) {
        const r = _replace(...a);
        onNav();
        return r;
      };
    }
    window.addEventListener("popstate", onNav);
    window.addEventListener("beforeunload", show);
  })();
})();
