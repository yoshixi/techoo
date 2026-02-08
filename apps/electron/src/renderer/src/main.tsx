import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from './components/AuthGate'

const root = createRoot(document.getElementById('root')!)
root.render(<StrictMode><AuthGate /></StrictMode>)
