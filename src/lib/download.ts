/**
 * Guarda un archivo. En iPhone (web app instalada) usa la hoja de compartir,
 * que deja guardarlo en Archivos o mandarlo por WhatsApp/correo.
 */
export async function saveFile(name: string, mime: string, content: string): Promise<boolean> {
  const file = new File([content], name, { type: mime })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name })
      return true
    }
  } catch (e) {
    // El usuario canceló la hoja de compartir: no es un error
    if ((e as DOMException)?.name === 'AbortError') return false
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return true
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
