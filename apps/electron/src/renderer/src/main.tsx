import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ApiApp from './ApiApp'
import { FloatingTaskWindow } from './components/FloatingTaskWindow'

const params = new URLSearchParams(window.location.search)
const isFloating = params.get('floating') === '1'
const useApi = import.meta.env.VITE_USE_API === 'true'

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>{isFloating ? <FloatingTaskWindow /> : useApi ? <ApiApp /> : <App />}</StrictMode>
)
