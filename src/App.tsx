import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ScanInput from './pages/ScanInput'
import ScanResult from './pages/ScanResult'
import ScanHistory from './pages/ScanHistory'
import ProtectedRoute from './components/ProtectedRoute'

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<ProtectedRoute><ScanInput /></ProtectedRoute>} />
        <Route path="/scans/:scanId" element={<ProtectedRoute><ScanResult /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><ScanHistory /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
)

export default App
