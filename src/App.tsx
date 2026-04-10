import { BrowserRouter, Route, Routes } from 'react-router'

import { SessionProvider } from './context/SessionContext'
import Checkout from './pages/Checkout'
import Dashboard from './pages/Dashboard'
import Optimizing from './pages/Optimizing'
import Success from './pages/Success'

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/optimizing" element={<Optimizing />} />
          <Route path="/success" element={<Success />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}

export default App
