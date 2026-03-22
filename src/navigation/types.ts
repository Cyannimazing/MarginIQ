export type RootStackParamList = {
  Onboarding: undefined;
  Dashboard: undefined;
  IngredientLibrary: undefined;
  IngredientForm: { productId?: number; ingredientId?: number };
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
};

