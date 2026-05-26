import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

async function bootstrap() {
  // Activate mock IPC when running outside of Tauri (browser dev, Playwright E2E)
  if (!('__TAURI_INTERNALS__' in window)) {
    const { mockIPC } = await import('@tauri-apps/api/mocks')
    const { handleMockIPC } = await import('@/api/mock-ipc')
    mockIPC((cmd, args) => handleMockIPC(cmd, args as Record<string, unknown>))
  }

  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Root element not found')

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
