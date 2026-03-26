import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CURRENCIES } from '../constants/currencies';
import { RootStackParamList } from '../navigation/types';
import { useSettingsStore } from '../stores/settingsStore';
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
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);

  const [modalState, setModalState] = useState({ visible: false, title: '', message: '' });

  const selectedCurrency = useMemo(() => CURRENCIES.find((c) => c.code === currencyCode), [currencyCode]);

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
    if (!businessName.trim()) {
      setModalState({ visible: true, title: 'Business Name Required', message: 'Please enter your business name to continue.' });
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    try {
      await saveSettings({ businessName: businessName.trim(), currencyCode, onboardingCompleted: true });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch {
      setModalState({ visible: true, title: 'Save Failed', message: 'Unable to save your settings. Please try again.' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ backgroundColor: '#14532d', paddingHorizontal: 28, paddingTop: 32, paddingBottom: 36 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Image
            source={require('../../assets/BLACK-LOGO.png')}
            style={{ width: 36, height: 36, tintColor: '#ffffff' }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 }}>MarginIQ</Text>
        </View>
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5, lineHeight: 32 }}>
          {step === 1 ? "Let's set up\nyour business" : 'Choose your\ncurrency'}
        </Text>
        <Text style={{ fontSize: 13, color: '#86efac', marginTop: 8, fontWeight: '500' }}>
          {step === 1 ? 'Step 1 of 2 — Business identity' : 'Step 2 of 2 — Financial settings'}
        </Text>

        {/* Step bar */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 20 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 4,
                backgroundColor: i < step ? '#ffffff' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </View>
      </View>

      {/* Body */}
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        {step === 1 && (
          <>
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#14532d', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, opacity: 0.6 }}>
              Business Name
            </Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Maria's Bakery"
              autoFocus
              placeholderTextColor="#94a3b8"
              returnKeyType="done"
              onSubmitEditing={handleNext}
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#dcfce7',
                backgroundColor: '#f0fdf4',
                paddingHorizontal: 20,
                paddingVertical: 18,
                fontSize: 18,
                fontWeight: '800',
                color: '#14532d',
              }}
            />
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, fontWeight: '500' }}>
              This appears on your dashboard and reports.
            </Text>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#14532d', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, opacity: 0.6 }}>
              Active Currency
            </Text>
            <Pressable onPress={() => setIsCurrencyModalOpen(true)}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#dcfce7',
                backgroundColor: '#f0fdf4',
                paddingHorizontal: 20,
                paddingVertical: 16,
              }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#14532d', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#ffffff' }}>{selectedCurrency?.symbol ?? '$'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: '#14532d' }}>{currencyCode}</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '500' }} numberOfLines={1}>
                    {selectedCurrency?.name ?? 'Select a currency'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#14532d" />
              </View>
            </Pressable>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, fontWeight: '500' }}>
              Used for all prices, costs, and reports. You can change this later.
            </Text>
          </>
        )}
      </View>

      {/* Footer buttons */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 12 }}>
        {step < TOTAL_STEPS ? (
          <Pressable onPress={handleNext}>
            <View style={{ height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#14532d' }}>
              <Text style={{ fontWeight: '900', color: '#ffffff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Continue</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={() => void handleFinish()} disabled={isLoading}>
            <View style={{ height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#14532d', opacity: isLoading ? 0.7 : 1 }}>
              <Text style={{ fontWeight: '900', color: '#ffffff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>
                {isLoading ? 'Setting up...' : 'Launch MarginIQ'}
              </Text>
            </View>
          </Pressable>
        )}

        {step > 1 && (
          <Pressable onPress={() => setStep(step - 1)}>
            <View style={{ height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 1, borderColor: '#dcfce7', backgroundColor: '#f0fdf4' }}>
              <Text style={{ fontWeight: '900', color: '#14532d', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 }}>Back</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Currency picker modal — same as Business Profile */}
      <Modal visible={isCurrencyModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsCurrencyModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'bottom']}>
          <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f0fdf4' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#14532d' }}>Select Currency</Text>
            <Pressable onPress={() => setIsCurrencyModalOpen(false)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color="#14532d" />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#dcfce7' }}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                style={{ flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: '#14532d' }}
                placeholder="Search currencies..."
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
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 8 }}
            renderItem={({ item }) => {
              const isActive = item.code === currencyCode;
              return (
                <Pressable onPress={() => { setCurrencyCode(item.code); setIsCurrencyModalOpen(false); }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    borderRadius: 20,
                    borderWidth: 1,
                    backgroundColor: isActive ? '#f0fdf4' : '#ffffff',
                    borderColor: isActive ? '#bbf7d0' : '#f1f5f9',
                  }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#14532d10', alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: '#dcfce7' }}>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: '#14532d' }}>{item.symbol}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: '#14532d' }}>{item.code}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 2 }} numberOfLines={1}>{item.name}</Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={24} color="#16a34a" />}
                  </View>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <ActionModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        onPrimaryAction={() => setModalState((s) => ({ ...s, visible: false }))}
      />
    </SafeAreaView>
  );
}
