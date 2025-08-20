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
})();
