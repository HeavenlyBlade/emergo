// Place your alarm sound at dashboard/public/alarm.mp3
import { useRef, useCallback } from 'react';

export function useAlarmSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAlarm = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const startAlarm = useCallback(() => {
    stopAlarm();
    const audio = new Audio('/alarm.mp3');
    audio.loop = true;
    audio.onerror = () => {
      audioRef.current = null;
    };
    audioRef.current = audio;
    audio.play().catch(() => {});
  }, [stopAlarm]);

  return { startAlarm, stopAlarm };
}
