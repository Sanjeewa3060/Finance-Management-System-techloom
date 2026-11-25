import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import RouteProgress from './components/RouteProgress.jsx'
import { AsgardeoRoot } from './auth/AsgardeoRoot.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AsgardeoRoot>
          <RouteProgress />
          <App />
        </AsgardeoRoot>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)

