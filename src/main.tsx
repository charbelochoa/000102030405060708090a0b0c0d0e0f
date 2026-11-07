import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './interface.css'
import { AppearanceProvider } from './Appearance'
import { MotionConfig } from 'motion/react'
import { ErrorBoundary } from './ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppearanceProvider>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </AppearanceProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
