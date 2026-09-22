/**
 * Emergo Dashboard  EApp root
 *
 * Routes:
 *   /           ↁEMapPage (Module 6)
 *   /incidents  ↁEIncidentsPage (Module 7)
 *   /admin      ↁEAdminPage (Module 9)
 *
 * Auth guard: unauthenticated users ↁELoginPage
 * Officials/tanods only  Eresidents are redirected back to login
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import IncidentsPage from './pages/IncidentsPage';
import AdminPage from './pages/AdminPage';
import DevLoginPage from './pages/DevLoginPage';

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
        <Route path="/dev-login" element={<DevLoginPage onLogin={() => window.location.replace('/')} />} />
        <Route path="/" element={<AuthGuard><MapPage /></AuthGuard>} />
        <Route path="/incidents" element={<AuthGuard><IncidentsPage /></AuthGuard>} />
        <Route path="/admin" element={<AuthGuard><AdminPage /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
