import { create } from 'zustand';
import { 
  createProduct, 
  updateProductDetails, 
  deleteProduct, 
  listProducts, 
  listProductIngredientRows, 
  addProductIngredient, 
  bulkAddProductIngredients,
  updateProductIngredient, 
  removeProductIngredient,
  trashProduct,
  restoreProduct,
  listTrashProducts
} from '../db/queries/products';
import { Product, ProductInput, ProductIngredientRow, ProductIngredientInput, ProductPricingInput } from '../features/products/types';

interface ProductState {
  products: Product[];
  trashProducts: Product[];
  productIngredients: ProductIngredientRow[];
  isLoading: boolean;
  error: string | null;
  loadProducts: () => Promise<void>;
  loadTrashProducts: () => Promise<void>;
  addProduct: (input: ProductInput) => Promise<number>;
  editProduct: (id: number, input: Partial<ProductInput>) => Promise<void>;
  updateProductPricing: (id: number, input: ProductPricingInput) => Promise<void>;
  trashProduct: (id: number) => Promise<void>;
  restoreProduct: (id: number) => Promise<void>;
  removeProduct: (id: number) => Promise<void>; // Permanent delete
  togglePin: (id: number) => Promise<void>;
  updateColor: (id: number, color: string) => Promise<void>;
  toggleArchive: (id: number) => Promise<void>;
  
  // Selectors
  getProductById: (id: number) => Product | undefined;
  getProductIngredients: (productId: number) => ProductIngredientRow[];
  getProductCostBreakdown: (productId: number) => any;
  
  clearProductIngredients: () => void;
  loadProductIngredients: (productId: number) => Promise<void>;
  addIngredientToProduct: (input: ProductIngredientInput) => Promise<void>;
  bulkAddIngredientsToProduct: (inputs: ProductIngredientInput[]) => Promise<void>;
  editProductIngredient: (
    productId: number,
    rowId: number,
    input: Partial<ProductIngredientInput>
  ) => Promise<void>;
  removeIngredientFromProduct: (productId: number, rowId: number) => Promise<void>;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
};

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  trashProducts: [],
  productIngredients: [],
  isLoading: false,
  error: null,

  loadProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listProducts();
      set({ products: [...rows] as Product[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  loadTrashProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listTrashProducts();
      set({ trashProducts: [...rows] as Product[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  addProduct: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const id = await createProduct(input);
      await get().loadProducts();
      return id;
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  editProduct: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      await updateProductDetails(id, input);
      await get().loadProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  updateProductPricing: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      await updateProductDetails(id, input as any);
      await get().loadProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  trashProduct: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await trashProduct(id);
      await get().loadProducts();
      await get().loadTrashProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  restoreProduct: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await restoreProduct(id);
      await get().loadProducts();
      await get().loadTrashProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  removeProduct: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteProduct(id);
      await get().loadProducts();
      await get().loadTrashProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  togglePin: async (id: number) => {
    const productId = Number(id);
    const product = get().products.find((p) => Number(p.id) == productId);
    if (!product) return;
    await get().editProduct(productId, { isPinned: !product.isPinned });
  },

  updateColor: async (id: number, color: string) => {
    await get().editProduct(Number(id), { color });
  },

  toggleArchive: async (id: number) => {
    const productId = Number(id);
    const product = get().products.find((p) => Number(p.id) == productId);
    if (!product) return;
    await get().editProduct(productId, { isArchived: !product.isArchived });
  },

  getProductById: (id) => {
    return get().products.find((p) => p.id === id) || get().trashProducts.find((p) => p.id === id);
  },

  getProductIngredients: (productId) => {
    return get().productIngredients.filter(pi => Number(pi.productId) === Number(productId));
  },

  getProductCostBreakdown: (productId) => {
    const product = get().getProductById(productId);
    if (!product) return { baseCost: 0, packaging: 0, overhead: 0, totalDirect: 0 };
    return { baseCost: product.baseCost, packaging: 0, overhead: 0, totalDirect: product.baseCost };
  },

  clearProductIngredients: () => {
    set({ productIngredients: [] });
  },

  loadProductIngredients: async (productId) => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listProductIngredientRows(productId);
      set({ productIngredients: rows as ProductIngredientRow[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  addIngredientToProduct: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await addProductIngredient(input);
      await get().loadProductIngredients(input.productId);
      await get().loadProducts(); 
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  bulkAddIngredientsToProduct: async (inputs) => {
    if (inputs.length === 0) return;
    set({ isLoading: true, error: null });
    try {
      await bulkAddProductIngredients(inputs);
      await get().loadProductIngredients(inputs[0].productId);
      await get().loadProducts(); 
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  editProductIngredient: async (productId, rowId, input) => {
    set({ isLoading: true, error: null });
    try {
      await updateProductIngredient(rowId, productId, input as any);
      await get().loadProductIngredients(productId);
      await get().loadProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  removeIngredientFromProduct: async (productId, rowId) => {
    set({ isLoading: true, error: null });
    try {
      await removeProductIngredient(rowId, productId);
      await get().loadProductIngredients(productId);
      await get().loadProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },
}));
