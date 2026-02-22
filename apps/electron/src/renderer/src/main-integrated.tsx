import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ApiApp from './ApiApp'
import './assets/index.css'

// Environment variable to toggle between local UI and API integration
const USE_API = import.meta.env.VITE_USE_API === 'true'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {USE_API ? (
      <>
        <div className="fixed top-0 right-0 z-50 bg-green-700 text-white px-3 py-1 text-xs font-mono">
          API MODE
        </div>
        <ApiApp />
      </>
    ) : (
      <>
        <div className="fixed top-0 right-0 z-50 bg-blue-500 text-white px-3 py-1 text-xs font-mono">
          LOCAL MODE
        </div>
        <App />
      </>
    )}
  </React.StrictMode>
)
