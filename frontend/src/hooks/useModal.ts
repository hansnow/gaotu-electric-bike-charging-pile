import { useCallback, useState } from 'react';

export const useModal = <T,>() => {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<T | null>(null);

  const open = useCallback((data: T) => {
    setPayload(data);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setPayload(null);
  }, []);

  return {
    isOpen,
    payload,
    open,
    close
  };
};
