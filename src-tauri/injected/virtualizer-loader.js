"use strict";
(() => {
  // src/injected/virtualizer-loader.ts
  (function() {
    const CANDIDATES = [
      "[data-message-author-role]",
      '[data-testid="conversation-turn"]',
      'main [data-testid^="conversation-turn"]',
      // fallbacks:
      "main [data-message-id]",
      "main article:has([data-message-author-role])",
      'main div[role="listitem"]'
    ];
    function pickSelector() {
      for (const sel of CANDIDATES) {
        try {
          const n = document.querySelectorAll(sel).length;
          if (n >= 2) return sel;
        } catch {
        }
      }
      const mains = Array.from(document.querySelectorAll('main, [data-testid="conversation"]'));
      for (const m of mains) {
        const cols = Array.from(m.querySelectorAll(":scope > *"));
        let best = null;
        for (const col of cols) {
          const kids = Array.from(col.children);
          if (kids.length >= 5) {
            const sel = kids.length ? `${cssPath(col)} > *` : "";
            if (sel) {
              best = { container: col, sel, count: kids.length };
              break;
            }
          }
        }
        if (best) return best.sel;
      }
      return null;
    }
    function cssPath(el) {
      if (!el || !el.parentElement) return "body";
      const p = el.parentElement;
      const name = el.tagName.toLowerCase();
      const idx = Array.from(p.children).indexOf(el);
      return `${cssPath(p)} > ${name}:nth-child(${idx + 1})`;
    }
    function installOnce() {
      const core = window.virtualizer ?? (window.virtualizer = window.createVirtualizer?.() ?? void 0);
      if (core && typeof core.install === "function") {
        try {
          core.install();
        } catch {
        }
      }
    }
    function waitForMessagesAndInstall() {
      if (window.__VIRT_MSG_SEL) {
        if (document.querySelector(window.__VIRT_MSG_SEL)) {
          installOnce();
          return;
        }
      }
      const sel = pickSelector();
      if (sel) {
        window.__VIRT_MSG_SEL = sel;
        if (document.querySelector(sel)) {
          installOnce();
          return;
        }
      }
      const mo = new MutationObserver(() => {
        const chosen = window.__VIRT_MSG_SEL || pickSelector();
        if (chosen && document.querySelectorAll(chosen).length >= 2) {
          window.__VIRT_MSG_SEL = chosen;
          mo.disconnect();
          installOnce();
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
    (function hookHistory() {
      const push = history.pushState;
      const replace = history.replaceState;
      const onRoute = () => waitForMessagesAndInstall();
      history.pushState = function(...args) {
        const r = push.apply(this, args);
        queueMicrotask(onRoute);
        return r;
      };
      history.replaceState = function(...args) {
        const r = replace.apply(this, args);
        queueMicrotask(onRoute);
        return r;
      };
      window.addEventListener("popstate", onRoute);
    })();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", waitForMessagesAndInstall, { once: true });
    } else {
      waitForMessagesAndInstall();
    }
    console.info("[virtualizer] loader active:", location.href);
  })();
})();
