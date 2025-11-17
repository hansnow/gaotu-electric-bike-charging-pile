import { create } from 'zustand';
import type { ChargingEvent } from '@/types';
import { eventService } from '@/services/eventService';
import { getTodayDateString } from '@/utils/timeFormat';

interface EventState {
  events: ChargingEvent[];
  loading: boolean;
  error: string | null;
  selectedDate: string;
  fetchEvents: (date?: string) => Promise<void>;
  setSelectedDate: (date: string) => void;
  getEventsBySocket: (stationId: number, socketId: number) => ChargingEvent[];
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,
  error: null,
  selectedDate: getTodayDateString(),
  fetchEvents: async (inputDate) => {
    const date = inputDate || get().selectedDate;
    set({ loading: true, error: null });
    try {
      const events = await eventService.fetchEvents(date);
      set({ events, loading: false, selectedDate: date });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '事件加载失败'
      });
      throw error;
    }
  },
  setSelectedDate: (date) => set({ selectedDate: date }),
  getEventsBySocket: (stationId, socketId) =>
    get()
      .events.filter((event) => event.stationId === stationId && event.socketId === socketId)
      .sort((a, b) => b.timestamp - a.timestamp)
}));
