import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ScheduleProvider } from './context/ScheduleContext'
import { MembersProvider } from './context/MembersContext'
import { RoleProvider } from './context/RoleContext'
import './index.css'

import { applyThemeToDocument, applyColorModeToDocument, readStoredTheme, readStoredColorMode } from './theme/themeConfig.js'

applyThemeToDocument(readStoredTheme())
applyColorModeToDocument(readStoredColorMode())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <ScheduleProvider>
          <MembersProvider>
            <RoleProvider>
              <App />
            </RoleProvider>
          </MembersProvider>
        </ScheduleProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
