import { format } from 'date-fns';

export const getTodayDateString = (): string => {
  return format(new Date(), 'yyyy-MM-dd');
};

export const formatDurationFromMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '--';
  }

  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
};

export const toDateInputValue = (value: string | null | undefined): string => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return getTodayDateString();
};
