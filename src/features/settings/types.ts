export type PricingMethod = 'margin' | 'markup' | 'fixed';

export type AppSettings = {
  businessName: string;
  currencyCode: string;
  defaultVatPercent: number;
  defaultVatEnabled: boolean;
  defaultDiscountPercent: number;
  defaultTargetMarginPercent: number;
  defaultTargetMarkupPercent: number;
  defaultTargetFixedProfitAmount: number;
  defaultPricingMethod: PricingMethod;
  onboardingCompleted: boolean;
  lastSalesLogType: 'daily' | 'weekly' | 'monthly';
  lastSalesInputType: 'Sold' | 'Discounted' | 'Unsold';
};
