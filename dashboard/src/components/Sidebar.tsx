/**
 * Sidebar  Eshared navigation component
 */

import { Link } from 'react-router-dom';
import { Map, List, BarChart2, LogOut } from 'lucide-react';
import { signOut } from '../services/authService';
import type { UserDocument } from '../types';

interface Props {
  active: 'map' | 'incidents' | 'admin';
  userDoc: UserDocument | null;
}

const NAV = [
  { key: 'map', label: 'Live Map', icon: Map, to: '/' },
  { key: 'incidents', label: 'Incidents', icon: List, to: '/incidents' },
  { key: 'admin', label: 'Records', icon: BarChart2, to: '/admin' },
];

export default function Sidebar({ active, userDoc }: Props) {
  const handleSignOut = () => {
    signOut();
    window.location.reload();
  };

  return (
    <div className="w-16 md:w-56 bg-gray-900 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <span className="hidden md:block text-white font-bold text-lg">Emergo</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4">
        {NAV.map(({ key, label, icon: Icon, to }) => (
          <Link
            key={key}
            to={to}
            className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
              active === key
                ? 'bg-red-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon size={20} />
            <span className="hidden md:block text-sm font-medium">{label}</span>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center text-white text-sm font-bold">
            {userDoc?.displayName?.[0] ?? '?'}
          </div>
          <div className="hidden md:block">
            <p className="text-white text-sm font-medium truncate max-w-[120px]">
              {userDoc?.displayName ?? 'Loading...'}
            </p>
            <p className="text-gray-400 text-xs capitalize">{userDoc?.role}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm w-full"
        >
          <LogOut size={16} />
          <span className="hidden md:block">Sign out</span>
        </button>
      </div>
    </div>
  );
}
