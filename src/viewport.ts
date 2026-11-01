// Para que las zonas seguras (notch, barra de gestos) funcionen hace falta `viewport-fit=cover`.
// Se asegura aquí para no depender de index.html (si ya lo tienes allí, esto no cambia nada).
export function ensureViewportCover(): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'viewport'
    document.head.appendChild(meta)
  }
  const content = meta.getAttribute('content') ?? ''
  if (!/viewport-fit\s*=\s*cover/.test(content)) {
    const base = content.trim() ? content.replace(/,\s*$/, '') : 'width=device-width, initial-scale=1'
    meta.setAttribute('content', `${base}, viewport-fit=cover`)
  }
}
