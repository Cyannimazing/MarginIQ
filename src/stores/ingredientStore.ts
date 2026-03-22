import { create } from 'zustand';
import {
  addIngredient,
  deleteIngredient,
  listIngredients,
  updateIngredient,
} from '../db/queries/ingredients';
import { Ingredient, IngredientInput } from '../features/ingredients/types';

type IngredientState = {
  ingredients: Ingredient[];
  isLoading: boolean;
  error: string | null;
  loadIngredients: (productId?: number) => Promise<void>;
  addIngredient: (input: IngredientInput) => Promise<void>;
  editIngredient: (productId: number | undefined, id: number, input: IngredientInput) => Promise<void>;
  removeIngredient: (productId: number | undefined, id: number) => Promise<void>;
  getIngredientById: (id: number) => Ingredient | undefined;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unknown error occurred.';

export const useIngredientStore = create<IngredientState>((set, get) => ({
  ingredients: [],
  isLoading: false,
  error: null,
  loadIngredients: async (productId) => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listIngredients(productId);
      set({ ingredients: rows as Ingredient[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },
  addIngredient: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await addIngredient(input);
      const rows = await listIngredients(input.productId);
      set({ ingredients: rows as Ingredient[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
  editIngredient: async (productId, id, input) => {
    set({ isLoading: true, error: null });
    try {
      await updateIngredient(id, input);
      const rows = await listIngredients(productId);
      set({ ingredients: rows as Ingredient[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
  removeIngredient: async (productId, id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteIngredient(id);
      const rows = await listIngredients(productId);
      set({ ingredients: rows as Ingredient[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
  getIngredientById: (id) => get().ingredients.find((item) => item.id === id),
}));
