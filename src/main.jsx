import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthApp from './AuthApp.jsx'
import './index.css'
import './design.css'
import './modules/record-editor.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthApp />
  </React.StrictMode>,
)
