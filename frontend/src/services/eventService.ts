import type { ChargingEvent, EventsResponse } from '@/types';

const handleEventResponse = async (response: Response): Promise<ChargingEvent[]> => {
  if (!response.ok) {
    throw new Error(`获取事件失败 (${response.status})`);
  }

  const payload = (await response.json()) as EventsResponse;
  if (!payload.success) {
    throw new Error(payload.error || '事件接口返回失败');
  }
  return payload.events || [];
};

const fetchEvents = async (date: string): Promise<ChargingEvent[]> => {
  const response = await fetch(`/events?date=${date}`);
  return handleEventResponse(response);
};

export const eventService = {
  fetchEvents
};
