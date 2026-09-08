export const byId = (id) => document.getElementById(id)

const FOCUSABLE_SEL = [
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isVisibleFocusable(el, root) {
  if (!el || el.disabled || el.getAttribute('aria-hidden') === 'true') return false
  if (el.tabIndex < 0 && !el.matches('a[href], button, input, textarea, select')) return false
  // Skip nodes inside a nested .hidden / [hidden] region (not the modal root itself).
  let node = el
  while (node && node !== root) {
    if (node.hidden || node.classList?.contains('hidden')) return false
    node = node.parentElement
  }
  const style = window.getComputedStyle(el)
  return style.visibility !== 'hidden' && style.display !== 'none'
}

/** Trap Tab inside a .modal (prefer .box). Returns a release fn that restores focus to opener. */
export const createFocusTrap = (modalEl, openerEl, initialEl) => {
  if (!modalEl) return () => {}
  const root = modalEl.querySelector('.box') || modalEl

  const focusables = () => [...root.querySelectorAll(FOCUSABLE_SEL)]
    .filter((el) => isVisibleFocusable(el, root))

  const start = initialEl && root.contains(initialEl) && isVisibleFocusable(initialEl, root)
    ? initialEl
    : focusables()[0]
  if (start) start.focus()
  else if (!root.hasAttribute('tabindex')) {
    root.setAttribute('tabindex', '-1')
    root.focus()
  } else root.focus()

  function handleKeydown(e) {
    if (e.key !== 'Tab') return
    const list = focusables()
    if (!list.length) {
      e.preventDefault()
      root.focus()
      return
    }
    const first = list[0]
    const last = list[list.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !root.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  modalEl.addEventListener('keydown', handleKeydown)

  return function releaseFocusTrap() {
    modalEl.removeEventListener('keydown', handleKeydown)
    if (openerEl && typeof openerEl.focus === 'function') {
      try { openerEl.focus() } catch (_e) { /* opener may be gone */ }
    }
  }
}

export const escapeHtml = (value) => String(value || '').replace(
  /[&<>"]/g,
  (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character],
)

export const commaList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(String(text || ''))
  const input = document.createElement('textarea')
  input.value = String(text || '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  input.remove()
  return Promise.resolve()
}
