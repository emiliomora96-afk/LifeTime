import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary'
import './mobile.css'
import './ui.css'
import { installHaptics } from './haptics'
import { ensureViewportCover } from './viewport'

ensureViewportCover()
installHaptics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
