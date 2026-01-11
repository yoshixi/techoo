import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { FloatingTaskWindow } from './components/FloatingTaskWindow'

const params = new URLSearchParams(window.location.search)
const isFloating = params.get('floating') === '1'

// Make body transparent for floating window
if (isFloating) {
  document.body.classList.add('floating-window')
}

const root = createRoot(document.getElementById('root')!)
root.render(<StrictMode>{isFloating ? <FloatingTaskWindow /> : <App />}</StrictMode>)
