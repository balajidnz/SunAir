// @ts-check

/**
 * The entire XSS mitigation for this project, in one place so it cannot be
 * forgotten.
 *
 * The ending message is decoded from the URL hash, which means it is fully
 * attacker-controlled: anyone can craft `sunair.fun/#m=<payload>` and send it
 * to someone. `textContent` is inert — it cannot produce an element, ever.
 *
 * Line breaks come from `white-space: pre-wrap` in CSS, NOT from replacing
 * newlines with <br> and assigning innerHTML. That "harmless" convenience is
 * exactly how people reopen the hole they just closed.
 *
 * Rule: no decoded content ever reaches innerHTML, insertAdjacentHTML,
 * outerHTML, document.write, or an href/src/style attribute.
 *
 * @param {HTMLElement} el
 * @param {string} text
 */
export function safeRender(el, text) {
  el.textContent = text;
}
