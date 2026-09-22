/**
 * LoginPage  EPhone OTP login for officials and tanods
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { sendOtp, confirmOtp } from '../services/authService';

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [digits, setDigits] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">🚨</span>
          <h1 className="text-2xl font-bold text-red-700 mt-2">Emergo</h1>
          <p className="text-sm text-gray-500">Barangay Marketview Dashboard</p>
        </div>

        {step === 'phone' ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobile number
            </label>
            <div className="flex items-center border border-gray-300 rounded-lg px-3 h-12 mb-4">
              <span className="text-gray-600 font-semibold mr-2">+63</span>
              <input
                type="tel"
                maxLength={10}
                value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
                placeholder="9171234567"
                className="flex-1 outline-none text-base"
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-red-700 hover:bg-red-800 text-white font-semibold h-12 rounded-lg disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send verification code'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Code sent to <strong>{phoneNumber}</strong>
            </p>
            <input
              type="number"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.slice(0, 6))}
              placeholder="000000"
              className="w-full border border-gray-300 rounded-lg h-14 text-center text-3xl font-bold tracking-widest outline-none mb-4"
              autoFocus
            />
            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full bg-red-700 hover:bg-red-800 text-white font-semibold h-12 rounded-lg disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full mt-2 text-red-700 text-sm"
            >
              Wrong number? Go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
