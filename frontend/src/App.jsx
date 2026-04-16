import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-dark-bg text-white">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
