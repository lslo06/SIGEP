import React from 'react'
import ReactDOM from 'react-dom/client'
import LocalApp from './LocalApp.jsx'
import { productTitle } from './lib/brand.js'
import './index.css'
import './design.css'
import './modules/record-editor.css'
import './visual-refresh.css'

document.title = productTitle

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocalApp />
  </React.StrictMode>,
)
