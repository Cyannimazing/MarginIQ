import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CURRENCIES } from '../constants/currencies';
import { RootStackParamList } from '../navigation/types';
import { useSettingsStore } from '../stores/settingsStore';
import { OptionChip } from '../components/ui/OptionChip';
import { ActionModal } from '../components/ui/ActionModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const TOTAL_STEPS = 2;

export function OnboardingScreen({ navigation }: Props) {
  const settings = useSettingsStore((state) => state.settings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const isLoading = useSettingsStore((state) => state.isLoading);

  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState(settings.businessName === 'My Business' ? '' : settings.businessName);
  const [currencyCode, setCurrencyCode] = useState(settings.currencyCode);
  const [currencyQuery, setCurrencyQuery] = useState('');

  const [modalState, setModalState] = useState({
    visible: false,
    title: '',
    message: '',
  });

  const filteredCurrencies = useMemo(() => {
    const query = currencyQuery.trim().toLowerCase();
    if (!query) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        c.symbol.toLowerCase().includes(query),
    );
  }, [currencyQuery]);

  const handleNext = () => {
    if (step === 1) {
      if (!businessName.trim()) {
        setModalState({
          visible: true,
          title: 'Business Name Required',
          message: 'Please enter your business name to continue.',
        });
        return;
      }
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    try {
      await saveSettings({
        businessName: businessName.trim(),
        currencyCode,
        onboardingCompleted: true,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch {
      setModalState({
        visible: true,
        title: 'Save Failed',
        message: 'Unable to save your settings right now. Please try again.',
      });
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" keyboardShouldPersistTaps="handled">
      <View className="px-6 pb-12 pt-10">
        {/* Header */}
        <Text className="text-3xl font-bold text-slate-900">Welcome to</Text>
        <Text className="text-3xl font-bold text-brand-600">MarginIQ</Text>
        <Text className="mt-2 text-sm leading-5 text-slate-500">
          Let's get your business set up in just a couple of steps.
        </Text>

        {/* Step indicator */}
        <View className="mt-6 flex-row items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-brand-900' : 'bg-slate-200'}`}
            />
          ))}
        </View>
        <Text className="mt-1 text-xs text-slate-400">
          Step {step} of {TOTAL_STEPS}
        </Text>

        {/* Step 1 — Business Name */}
        {step === 1 && (
          <View className="mt-8">
            <Text className="text-xl font-bold text-slate-900">What's your business name?</Text>
            <Text className="mt-1 text-sm text-slate-500">
              This will appear on your dashboard and reports.
            </Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Maria's Bakery"
              autoFocus
              className="mt-5 rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
              returnKeyType="next"
              onSubmitEditing={handleNext}
            />
          </View>
        )}

        {/* Step 2 — Currency */}
        {step === 2 && (
          <View className="mt-8">
            <Text className="text-xl font-bold text-slate-900">Choose your currency</Text>
            <Text className="mt-1 text-sm text-slate-500">
              Used for all prices, costs, and reports.
            </Text>
            <TextInput
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder="Search by code, name, or symbol…"
              className="mt-5 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />

            <View className="mt-6 flex-row flex-wrap">
              {filteredCurrencies.slice(0, 30).map((currency) => (
                <OptionChip
                  key={currency.code}
                  label={`${currency.symbol} ${currency.code}`}
                  selected={currencyCode === currency.code}
                  onPress={() => setCurrencyCode(currency.code)}
                  size="sm"
                />
              ))}
              {!filteredCurrencies.length ? (
                <Text className="text-xs text-slate-500 font-bold ml-2">No currencies matched your search.</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Navigation buttons */}
        <View className="mt-10 gap-3">
          {step < TOTAL_STEPS ? (
            <Pressable
              onPress={handleNext}
            >
              <View className="items-center rounded-2xl bg-brand-900 py-4 shadow-lg">
                <Text className="font-black text-white uppercase tracking-widest text-sm">Next Page</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleFinish()}
              disabled={isLoading}
            >
              <View className={`items-center rounded-2xl bg-brand-900 py-4 shadow-lg ${isLoading ? 'opacity-70' : ''}`}>
                <Text className="font-black text-white uppercase tracking-widest text-sm">
                  {isLoading ? 'Saving...' : 'Complete Setup 🚀'}
                </Text>
              </View>
            </Pressable>
          )}

          {step > 1 && (
            <Pressable
              onPress={handleBack}
            >
              <View className="items-center rounded-2xl border border-slate-200 bg-white py-4">
                <Text className="font-black text-slate-400 uppercase tracking-widest text-sm">Previous Step</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>

      <ActionModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        onPrimaryAction={() => setModalState((s) => ({ ...s, visible: false }))}
      />
    </ScrollView>
  );
}
