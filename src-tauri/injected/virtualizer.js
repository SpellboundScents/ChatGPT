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
  (function() {
    const g = window;
    if (g.__notice_bound) return;
    const tauri = g.__TAURI__;
    const listen = tauri?.event?.listen;
    if (typeof listen !== "function") return;
    g.__notice_bound = true;
    function ensureToast() {
      let el = document.getElementById("nick-notice");
      if (!el) {
        el = document.createElement("div");
        el.id = "nick-notice";
        el.style.cssText = [
          "position:fixed",
          "left:50%",
          "bottom:16px",
          "transform:translateX(-50%)",
          "padding:10px 14px",
          "border-radius:999px",
          "font:600 13px system-ui,sans-serif",
          "background:color-mix(in oklab, Canvas, CanvasText 10%)",
          "color:CanvasText",
          "box-shadow:0 8px 24px rgba(0,0,0,.20)",
          "z-index:2147483647",
          "display:none",
          "pointer-events:none",
          "max-width:80vw",
          "white-space:nowrap",
          "overflow:hidden",
          "text-overflow:ellipsis"
        ].join(";");
        document.documentElement.appendChild(el);
      }
      return el;
    }
    listen("notice", (ev) => {
      try {
        const el = ensureToast();
        el.textContent = String(ev?.payload ?? "");
        el.style.display = "inline-block";
        clearTimeout(el.__t);
        el.__t = setTimeout(() => {
          el.style.display = "none";
        }, 3e3);
      } catch {
      }
      try {
        console.log("[notice]", ev?.payload);
      } catch {
      }
    });
  })();
})();
//Download Image Hook
// === ChatGPT image download: iframe + shadow-root hardened (v5) =============
(function () {
  if (window.__tauri_dl_chatgpt_v5) return;
  window.__tauri_dl_chatgpt_v5 = true;

  const core = window.__TAURI__ && window.__TAURI__.core;
  if (!core) { console.warn("[tauri] bridge missing; v5 disabled"); return; }

  // --- tiny bridges (no ESM imports needed) ---
  const saveDialog = (opts) => core.invoke("plugin:dialog|save", opts ?? {});
  const writeFile  = (path, bytes) => core.invoke("plugin:fs|writeFile", {
    path, contents: Array.from(bytes)
  });

  const fetchBytes = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };

  const filenameFromUrl = (url, fallback = "image") => {
    try {
      const last = decodeURIComponent((url.split("/").pop() || "").split("?")[0]);
      return (last || fallback).trim();
    } catch { return fallback; }
  };

  const bestFromSrcset = (img) => {
    if (!img) return null;
    if (img.srcset) {
      let best = null, w = -1;
      img.srcset.split(",").forEach(part => {
        const [u, size] = part.trim().split(/\s+/);
        const ww = size?.endsWith("w") ? parseInt(size) : 0;
        if (ww > w) { w = ww; best = u; }
      });
      if (best) return best;
    }
    return img.currentSrc || img.src || null;
  };

  function findCardFor(btn) {
    // Tailwind group class can be encoded; try multiple fallbacks
    return btn.closest(".group\\/imagegen-image, .group\\2f imagegen-image")
        || btn.closest(".group/imagegen-image")
        || btn.closest("[id^='image-']")
        || btn.parentElement;
  }

  function findBestImageUrlFromCard(card) {
    if (!card) return null;
    // largest visible <img> inside the card
    const imgs = Array.from(card.querySelectorAll("img[src]"));
    if (imgs.length) {
      imgs.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
      for (const img of imgs) {
        const u = bestFromSrcset(img);
        if (u) return u;
      }
    }
    // CSS background fallback
    const bg = getComputedStyle(card).backgroundImage;
    const m = /url\(["']?(.+?)["']?\)/.exec(bg || "");
    if (m) return m[1];
    return null;
  }

  async function doSave(url) {
    const dest = await saveDialog({
      title: "Save image",
      defaultPath: filenameFromUrl(url),
      filters: [{ name: "Images", extensions: ["png","jpg","jpeg","webp","gif","svg"] }]
    });
    if (!dest) return;
    try { (window.__loaderShow || Function)(); } catch {}
    const bytes = await fetchBytes(url);
    await writeFile(dest, bytes);
  }

  function bindButton(btn, originTag) {
    if (!btn || btn.__tauriBound) return;
    btn.__tauriBound = true;

    const handler = (ev) => {
      // beat page handlers and native behavior
      if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      ev.stopPropagation();
      ev.preventDefault();

      const card = findCardFor(btn);
      const url  = findBestImageUrlFromCard(card);
      if (!url) { console.warn("[tauri] no image url near button", { originTag }); return; }
      doSave(url).catch(e => alert("Could not save image: " + (e?.message || e)));
    };

    // bind early phases (some UIs listen on pointerdown)
    btn.addEventListener("pointerdown", handler, { capture: true, passive: false });
    btn.addEventListener("click",       handler, { capture: true, passive: false });
  }

  function scanRoot(root, originTag = "document") {
    try {
      const list = root.querySelectorAll?.('button[aria-label="Download this image"]');
      if (list && list.length) list.forEach((b) => bindButton(b, originTag));
    } catch (e) {
      console.warn("[tauri] scanRoot failed", originTag, e);
    }
  }

  function observeRoot(root, originTag = "document") {
    scanRoot(root, originTag);

    // Watch for newly rendered buttons
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type !== "childList") continue;
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (n.matches?.('button[aria-label="Download this image"]')) bindButton(n, originTag);
          // nested
          const nested = n.querySelectorAll?.('button[aria-label="Download this image"]');
          if (nested && nested.length) nested.forEach((b) => bindButton(b, originTag));
          // also wire nested shadow roots if any appear
          try { if (n.shadowRoot) wireShadowRoot(n.shadowRoot, originTag + "→shadow"); } catch {}
        }
      }
    });
    mo.observe(root, { subtree: true, childList: true });
  }

  function wireShadowRoot(sr, tag) {
    if (!sr || sr.__tauriDlWired) return;
    sr.__tauriDlWired = true;
    observeRoot(sr, tag);
  }

  function wireIFrame(iframe, depth = 0) {
    if (!iframe || iframe.__tauriDlWired) return;
    iframe.__tauriDlWired = true;

    const TAG = `[iframe d${depth}] ${iframe.src || "(about:blank)"}`;

    const tryWire = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return setTimeout(tryWire, 120);
        // Same-origin check: accessing .document would have thrown if cross-origin
        observeRoot(doc, TAG);

        // wire existing shadow roots inside the frame
        try {
          const allHosts = doc.querySelectorAll?.("*");
          allHosts && allHosts.forEach((el) => { if (el.shadowRoot) wireShadowRoot(el.shadowRoot, TAG + "→shadow"); });
        } catch {}

        // Recurse into nested iframes (limit depth to avoid runaway)
        if (depth < 4) {
          const recScan = () => {
            try {
              const frames = Array.from(doc.querySelectorAll("iframe"));
              frames.forEach((f) => wireIFrame(f, depth + 1));
            } catch {}
          };
          recScan();
          // watch for future frames
          const mo = new MutationObserver(() => recScan());
          mo.observe(doc.documentElement, { subtree: true, childList: true });
        }

        console.log("[tauri] wired", TAG);
      } catch (e) {
        // cross-origin: we can’t access the doc. Nothing to do here.
        console.warn("[tauri] cross-origin iframe; skipping", TAG);
      }
    };

    // Wire now (if ready) and on load
    tryWire();
    iframe.addEventListener("load", tryWire, { once: false, passive: true });
  }

  // Wire top document
  observeRoot(document, "document");

  // Wire existing shadow roots in top document
  try {
    document.querySelectorAll("*").forEach((el) => { if (el.shadowRoot) wireShadowRoot(el.shadowRoot, "document→shadow"); });
  } catch {}

  // Hook future shadow roots
  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function(init) {
    const sr = origAttachShadow.apply(this, arguments);
    queueMicrotask(() => wireShadowRoot(sr, "attachShadow"));
    return sr;
  };

  // Wire all current iframes (same-origin only)
  (function wireExistingIframes() {
    try {
      document.querySelectorAll("iframe").forEach((f) => wireIFrame(f, 0));
    } catch {}
  })();

  // Watch for future iframes
  const moFrames = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type !== "childList") continue;
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (n.tagName === "IFRAME") wireIFrame(n, 0);
        // nested frames inside subtree
        const nested = n.querySelectorAll?.("iframe");
        if (nested && nested.length) nested.forEach((f) => wireIFrame(f, 0));
      }
    }
  });
  moFrames.observe(document.documentElement, { subtree: true, childList: true });

  console.log("[tauri] ChatGPT download override v5 (iframe+shadow) active");
})();