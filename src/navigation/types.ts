export type RootStackParamList = {
  Onboarding: undefined;
  Dashboard: undefined;
  IngredientForm: { 
    productId?: number; 
    ingredientId?: number; 
    prefillClassification?: 'measurable' | 'fixed';
    prefillTag?: string;
  };
  ProductList: undefined;
  ProductForm: { productId?: number } | undefined;
  ProductDetail: { productId: number };
  Trash: undefined;
  ProductAddIngredient: {
    productId: number;
    editLinkId?: number;
    initialIngredientId?: number;
    initialQuantity?: string;
    initialCostType?: string;
    initialItems?: { linkId: number; ingredientId: number; quantityUsed: string }[];
  };
  SalesLogger: { productId?: number } | undefined;
  Analytics: undefined;
  Reports: undefined;
  Settings: undefined;
  /** Itemized monthly overhead → summed into product or cost group total */
  MonthlyOverheadBreakdown:
    | { target: 'product'; productId: number; costGroupId?: undefined }
    | { target: 'costGroup'; costGroupId: number; productId?: undefined };
  ResourcesLibrary: { productId?: number } | undefined;
};

