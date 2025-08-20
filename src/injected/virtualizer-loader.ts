// @ts-nocheck
// Auto-detect ChatGPT message nodes, set __VIRT_MSG_SEL, then install().
(function () {
  // Candidate selectors seen across ChatGPT UI variants
  const CANDIDATES = [
    '[data-message-author-role]',
    '[data-testid="conversation-turn"]',
    'main [data-testid^="conversation-turn"]',
    // fallbacks:
    'main [data-message-id]',
    'main article:has([data-message-author-role])',
    'main div[role="listitem"]'
  ];

  function pickSelector(): string | null {
    for (const sel of CANDIDATES) {
      try {
        const n = document.querySelectorAll(sel).length;
        if (n >= 2) return sel;
      } catch {}
    }
    // Heuristic fallback: find the tallest scrolling column with many children
    const mains = Array.from(document.querySelectorAll('main, [data-testid="conversation"]')) as HTMLElement[];
    for (const m of mains) {
      const cols = Array.from(m.querySelectorAll(':scope > *')) as HTMLElement[];
      let best: {container: HTMLElement, sel: string, count: number} | null = null;
      for (const col of cols) {
        const kids = Array.from(col.children) as HTMLElement[];
        if (kids.length >= 5) {
          const sel = kids.length ? `${cssPath(col)} > *` : '';
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

  // Minimal CSS path helper for stable ":scope > *" usage
  function cssPath(el: Element): string {
    if (!el || !el.parentElement) return 'body';
    const p = el.parentElement;
    const name = el.tagName.toLowerCase();
    const idx = Array.from(p.children).indexOf(el);
    return `${cssPath(p)} > ${name}:nth-child(${idx + 1})`;
  }

  function installOnce() {
    // @ts-ignore
    const core = window.virtualizer ?? (window.virtualizer = (window as any).createVirtualizer?.() ?? undefined);
    if (core && typeof core.install === 'function') {
      try { core.install(); } catch {}
    }
  }

  function waitForMessagesAndInstall() {
    // if already set, try immediately
    if ((window as any).__VIRT_MSG_SEL) {
      if (document.querySelector((window as any).__VIRT_MSG_SEL)) {
        installOnce();
        return;
      }
    }
    // try to pick one now
    const sel = pickSelector();
    if (sel) {
      (window as any).__VIRT_MSG_SEL = sel;
      if (document.querySelector(sel)) {
        installOnce();
        return;
      }
    }
    // watch until any candidate appears
    const mo = new MutationObserver(() => {
      const chosen = (window as any).__VIRT_MSG_SEL || pickSelector();
      if (chosen && document.querySelectorAll(chosen).length >= 2) {
        (window as any).__VIRT_MSG_SEL = chosen;
        mo.disconnect();
        installOnce();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Re-run on SPA route changes
  (function hookHistory() {
    const push = history.pushState;
    const replace = history.replaceState;
    const onRoute = () => waitForMessagesAndInstall();
    history.pushState = function (...args) { const r = push.apply(this, args as any); queueMicrotask(onRoute); return r; };
    history.replaceState = function (...args) { const r = replace.apply(this, args as any); queueMicrotask(onRoute); return r; };
    window.addEventListener('popstate', onRoute);
  })();

  // Kickoff (document-start friendly)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForMessagesAndInstall, { once: true });
  } else {
    waitForMessagesAndInstall();
  }

  console.info('[virtualizer] loader active:', location.href);
})();

export {};