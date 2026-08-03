import { useState } from 'react'

export function useDisplayFormat(storageKey, defaultFormat = 'cards') {
  const [format, setFormatState] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey)
      if (v === 'cards' || v === 'list' || v === 'bulletin') return v
    } catch {
      /* ignore */
    }
    return defaultFormat
  })

  const setFormat = (next) => {
    setFormatState(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      /* ignore */
    }
  }

  return [format, setFormat]
}

export function printBulletin(elementId) {
  const el = document.getElementById(elementId)
  if (!el) {
    window.print()
    return
  }
  const prev = document.body.innerHTML
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('')
  document.body.innerHTML = `${styles}<div class="pmss-print-root">${el.innerHTML}</div>`
  window.print()
  document.body.innerHTML = prev
  window.location.reload()
}
