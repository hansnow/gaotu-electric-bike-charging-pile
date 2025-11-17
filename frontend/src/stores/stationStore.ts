import { create } from 'zustand';
import type { StationSummary } from '@/types';
import { stationService } from '@/services/stationService';

interface StationState {
  stations: StationSummary[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  fetchStations: () => Promise<void>;
}

export const useStationStore = create<StationState>((set) => ({
  stations: [],
  loading: false,
  error: null,
  lastUpdated: null,
  fetchStations: async () => {
    set({ loading: true, error: null });
    try {
      const stations = await stationService.fetchStations();
      set({
        stations,
        loading: false,
        error: null,
        lastUpdated: Date.now()
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}));
