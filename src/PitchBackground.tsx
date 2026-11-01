import './pitch.css'
import { PITCH_SVG } from './pitchSvg'

// Fondo del campo con estilo anime: césped segmentado, focos del estadio, líneas con brillo y destellos.
export default function PitchBackground() {
  return <div className="pitch-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PITCH_SVG }} />
}
