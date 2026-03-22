import { create } from 'zustand';
import { DEFAULT_CURRENCY_CODE } from '../constants/currencies';
import { AppSettings, PricingMethod } from '../features/settings/types';
import { listSettings, upsertSettings } from '../db/queries/settings';

const SETTINGS_KEYS = {
  businessName: 'business_name',
  currencyCode: 'currency_code',
  defaultVatPercent: 'default_vat_percent',
  defaultVatEnabled: 'default_vat_enabled',
  defaultTargetMarginPercent: 'default_target_margin_percent',
  defaultTargetMarkupPercent: 'default_target_markup_percent',
  defaultTargetFixedProfitAmount: 'default_target_fixed_profit_amount',
  defaultPricingMethod: 'default_pricing_method',
  onboardingCompleted: 'onboarding_completed',
  lastSalesLogType: 'last_sales_log_type',
} as const;

const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'My Business',
  currencyCode: DEFAULT_CURRENCY_CODE,
  defaultVatPercent: 12,
  defaultVatEnabled: false,
  defaultTargetMarginPercent: 50,
  defaultTargetMarkupPercent: 30,
  defaultTargetFixedProfitAmount: 100,
  defaultPricingMethod: 'margin',
  onboardingCompleted: false,
  lastSalesLogType: 'daily',
};

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) {
    return fallback;
  }

  return value === 'true';
};

const parsePricingMethod = (
  value: string | undefined,
  fallback: PricingMethod,
): PricingMethod => {
  if (value === 'margin' || value === 'markup' || value === 'fixed') {
    return value;
  }

  return fallback;
};

type SettingsState = {
  settings: AppSettings;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unknown error occurred.';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isHydrated: false,
  isLoading: false,
  error: null,
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listSettings();
      const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

      const hydrated: AppSettings = {
        businessName:
          map[SETTINGS_KEYS.businessName]?.trim() || DEFAULT_SETTINGS.businessName,
        currencyCode:
          map[SETTINGS_KEYS.currencyCode] || DEFAULT_SETTINGS.currencyCode,
        defaultVatPercent: parseNumber(
          map[SETTINGS_KEYS.defaultVatPercent],
          DEFAULT_SETTINGS.defaultVatPercent,
        ),
        defaultVatEnabled: parseBoolean(
          map[SETTINGS_KEYS.defaultVatEnabled],
          DEFAULT_SETTINGS.defaultVatEnabled,
        ),
        defaultTargetMarginPercent: parseNumber(
          map[SETTINGS_KEYS.defaultTargetMarginPercent],
          DEFAULT_SETTINGS.defaultTargetMarginPercent,
        ),
        defaultTargetMarkupPercent: parseNumber(
          map[SETTINGS_KEYS.defaultTargetMarkupPercent],
          DEFAULT_SETTINGS.defaultTargetMarkupPercent,
        ),
        defaultTargetFixedProfitAmount: parseNumber(
          map[SETTINGS_KEYS.defaultTargetFixedProfitAmount],
          DEFAULT_SETTINGS.defaultTargetFixedProfitAmount,
        ),
        defaultPricingMethod: parsePricingMethod(
          map[SETTINGS_KEYS.defaultPricingMethod],
          DEFAULT_SETTINGS.defaultPricingMethod,
        ),
        onboardingCompleted: parseBoolean(
          map[SETTINGS_KEYS.onboardingCompleted],
          DEFAULT_SETTINGS.onboardingCompleted,
        ),
        lastSalesLogType: (map[SETTINGS_KEYS.lastSalesLogType] as any) || DEFAULT_SETTINGS.lastSalesLogType,
      };

      set({ settings: hydrated, isLoading: false, isHydrated: true });
    } catch (error) {
      set({
        isLoading: false,
        isHydrated: true,
        error: getErrorMessage(error),
      });
    }
  },
  saveSettings: async (partial) => {
    const nextSettings = { ...get().settings, ...partial };
    set({ isLoading: true, error: null, settings: nextSettings });

    try {
      await upsertSettings({
        [SETTINGS_KEYS.businessName]: nextSettings.businessName,
        [SETTINGS_KEYS.currencyCode]: nextSettings.currencyCode,
        [SETTINGS_KEYS.defaultVatPercent]: String(nextSettings.defaultVatPercent),
        [SETTINGS_KEYS.defaultVatEnabled]: String(nextSettings.defaultVatEnabled),
        [SETTINGS_KEYS.defaultTargetMarginPercent]: String(
          nextSettings.defaultTargetMarginPercent,
        ),
        [SETTINGS_KEYS.defaultTargetMarkupPercent]: String(
          nextSettings.defaultTargetMarkupPercent,
        ),
        [SETTINGS_KEYS.defaultTargetFixedProfitAmount]: String(
          nextSettings.defaultTargetFixedProfitAmount,
        ),
        [SETTINGS_KEYS.defaultPricingMethod]: nextSettings.defaultPricingMethod,
        [SETTINGS_KEYS.onboardingCompleted]: String(nextSettings.onboardingCompleted),
        [SETTINGS_KEYS.lastSalesLogType]: nextSettings.lastSalesLogType,
      });

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },
}));
