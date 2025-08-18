// normalize.worker.js
self.onmessage = (e) => {
  const html = e.data || "";
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const container = doc.body.firstElementChild;
  if (!container) return self.postMessage("");

  const root = container;

  // Convert DIV+CODE → PRE+CODE
  root.querySelectorAll('div.overflow-y-auto > code.whitespace-pre\\!').forEach((codeEl) => {
    const pre = doc.createElement("pre");
    pre.className = "nick-code";
    const newCode = doc.createElement("code");

    codeEl.classList.forEach((c) => c.startsWith("language-") && newCode.classList.add(c));

    const spans = codeEl.querySelectorAll(":scope > span");
    newCode.textContent = spans.length
      ? Array.from(spans, (s) => s.textContent || "").join("\n")
      : (codeEl.textContent || "");

    pre.appendChild(newCode);
    codeEl.parentElement.replaceWith(pre);
  });

  // Flatten PRE+CODE spans
  root.querySelectorAll("pre > code").forEach((codeEl) => {
    const spans = codeEl.querySelectorAll(":scope > span");
    if (spans.length) {
      codeEl.textContent = Array.from(spans, (s) => s.textContent || "").join("\n");
    }
    codeEl.parentElement.classList.add("nick-code");
  });

  // Remove noisy data-* attrs
  root.querySelectorAll("[data-start],[data-end],[data-message-author-role],[data-message-id]").forEach((n) => {
    n.removeAttribute("data-start");
    n.removeAttribute("data-end");
    n.removeAttribute("data-message-author-role");
    n.removeAttribute("data-message-id");
  });

  // Light unwrap of wrappers
  root.querySelectorAll(".contain-inline-size, .sticky, .absolute").forEach((el) => {
    const hasCode = el.querySelector(":scope > pre, :scope > code");
    if (hasCode && el.parentElement) {
      while (el.firstChild) el.parentElement.insertBefore(el.firstChild, el);
      el.remove();
    } else {
      el.classList.remove("contain-inline-size", "sticky", "absolute");
      el.style.cssText = "";
    }
  });

  self.postMessage(root.innerHTML);
};
// React (Vite/Rspack/Webpack compatible pattern)
const worker = new Worker(new URL("./normalize.worker.js", import.meta.url), { type: "module" });
// …
worker.postMessage(rawHtml);
worker.onmessage = (e) => { setNormalized(e.data); worker.terminate(); };
// Group into messages. Prefer original ChatGPT wrappers if present:
const candidates = root.querySelectorAll('[data-message-author-role], .markdown, .prose');

// After you set innerHTML in your React/vanilla view:
container.querySelectorAll('img:not([loading])').forEach(img => {
  img.setAttribute('loading', 'lazy');
  img.setAttribute('decoding', 'async');
  img.setAttribute('referrerpolicy', 'no-referrer'); // optional
});

// If we found message-like blocks, wrap them as .msg; otherwise, fall back
if (candidates.length) {
  candidates.forEach((el, i) => {
    if (!el.closest('.msg')) {
      const wrapper = doc.createElement('section');
      wrapper.className = 'msg';
      wrapper.setAttribute('data-msg-index', String(i));
      el.before(wrapper);
      wrapper.appendChild(el);
    }
  });
} else {
  // Fallback: wrap each top-level block element as a message
  Array.from(root.children).forEach((el, i) => {
    if (!el.classList.contains('msg')) {
      const wrapper = doc.createElement('section');
      wrapper.className = 'msg';
      wrapper.setAttribute('data-msg-index', String(i));
      el.before(wrapper);
      wrapper.appendChild(el);
    }
  });
}
