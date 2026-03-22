export type PricingMethod = 'margin' | 'markup' | 'fixed';

export type AppSettings = {
  businessName: string;
  currencyCode: string;
  defaultVatPercent: number;
  defaultVatEnabled: boolean;
  defaultTargetMarginPercent: number;
  defaultTargetMarkupPercent: number;
  defaultTargetFixedProfitAmount: number;
  defaultPricingMethod: PricingMethod;
  onboardingCompleted: boolean;
  lastSalesLogType: 'daily' | 'weekly' | 'monthly';
};
