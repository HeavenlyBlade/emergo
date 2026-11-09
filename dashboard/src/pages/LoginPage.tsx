/**
 * LoginPage — Username/password login for officials and tanods
 * Background: seamless crossfade between bg-1.mp4, bg-2.mp4, bg-3.mp4
 */

import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { signInWithCredentials } from '../services/authService';

const BG_VIDEOS = ['/bg-1.mp4', '/bg-2.mp4', '/bg-3.mp4'];

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const activeRef = useRef<'A' | 'B'>('A');
  const indexRef = useRef(0);

  useEffect(() => {
    const a = videoA.current;
    const b = videoB.current;
    if (!a || !b) return;

    a.src = BG_VIDEOS[0];
    a.style.opacity = '1';
    b.style.opacity = '0';
    b.src = BG_VIDEOS[1];
    b.load();

    const handleEnded = () => {
      const current = activeRef.current === 'A' ? a : b;
      const next = activeRef.current === 'A' ? b : a;

      indexRef.current = (indexRef.current + 1) % BG_VIDEOS.length;
      const nextIndex = (indexRef.current + 1) % BG_VIDEOS.length;

      next.style.transition = 'opacity 0.8s ease-in-out';
      current.style.transition = 'opacity 0.8s ease-in-out';
      next.play().catch(() => {});
      next.style.opacity = '1';
      current.style.opacity = '0';

      activeRef.current = activeRef.current === 'A' ? 'B' : 'A';

      setTimeout(() => {
        current.src = BG_VIDEOS[nextIndex];
        current.load();
      }, 900);
    };

    a.addEventListener('ended', handleEnded);
    b.addEventListener('ended', handleEnded);
    a.play().catch(() => {});

    return () => {
      a.removeEventListener('ended', handleEnded);
      b.removeEventListener('ended', handleEnded);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Enter your username and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithCredentials(username, password);
      onLogin();
    } catch (e: any) {
      toast.error(e?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sharedVideoClass = 'absolute inset-0 w-full h-full object-cover';

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-black">

      <video
        ref={videoA}
        className={sharedVideoClass}
        style={{ opacity: 1, transition: 'opacity 0.8s ease-in-out' }}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={videoB}
        className={sharedVideoClass}
        style={{ opacity: 0, transition: 'opacity 0.8s ease-in-out' }}
        muted
        playsInline
        preload="auto"
      />

      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl font-black text-red-600">E</span>
          <h1 className="text-3xl font-bold text-white mt-2">Emergo</h1>
          <p className="text-white/70 text-sm mt-1">
            Barangay Marketview — Official Dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. brgy_captain"
              autoComplete="username"
              autoFocus
              className="w-full bg-white/20 border border-white/30 rounded-lg px-3 h-12 text-white placeholder-white/40 outline-none focus:border-white/60 transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-3 pr-10 h-12 text-white placeholder-white/40 outline-none focus:border-white/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-12 rounded-lg disabled:opacity-60 transition-colors mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="text-white/30 text-xs text-center mt-6">
          For access, contact your barangay administrator.
        </p>
      </div>
    </div>
  );
}
