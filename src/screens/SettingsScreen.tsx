import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CURRENCIES } from '../constants/currencies';
import { PricingMethod } from '../features/settings/types';
import { useSettingsStore } from '../stores/settingsStore';
import { OptionChip } from '../components/ui/OptionChip';
import { useUIStore } from '../stores/uiStore';
import { Ionicons } from '@expo/vector-icons';

const PRICING_METHODS: Array<{ key: PricingMethod; label: string }> = [
  { key: 'margin', label: 'Margin %' },
  { key: 'markup', label: 'Markup %' },
  { key: 'fixed', label: 'Fixed Profit' },
];

const parsePercent = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

export function SettingsScreen() {
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const isLoading = useSettingsStore((state) => state.isLoading);
  const error = useSettingsStore((state) => state.error);
  const setSidebarOpen = (open: boolean) => useUIStore.getState().setSidebarOpen(open);

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [currencyCode, setCurrencyCode] = useState(settings.currencyCode);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [vatInput, setVatInput] = useState(String(settings.defaultVatPercent));
  const [marginInput, setMarginInput] = useState(String(settings.defaultTargetMarginPercent));
  const [markupInput, setMarkupInput] = useState(String(settings.defaultTargetMarkupPercent));
  const [fixedProfitInput, setFixedProfitInput] = useState(String(settings.defaultTargetFixedProfitAmount));
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(
    settings.defaultPricingMethod,
  );

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setBusinessName(settings.businessName);
    setCurrencyCode(settings.currencyCode);
    setVatInput(String(settings.defaultVatPercent));
    setMarginInput(String(settings.defaultTargetMarginPercent));
    setMarkupInput(String(settings.defaultTargetMarkupPercent));
    setFixedProfitInput(String(settings.defaultTargetFixedProfitAmount));
    setPricingMethod(settings.defaultPricingMethod);
  }, [
    settings.businessName,
    settings.currencyCode,
    settings.defaultPricingMethod,
    settings.defaultTargetMarginPercent,
    settings.defaultTargetMarkupPercent,
    settings.defaultTargetFixedProfitAmount,
    settings.defaultVatPercent,
  ]);

  const filteredCurrencies = useMemo(() => {
    const query = currencyQuery.trim().toLowerCase();
    if (!query) {
      return CURRENCIES;
    }

    return CURRENCIES.filter((currency) => {
      return (
        currency.code.toLowerCase().includes(query) ||
        currency.name.toLowerCase().includes(query) ||
        currency.symbol.toLowerCase().includes(query)
      );
    });
  }, [currencyQuery]);

  const handleSave = async () => {
    const trimmedName = businessName.trim();
    if (!trimmedName) {
      Alert.alert('Business Name Required', 'Please enter your business name.');
      return;
    }

    const vat = parsePercent(vatInput);
    if (vat === null || vat < 0 || vat > 100) {
      Alert.alert('Invalid VAT', 'VAT must be between 0 and 100.');
      return;
    }

    const margin = parsePercent(marginInput);
    if (margin === null || margin < 0 || margin >= 100) {
      Alert.alert('Invalid Margin', 'Default margin must be from 0 to less than 100.');
      return;
    }

    const markup = parsePercent(markupInput);
    if (markup === null || markup < 0) {
      Alert.alert('Invalid Markup', 'Default markup must be 0 or greater.');
      return;
    }

    const fixedProfit = parsePercent(fixedProfitInput);
    if (fixedProfit === null || fixedProfit < 0) {
      Alert.alert('Invalid Profit', 'Default fixed profit must be 0 or greater.');
      return;
    }

    try {
      await saveSettings({
        businessName: trimmedName,
        currencyCode,
        defaultVatPercent: vat,
        defaultTargetMarginPercent: margin,
        defaultTargetMarkupPercent: markup,
        defaultTargetFixedProfitAmount: fixedProfit,
        defaultPricingMethod: pricingMethod,
      });
      Alert.alert('Success', 'Settings saved successfully.');
    } catch {
      Alert.alert('Save Failed', 'Unable to save settings. Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View style={{ height: 24 }} />
        <View className="px-6 pb-12">
          {!!error && (
            <View className="mb-6 rounded-2xl bg-red-50 p-4 border border-red-100">
              <Text className="text-sm text-red-700 font-bold">{error}</Text>
            </View>
          )}

          {/* Business Profile */}
          <SectionTitle>Business Profile</SectionTitle>
          <View className="mb-8">
            <Label>Business Name</Label>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your Business Name"
              className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-950 font-bold"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* Currency Selection */}
          <SectionTitle>Currency</SectionTitle>
          <View className="mb-6">
            <Label>Selected: {currencyCode}</Label>
            <TextInput
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder="Search currency..."
              className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950"
              placeholderTextColor="#94a3b8"
            />

            <View className="mt-4 flex-row flex-wrap gap-2">
              {filteredCurrencies.slice(0, 15).map((currency) => (
                <OptionChip
                  key={currency.code}
                  label={`${currency.symbol} ${currency.code}`}
                  selected={currencyCode === currency.code}
                  onPress={() => setCurrencyCode(currency.code)}
                  size="sm"
                />
              ))}
            </View>
          </View>

          <SectionTitle>Global Strategy Targets</SectionTitle>
          <View className="mb-8 p-6 rounded-3xl bg-brand-50/30 border border-brand-100">

            <View className="mt-8">
               <Label>Set Global Targets</Label>
               <View className="gap-4 mt-3">
                  <View>
                    <Text className="text-[10px] font-black text-brand-600 uppercase mb-1 tracking-widest">Target Margin %</Text>
                    <TextInput
                      value={marginInput}
                      onChangeText={setMarginInput}
                      keyboardType="numeric"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-950 font-bold"
                    />
                  </View>
                  <View>
                    <Text className="text-[10px] font-black text-brand-600 uppercase mb-1 tracking-widest">Target Markup %</Text>
                    <TextInput
                      value={markupInput}
                      onChangeText={setMarkupInput}
                      keyboardType="numeric"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-950 font-bold"
                    />
                  </View>
                  <View>
                    <Text className="text-[10px] font-black text-brand-600 uppercase mb-1 tracking-widest">Target Fixed Profit ({settings.currencyCode})</Text>
                    <TextInput
                      value={fixedProfitInput}
                      onChangeText={setFixedProfitInput}
                      keyboardType="decimal-pad"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-950 font-bold"
                    />
                  </View>
               </View>
            </View>

            <View className="mt-6">
              <Label>Default VAT %</Label>
              <TextInput
                value={vatInput}
                onChangeText={setVatInput}
                keyboardType="numeric"
                className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-950 font-bold"
              />
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={isLoading}
          >
            <View className={`items-center rounded-2xl bg-brand-900 py-4 shadow-lg ${isLoading ? 'opacity-70' : ''}`}>
              <Text className="text-base font-black text-white uppercase tracking-widest">
                {isLoading ? 'Saving...' : 'Save All Settings'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-4 text-xs font-black text-brand-900 uppercase tracking-widest">
      {children}
    </Text>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm font-bold text-slate-600">{children}</Text>;
}
