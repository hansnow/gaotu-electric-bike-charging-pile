import { useEffect } from 'react';

interface UsePollingOptions {
  interval: number;
  enabled?: boolean;
}

export const usePolling = (
  callback: () => void | Promise<void>,
  { interval, enabled = true }: UsePollingOptions
): void => {
  useEffect(() => {
    if (!enabled) return undefined;

    let stopped = false;
    const tick = async () => {
      try {
        await callback();
      } catch (error) {
        console.error('[usePolling] 执行失败', error);
      }
    };

    tick();
    const timer = setInterval(() => {
      if (!stopped) {
        void tick();
      }
    }, interval);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [callback, interval, enabled]);
};
