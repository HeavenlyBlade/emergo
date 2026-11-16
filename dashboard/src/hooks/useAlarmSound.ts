/**
 * useAlarmSound
 *
 * Web Audio API siren — two-tone oscillator sweeping between 800 Hz and 1200 Hz
 * every 0.5 s, looping until stopped. No audio file needed.
 *
 * Usage:
 *   const { startAlarm, stopAlarm } = useAlarmSound();
 */
import { useRef, useCallback } from 'react';

export function useAlarmSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAlarm = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {
        // already stopped — ignore
      }
      oscRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
    }
  }, []);

  const startAlarm = useCallback(() => {
    // Stop any currently running alarm first
    stopAlarm();

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    oscRef.current = osc;

    // Alternate between 800 Hz and 1200 Hz every 0.5 s
    let high = true;
    intervalRef.current = setInterval(() => {
      if (oscRef.current && ctxRef.current) {
        high = !high;
        oscRef.current.frequency.setValueAtTime(
          high ? 1200 : 800,
          ctxRef.current.currentTime
        );
      }
    }, 500);
  }, [stopAlarm]);

  return { startAlarm, stopAlarm };
}
