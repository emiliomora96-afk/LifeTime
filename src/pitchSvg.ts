// Dibujo del campo (SVG). Solo es decoración de fondo.
// Diseñado para que NO compita con los jugadores: verde apagado, franjas casi imperceptibles,
// líneas finas y de baja opacidad, sin brillos ni destellos.
// Para ajustar: PITCH_STYLE (colores y opacidades).
export const PITCH_STYLE = {
  grassA: '#2f6f48', // franja clara
  grassB: '#2b6843', // franja oscura (casi igual: poco contraste)
  lineColor: '#d6ebdd',
  lineWidth: 1.2, // grosor de las líneas (en unidades del dibujo, 400 de ancho)
  lineOpacity: 0.3, // opacidad de las líneas
}

const { grassA, grassB, lineColor, lineWidth, lineOpacity } = PITCH_STYLE

const stripes = Array.from({ length: 8 }, (_, i) => {
  const h = 500 / 8
  return `<rect x="0" y="${i * h}" width="400" height="${h}" fill="${i % 2 === 0 ? grassA : grassB}"/>`
}).join('')

export const PITCH_SVG = `<svg viewBox="0 0 400 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
<defs>
<radialGradient id="pa-vig" cx=".5" cy=".5" r=".75">
<stop offset=".6" stop-color="#0a2417" stop-opacity="0"/><stop offset="1" stop-color="#0a2417" stop-opacity=".35"/>
</radialGradient>
</defs>
${stripes}
<g fill="none" stroke="${lineColor}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${lineOpacity}">
<rect x="14" y="14" width="372" height="472" rx="6"/>
<path d="M14 250 H386"/>
<circle cx="200" cy="250" r="46"/>
<rect x="100" y="14" width="200" height="70"/>
<rect x="150" y="14" width="100" height="26"/>
<path d="M173.2 84 A36 36 0 0 0 226.8 84"/>
<rect x="100" y="416" width="200" height="70"/>
<rect x="150" y="460" width="100" height="26"/>
<path d="M173.2 416 A36 36 0 0 1 226.8 416"/>
</g>
<circle cx="200" cy="250" r="2" fill="${lineColor}" opacity="${lineOpacity}"/>
<rect width="400" height="500" fill="url(#pa-vig)"/>
</svg>`
