/**
 * Emergo Dashboard — App root
 *
 * Routes:
 *   /           → MapPage (Module 6)
 *   /incidents  → IncidentsPage (Module 7)
 *   /admin      → AdminPage (Module 9)
 *
 * Auth guard: unauthenticated users → LoginPage
 * Officials/tanods only — residents are redirected back to login
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import IncidentsPage from './pages/IncidentsPage';
import AdminPage from './pages/AdminPage';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { uid, userDoc, loading, refresh } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!uid || !userDoc) {
    return <LoginPage onLogin={refresh} />;
  }

  if (userDoc.role === 'resident') {
    return <LoginPage onLogin={refresh} />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<AuthGuard><MapPage /></AuthGuard>} />
        <Route path="/incidents" element={<AuthGuard><IncidentsPage /></AuthGuard>} />
        <Route path="/admin" element={<AuthGuard><AdminPage /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
