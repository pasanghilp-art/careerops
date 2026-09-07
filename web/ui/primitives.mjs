export const byId = (id) => document.getElementById(id)

export const createFocusTrap = (modalEl, openerEl) => {
  const focusables = modalEl.querySelectorAll('button, input, textarea, select, a[href]')
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  first?.focus()

  function handleKeydown(e) {
    if (e.key !== 'Tab') return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }

  modalEl.addEventListener('keydown', handleKeydown)

  return function releaseFocusTrap() {
    modalEl.removeEventListener('keydown', handleKeydown)
    openerEl?.focus()
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
