import { create } from 'zustand';
import {
  deleteMonthlyGoal,
  listMonthlyGoals,
  upsertMonthlyGoal,
} from '../db/queries/goals';
import { MonthlyGoal, MonthlyGoalInput } from '../features/goals/types';

type GoalState = {
  monthlyGoals: MonthlyGoal[];
  isLoading: boolean;
  error: string | null;
  loadMonthlyGoals: () => Promise<void>;
  saveMonthlyGoal: (input: MonthlyGoalInput) => Promise<void>;
  removeMonthlyGoal: (id: number) => Promise<void>;
  getMonthlyGoal: (month: string) => MonthlyGoal | undefined;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unknown error occurred.';

export const useGoalStore = create<GoalState>((set, get) => ({
  monthlyGoals: [],
  isLoading: false,
  error: null,
  loadMonthlyGoals: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listMonthlyGoals();
      set({ monthlyGoals: rows, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },
  saveMonthlyGoal: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await upsertMonthlyGoal(input);
      const rows = await listMonthlyGoals();
      set({ monthlyGoals: rows, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
  removeMonthlyGoal: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteMonthlyGoal(id);
      const rows = await listMonthlyGoals();
      set({ monthlyGoals: rows, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
  getMonthlyGoal: (month) =>
    get().monthlyGoals.find((item) => item.month === month.trim()),
}));
