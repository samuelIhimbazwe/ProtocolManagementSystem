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

import { applyThemeToDocument, readStoredTheme } from './theme/themeConfig.js'

applyThemeToDocument(readStoredTheme())

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
