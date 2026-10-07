import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './matriz.css'
import './admin.css'
import './evaluacion.css'
import './calendario.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ProveedorDialogos from './components/ProveedorDialogos.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ProveedorDialogos>
        <App />
      </ProveedorDialogos>
    </ErrorBoundary>
  </StrictMode>,
)
