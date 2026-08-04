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

export { downloadBulletinPdf as printBulletin } from '../lib/bulletinPdf'
