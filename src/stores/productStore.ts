import { create } from 'zustand';
import { 
  createProduct, 
  updateProductDetails, 
  deleteProduct, 
  listProducts, 
  listProductIngredientRows, 
  addProductIngredient, 
  bulkAddProductIngredients,
  createProductCostGroup,
  updateProductIngredient, 
  updateProductCostGroup,
  deleteProductCostGroup,
  removeProductIngredient,
  trashProduct,
  restoreProduct,
  listTrashProducts,
  listProductCostGroups,
  listProductSalePackages,
  createProductSalePackage,
  deleteProductSalePackage,
} from '../db/queries/products';
import {
  Product,
  ProductCostGroup,
  ProductSalePackage,
  ProductCostGroupInput,
  ProductInput,
  ProductIngredientRow,
  ProductIngredientInput,
  ProductPricingInput,
  ProductSalePackageInput,
} from '../features/products/types';

interface ProductState {
  products: Product[];
  costGroups: ProductCostGroup[];
  trashProducts: Product[];
  productIngredients: ProductIngredientRow[];
  productSalePackages: ProductSalePackage[];
  isLoading: boolean;
  error: string | null;
  loadProducts: () => Promise<void>;
  loadCostGroups: () => Promise<void>;
  loadTrashProducts: () => Promise<void>;
  addProduct: (input: ProductInput) => Promise<number>;
  addCostGroup: (input: ProductCostGroupInput) => Promise<number>;
  editCostGroup: (id: number, input: Partial<ProductCostGroupInput>) => Promise<void>;
  deleteCostGroup: (id: number) => Promise<void>;
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
  getProductSalePackages: (productId: number) => ProductSalePackage[];
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

  loadProductSalePackages: (productId: number) => Promise<void>;
  addProductSalePackage: (input: ProductSalePackageInput) => Promise<number>;
  deleteProductSalePackage: (id: number) => Promise<void>;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
};

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  costGroups: [],
  trashProducts: [],
  productIngredients: [],
  productSalePackages: [],
  isLoading: false,
  error: null,

  loadProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const [rows, groups] = await Promise.all([listProducts(), listProductCostGroups()]);
      set({
        products: [...rows] as Product[],
        costGroups: [...groups] as ProductCostGroup[],
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  loadCostGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      const groups = await listProductCostGroups();
      set({ costGroups: [...groups] as ProductCostGroup[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  addCostGroup: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const id = await createProductCostGroup(input);
      await get().loadCostGroups();
      return id;
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  editCostGroup: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      await updateProductCostGroup(id, input);
      await get().loadProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteCostGroup: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteProductCostGroup(id);
      await get().loadCostGroups();
      await get().loadProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
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

  getProductSalePackages: (productId) => {
    return get().productSalePackages.filter((p) => Number(p.productId) === Number(productId));
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

  loadProductSalePackages: async (productId) => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listProductSalePackages(productId);
      set({ productSalePackages: rows as ProductSalePackage[], isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },

  addProductSalePackage: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const id = await createProductSalePackage(input);
      await get().loadProductSalePackages(input.productId);
      return id;
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteProductSalePackage: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Best effort: delete, then reload packages for the product that owned it.
      const pkg = get().productSalePackages.find((p) => p.id === id);
      await deleteProductSalePackage(id);
      if (pkg) await get().loadProductSalePackages(pkg.productId);
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    } finally {
      set({ isLoading: false });
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
      
      // Auto-reset packaging quantity if no packaging items remain
      const remainingPkg = get().getProductIngredients(productId).filter(pi => pi.costType === 'packaging');
      if (remainingPkg.length === 0) {
        const product = get().products.find(p => p.id === productId);
        if (product && (product.unitsPerSale !== 1 || product.saleUnitLabel)) {
           await updateProductDetails(productId, { unitsPerSale: 1, saleUnitLabel: '' });
        }
      }
      
      await get().loadProducts();
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
    }
  },
}));
