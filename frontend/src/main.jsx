import { StrictMode } from 'react'
import { ConfirmProvider } from './components/ConfirmDialog.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PlayerProvider from './player/PlayerProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ConfirmProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </ConfirmProvider>
    </ErrorBoundary>
  </StrictMode>,
)
