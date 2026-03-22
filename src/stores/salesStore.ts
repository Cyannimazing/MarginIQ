import { create } from 'zustand';
import {
  deleteMonthlySale,
  listMonthlySales,
  upsertMonthlySale,
} from '../db/queries/sales';
import { MonthlySale, MonthlySaleInput } from '../features/sales/types';

type SalesState = {
  monthlySales: MonthlySale[];
  isLoading: boolean;
  error: string | null;
  loadMonthlySales: () => Promise<void>;
  saveMonthlySale: (input: MonthlySaleInput) => Promise<void>;
  removeMonthlySale: (id: number) => Promise<void>;
  getMonthlySale: (productId: number, month: string) => MonthlySale | undefined;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unknown error occurred.';

export const useSalesStore = create<SalesState>((set, get) => ({
  monthlySales: [],
  isLoading: false,
  error: null,
  loadMonthlySales: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listMonthlySales();
      set({ monthlySales: rows, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },
  saveMonthlySale: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await upsertMonthlySale(input);
      const rows = await listMonthlySales();
      set({ monthlySales: rows, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
  removeMonthlySale: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteMonthlySale(id);
      const rows = await listMonthlySales();
      set({ monthlySales: rows, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
  getMonthlySale: (productId, month) =>
    get().monthlySales.find(
      (entry) => entry.productId === productId && entry.month === month,
    ),
}));
