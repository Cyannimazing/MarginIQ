import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View, Modal, FlatList } from 'react-native';
import { CURRENCIES } from '../constants/currencies';
import { FlatList as GestureFlatList } from 'react-native-gesture-handler'; // optional, or regular
import { SafeAreaView } from 'react-native-safe-area-context';
import { PricingMethod } from '../features/settings/types';
import { useSettingsStore } from '../stores/settingsStore';
import { OptionChip } from '../components/ui/OptionChip';
import { useUIStore } from '../stores/uiStore';
import { Ionicons } from '@expo/vector-icons';
import { FormSection } from '../components/ui/FormSection';

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
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
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
    if (!query) return CURRENCIES;
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
      <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">
        <View style={{ height: 24 }} />
        <View className="pb-20">
          {!!error && (
            <View className="mb-6 rounded-[24px] bg-red-50 p-5 border border-red-100">
              <Text className="text-sm text-red-700 font-bold">{error}</Text>
            </View>
          )}

          <FormSection title="Business Profile" icon="business">
            <Text className="text-[10px] font-black text-brand-400 uppercase mb-2 tracking-[2px] px-1">Business Name</Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your Business Name"
              className="rounded-[24px] border border-brand-100 bg-white px-6 py-5 text-lg text-brand-950 font-black shadow-sm"
              placeholderTextColor="#cbd5e1"
            />
          </FormSection>

          <FormSection title="Currency Settings" icon="cash">
            <Text className="text-[10px] font-black text-brand-400 uppercase mb-2 tracking-[2px] px-1">Active Currency Profile</Text>

            <Pressable onPress={() => setIsCurrencyModalOpen(true)}>
              <View className="flex-row items-center justify-between rounded-[24px] border border-brand-100 bg-white px-6 py-5 shadow-sm mb-2">
                <Text className="text-lg text-brand-950 font-black">
                  {currencyCode}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-brand-500 uppercase tracking-widest">Change</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </View>
              </View>
            </Pressable>

          </FormSection>

          <FormSection title="Global Strategy Targets" icon="trending-up">
            <View className="gap-5">
              <View>
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Target Margin %</Text>
                <TextInput
                  value={marginInput}
                  onChangeText={setMarginInput}
                  keyboardType="numeric"
                  className="rounded-[24px] border border-brand-100 bg-white px-6 py-4 text-base text-brand-950 font-black shadow-sm"
                  placeholderTextColor="#cbd5e1"
                />
              </View>
              <View>
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Target Markup %</Text>
                <TextInput
                  value={markupInput}
                  onChangeText={setMarkupInput}
                  keyboardType="numeric"
                  className="rounded-[24px] border border-brand-100 bg-white px-6 py-4 text-base text-brand-950 font-black shadow-sm"
                  placeholderTextColor="#cbd5e1"
                />
              </View>
              <View>
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Target Fixed Profit ({settings.currencyCode})</Text>
                <TextInput
                  value={fixedProfitInput}
                  onChangeText={setFixedProfitInput}
                  keyboardType="decimal-pad"
                  className="rounded-[24px] border border-brand-100 bg-white px-6 py-4 text-base text-brand-950 font-black shadow-sm"
                  placeholderTextColor="#cbd5e1"
                />
              </View>
              <View className="mt-2">
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Default VAT %</Text>
                <TextInput
                  value={vatInput}
                  onChangeText={setVatInput}
                  keyboardType="numeric"
                  className="rounded-[24px] border border-brand-100 bg-white px-6 py-4 text-base text-brand-950 font-black shadow-sm"
                  placeholderTextColor="#cbd5e1"
                />
              </View>
            </View>
          </FormSection>

          <View className="mt-8">
            <Pressable
              onPress={handleSave}
              disabled={isLoading}
            >
              <View className={`h-16 items-center justify-center rounded-[32px] bg-brand-900 ${isLoading ? 'opacity-70' : ''}`}>
                <Text className="font-black text-white text-sm tracking-[2px] uppercase">
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </Text>
              </View>
            </Pressable>
          </View>

        </View>
      </ScrollView>

      {/* Currency Search Modal */}
      <Modal visible={isCurrencyModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsCurrencyModalOpen(false)}>
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-brand-50">
            <Text className="text-lg font-black text-brand-900 tracking-tight">Select Currency</Text>
            <Pressable onPress={() => setIsCurrencyModalOpen(false)} className="w-10 h-10 items-center justify-center">
              <Ionicons name="close" size={24} color="#14532d" />
            </Pressable>
          </View>

          <View className="px-6 py-4">
            <View className="flex-row items-center bg-brand-50/50 rounded-[24px] px-4 py-3 border border-brand-100 mb-2">
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                className="flex-1 ml-3 text-base text-brand-950 font-bold"
                placeholder="Search global currencies..."
                placeholderTextColor="#94a3b8"
                autoFocus
                value={currencyQuery}
                onChangeText={setCurrencyQuery}
              />
              {currencyQuery.length > 0 && (
                <Pressable onPress={() => setCurrencyQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#cbd5e1" />
                </Pressable>
              )}
            </View>
          </View>

          <FlatList
            data={filteredCurrencies}
            keyExtractor={(item) => item.code}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-6 pb-24 gap-2"
            renderItem={({ item }) => {
              const isActive = item.code === currencyCode;
              return (
                <Pressable onPress={() => { setCurrencyCode(item.code); setIsCurrencyModalOpen(false); }}>
                  <View className={`flex-row items-center px-5 py-4 rounded-[20px] border ${isActive ? 'bg-brand-50/50 border-brand-200' : 'bg-white border-slate-100'}`}>
                    <View className="w-10 h-10 rounded-full bg-brand-900/5 items-center justify-center mr-4 border border-brand-100">
                      <Text className="text-sm font-black text-brand-900">{item.symbol}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-black text-brand-950">{item.code}</Text>
                      <Text className="text-[11px] font-bold text-slate-500 tracking-wide mt-0.5" numberOfLines={1}>{item.name}</Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={24} color="#16a34a" />}
                  </View>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

    </View>
  );
}
