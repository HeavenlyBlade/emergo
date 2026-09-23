/**
 * LoginPage — Phone OTP login for officials and tanods
 * Background: seamless crossfade between bg-1.mp4, bg-2.mp4, bg-3.mp4
 * Two video elements swap opacity to eliminate the grey flash between clips.
 */

import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { sendOtp, confirmOtp } from '../services/authService';

const BG_VIDEOS = ['/bg-1.mp4', '/bg-2.mp4', '/bg-3.mp4'];

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [digits, setDigits] = useState('');
  const [otp, setOtp] = useState('');
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

  const phoneNumber = '+63' + digits;

  const handleSendOtp = async () => {
    if (digits.length !== 10 || !digits.startsWith('9')) {
      toast.error('Enter a valid 10-digit Philippine mobile number.');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(phoneNumber);
      toast.success('Code sent!');
      setStep('otp');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      const userDoc = await confirmOtp(phoneNumber, otp);
      if (userDoc.role === 'resident') {
        toast.error('This dashboard is for officials and tanods only.');
        return;
      }
      onLogin();
    } catch (e: any) {
      toast.error(e?.message ?? 'Verification failed.');
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
          <span className="text-5xl">🚨</span>
          <h1 className="text-3xl font-bold text-white mt-2">Emergo</h1>
          <p className="text-white/70 text-sm mt-1">
            Barangay Marketview — Official Dashboard
          </p>
        </div>

        {step === 'phone' ? (
          <>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Mobile number
            </label>
            <div className="flex items-center bg-white/20 border border-white/30 rounded-lg px-3 h-12 mb-4">
              <span className="text-white font-semibold mr-2">+63</span>
              <input
                type="tel"
                maxLength={10}
                value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
                placeholder="9171234567"
                className="flex-1 outline-none text-base bg-transparent text-white placeholder-white/40"
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                autoFocus
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-12 rounded-lg disabled:opacity-60 transition-colors"
            >
              {loading ? 'Sending...' : 'Send verification code'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-white/70 mb-4 text-center">
              Code sent to <strong className="text-white">{phoneNumber}</strong>
            </p>
            <input
              type="number"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.slice(0, 6))}
              placeholder="000000"
              className="w-full bg-white/20 border border-white/30 rounded-lg h-14 text-center text-3xl font-bold tracking-widest outline-none mb-4 text-white placeholder-white/30"
              autoFocus
            />
            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-12 rounded-lg disabled:opacity-60 transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full mt-2 text-white/60 hover:text-white text-sm transition-colors"
            >
              Wrong number? Go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
