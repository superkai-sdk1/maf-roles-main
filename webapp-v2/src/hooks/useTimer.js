import { useState, useEffect, useRef, useCallback } from 'react';

export const useTimer = (initialTime = 60, onComplete = null) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const endTimeRef = useRef(null);
  const intervalRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const triggerVibration = () => {
    if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);
  };

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(initialTime);
  }, [initialTime]);

  const start = useCallback((seconds) => {
    const dur = seconds ?? initialTime;
    const endTime = Date.now() + dur * 1000;
    endTimeRef.current = endTime;
    setTimeLeft(dur);
    setIsRunning(true);
    setIsPaused(false);

    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      if (remaining === 10) triggerVibration();
      
      if (remaining === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsRunning(false);
        setIsPaused(false);
        setTimeLeft(0);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    }, 250);
  }, [initialTime]);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (isPaused && timeLeft > 0) {
      const endTime = Date.now() + timeLeft * 1000;
      endTimeRef.current = endTime;
      setIsPaused(false);

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 10) triggerVibration();
        if (remaining === 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsRunning(false);
          setIsPaused(false);
          setTimeLeft(0);
          if (onCompleteRef.current) onCompleteRef.current();
        }
      }, 250);
    }
  }, [isPaused, timeLeft]);

  const addTime = useCallback((seconds) => {
    setTimeLeft(prev => prev + seconds);
    if (isRunning && !isPaused && endTimeRef.current) {
      endTimeRef.current += seconds * 1000;
    }
  }, [isRunning, isPaused]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isRunning && !isPaused && endTimeRef.current) {
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0) {
          stop();
          if (onCompleteRef.current) onCompleteRef.current();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isRunning, isPaused, stop]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { timeLeft, isRunning, isPaused, start, pause, resume, stop, addTime };
};
