import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRODUCT_CATEGORIES, COST_TYPES } from '../constants/productCategories';
import { ProductCategory } from '../features/products/types';
import { PricingMethod } from '../features/settings/types';
import { RootStackParamList } from '../navigation/types';
import { useProductStore } from '../stores/productStore';
import { useSettingsStore } from '../stores/settingsStore';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductForm'>;

const PRICING_METHODS: Array<{ key: PricingMethod; label: string; description: string }> = [
  { key: 'margin', label: 'Margin %', description: 'Profit as a % of selling price' },
  { key: 'markup', label: 'Markup %', description: 'Profit as a % of cost price' },
  { key: 'fixed', label: 'Fixed Batch Profit', description: 'Set a target total profit for the whole batch' },
];

const TOTAL_STEPS = 3;

export function ProductFormScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const initialProductId = route.params?.productId;
  
  const products = useProductStore((state) => state.products);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const addProduct = useProductStore((state) => state.addProduct);
  const editProduct = useProductStore((state) => state.editProduct);
  const settings = useSettingsStore((state) => state.settings);

  const existingProduct = useMemo(
    () => (initialProductId ? products.find((item) => Number(item.id) === Number(initialProductId)) : undefined),
    [products, initialProductId],
  );

  const currencyCode = settings.currencyCode;

  // Step state
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1 — Basic Info
  const [name, setName] = useState(existingProduct?.name ?? '');
  const [category, setCategory] = useState<ProductCategory>(
    (existingProduct?.category as ProductCategory) ?? 'Beverages',
  );

  // Step 2 — Cost Setup
  const [batchSize, setBatchSize] = useState(String(existingProduct?.batchSize ?? 1));
  const [baseCost, setBaseCost] = useState(String(existingProduct?.baseCost ?? 0));
  const [monthlyOverhead, setMonthlyOverhead] = useState(String(existingProduct?.monthlyOverhead ?? 0));
  const [hasVat, setHasVat] = useState(
    existingProduct ? existingProduct.vatPercent > 0 : !!settings.defaultVatEnabled,
  );
  const [vatPercent, setVatPercent] = useState(
    String(existingProduct ? (existingProduct.vatPercent * 100).toFixed(2) : (settings.defaultVatPercent ?? 0)),
  );

  // Step 3 — Pricing Method
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(
    (existingProduct?.pricingMethod as PricingMethod) ?? (settings.defaultPricingMethod as PricingMethod) ?? 'margin',
  );
  const [pricingValue, setPricingValue] = useState(
    String(
      existingProduct
        ? (existingProduct.pricingMethod === 'fixed'
            ? existingProduct.targetMargin.toFixed(2)
            : (existingProduct.targetMargin * 100).toFixed(2))
        : (settings.defaultPricingMethod === 'margin' 
            ? settings.defaultTargetMarginPercent 
            : settings.defaultPricingMethod === 'markup'
              ? settings.defaultTargetMarkupPercent
              : settings.defaultTargetFixedProfitAmount),
    ),
  );

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // Sync pricing defaults from Business Profile once settings load (they're async)
  useEffect(() => {
    if (!initialProductId && settings.defaultPricingMethod) {
      const method = settings.defaultPricingMethod as PricingMethod;
      const value = method === 'margin'
        ? settings.defaultTargetMarginPercent
        : method === 'markup'
          ? settings.defaultTargetMarkupPercent
          : settings.defaultTargetFixedProfitAmount;
      setPricingMethod(method);
      if (value !== undefined && value !== null) {
        setPricingValue(String(value));
      }
      
      // Also sync VAT defaults
      if (settings.defaultVatEnabled !== undefined) {
        setHasVat(settings.defaultVatEnabled);
      }
      if (settings.defaultVatPercent !== undefined) {
        setVatPercent(String(settings.defaultVatPercent));
      }
    }
  }, [
    settings.defaultPricingMethod, 
    settings.defaultTargetMarginPercent, 
    settings.defaultTargetMarkupPercent, 
    settings.defaultTargetFixedProfitAmount,
    settings.defaultVatEnabled,
    settings.defaultVatPercent
  ]);

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert('Required', 'Please enter a product name.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      const bs = Number(batchSize);
      if (!Number.isInteger(bs) || bs <= 0) {
        Alert.alert('Invalid Batch Size', 'Batch size must be a whole number greater than 0.');
        return false;
      }
      const val = Number(baseCost);
      if (!Number.isFinite(val) || val < 0) {
        Alert.alert('Invalid Cost', 'Direct/Base Cost must be 0 or greater.');
        return false;
      }
      if (hasVat) {
        const vat = Number(vatPercent);
        if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
          Alert.alert('Invalid VAT', 'VAT must be between 0 and 100.');
          return false;
        }
      }
      return true;
    }
    if (step === 3) {
      const val = Number(pricingValue);
      if (!Number.isFinite(val) || val < 0) {
        Alert.alert('Invalid Value', 'Please enter a valid pricing value (0 or greater).');
        return false;
      }
      if ((pricingMethod === 'margin' || pricingMethod === 'markup') && val >= 100) {
        Alert.alert('Invalid Value', 'Margin/Markup % must be less than 100.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSave = async () => {
    const pricingVal = Number(pricingValue);
    const targetMargin = (pricingMethod === 'margin' || pricingMethod === 'markup')
      ? pricingVal / 100
      : pricingVal;

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        batchSize: Number(batchSize),
        baseCost: Number(baseCost),
        targetMargin,
        sellingPrice: existingProduct?.sellingPrice ?? 0, 
        vatPercent: hasVat ? Number(vatPercent) / 100 : 0,
        pricingMethod,
        monthlyGoalProfit: existingProduct?.monthlyGoalProfit ?? 0,
        monthlyOverhead: Number(monthlyOverhead) || 0,
      };

      if (initialProductId) {
        await editProduct(initialProductId, payload);
      } else {
        await addProduct(payload);
      }
      
      if (hasVat !== settings.defaultVatEnabled) {
        useSettingsStore.getState().saveSettings({ defaultVatEnabled: hasVat }).catch(console.error);
      }
      const newMarginPercent = Number(pricingValue);
      if (
        pricingMethod !== settings.defaultPricingMethod ||
        newMarginPercent !== settings.defaultTargetMarginPercent
      ) {
        useSettingsStore.getState().saveSettings({
          defaultPricingMethod: pricingMethod,
          defaultTargetMarginPercent: newMarginPercent,
        }).catch(console.error);
      }
      
      navigation.goBack();
    } catch {
      Alert.alert('Save Failed', 'Unable to save product.');
    } finally {
      setIsSaving(false);
    }
  };

  const stepLabels = ['Identity', 'Production', 'Strategy'];

  return (
    <View className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View style={{ height: 24 }} />

        <View className="px-4 pb-12 pt-2">
        
        {/* Step Indicator */}
        <View className="flex-row gap-2 mb-10">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isCompleted = stepNum < step || !!initialProductId;

            return (
              <Pressable
                key={label}
                onPress={() => {
                   if (isActive) return;
                   if (initialProductId || stepNum < step) {
                     if (validateStep()) setStep(stepNum);
                   }
                }}
                className="flex-1"
              >
                <View className={`items-center justify-center rounded-[32px] py-4 px-1 border-2 ${
                  isActive ? 'border-brand-600 bg-brand-50' : isCompleted ? 'border-brand-200 bg-white' : 'border-brand-50/50 bg-brand-50/20'
                }`}>
                  <View className={`h-1.5 w-1.5 rounded-full mb-1 ${isActive ? 'bg-brand-600' : isCompleted ? 'bg-brand-400' : 'bg-brand-100'}`} />
                  <Text className={`text-[10px] font-black uppercase tracking-widest ${
                    isActive ? 'text-brand-800' : isCompleted ? 'text-brand-600' : 'text-brand-400'
                  }`}>
                     {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── STEP 1: Basic Info ── */}
        {step === 1 && (
          <View>
            <FormSection title="Product Identity" icon="leaf">
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest">Product Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Signature Blend"
                  className="rounded-[32px] border border-brand-100 bg-brand-50/50 px-5 py-4 text-base font-bold text-brand-900 mb-6"
                  placeholderTextColor="#adb5bd"
                />
                
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-3 tracking-widest">Select Category</Text>
                <View className="flex-row flex-wrap gap-2">
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <OptionChip
                      key={cat}
                      label={cat}
                      selected={category === cat}
                      onPress={() => setCategory(cat)}
                    />
                  ))}
                </View>
            </FormSection>
          </View>
        )}

        {/* ── STEP 2: Cost Setup ── */}
        {step === 2 && (
          <View>
            <FormSection title="Production Parameters" icon="cube">
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-[10px] font-black text-brand-800 uppercase mb-2 tracking-widest">Batch Units</Text>
                    <TextInput
                      value={batchSize}
                      onChangeText={setBatchSize}
                      keyboardType="number-pad"
                      className="rounded-[32px] border border-brand-100 bg-brand-50/50 px-5 py-4 text-base text-brand-900 font-bold"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-black text-brand-800 uppercase mb-2 tracking-widest">Direct Cost ({currencyCode})</Text>
                    <TextInput
                      value={baseCost}
                      onChangeText={setBaseCost}
                      keyboardType="decimal-pad"
                      className="rounded-[32px] border border-brand-100 bg-brand-50/50 px-5 py-4 text-base text-brand-900 font-bold"
                    />
                  </View>
                </View>
                <Text className="text-[10px] text-brand-400 mt-2 italic font-medium px-1">Cost for wholesale or pre-made items.</Text>

                <View className="mt-4">
                  <Text className="text-[10px] font-black text-brand-800 uppercase mb-1 tracking-widest">Monthly Overhead ({currencyCode})</Text>
                  <Text className="text-[10px] text-brand-400 italic font-medium px-1 mb-2">Fixed monthly costs shared by this product (rent, utilities, etc.)</Text>
                  <TextInput
                    value={monthlyOverhead}
                    onChangeText={setMonthlyOverhead}
                    keyboardType="decimal-pad"
                    className="rounded-[32px] border border-brand-100 bg-brand-50/50 px-5 py-4 text-base text-brand-900 font-bold"
                    placeholder="0.00"
                    placeholderTextColor="#adb5bd"
                  />
                </View>
            </FormSection>

            <FormSection title="Tax Configuration" icon="receipt">
                <View className="flex-row items-center justify-between mb-4">
                  <View>
                    <Text className="text-sm font-black text-brand-900">Value Added Tax (VAT)</Text>
                    <Text className="text-[10px] text-brand-400 font-bold uppercase tracking-tighter">Enable tax calculations</Text>
                  </View>
                  <Switch 
                    value={hasVat} 
                    onValueChange={(val) => {
                      setHasVat(val);
                      if (val && (!vatPercent || vatPercent === '0' || vatPercent === '0.00')) {
                        setVatPercent(String(settings.defaultVatPercent ?? '0'));
                      }
                    }} 
                    trackColor={{ true: '#16a34a' }} 
                    thumbColor={hasVat ? '#ffffff' : '#f8f9fa'} 
                  />
                </View>
                {hasVat && (
                  <View>
                    <Text className="text-[10px] font-black text-brand-800 uppercase mb-2 tracking-widest">VAT Rate %</Text>
                    <TextInput
                      value={vatPercent}
                      onChangeText={setVatPercent}
                      keyboardType="decimal-pad"
                      className="rounded-[32px] border border-brand-100 bg-brand-50/50 px-5 py-4 text-base text-brand-900 font-bold"
                    />
                  </View>
                )}
            </FormSection>
          </View>
        )}

        {/* ── STEP 3: Strategic Target ── */}
        {step === 3 && (
          <View>
            <FormSection title="Strategic Target" icon="trending-up">
              <View className="gap-3 mb-8">
                {PRICING_METHODS.map((item) => (
                  <Pressable
                    key={item.key}
                     onPress={() => {
                       setPricingMethod(item.key);
                       // Always populate with Business Profile default when switching method
                       const def = item.key === 'margin'
                         ? settings.defaultTargetMarginPercent
                         : item.key === 'markup'
                           ? settings.defaultTargetMarkupPercent
                           : settings.defaultTargetFixedProfitAmount;
                       setPricingValue(String(def ?? ''));
                     }}
                  >
                    <View className={`rounded-[32px] border-2 p-6 ${
                      pricingMethod === item.key ? 'border-brand-600 bg-brand-50/50' : 'border-brand-50 bg-white'
                    }`}>
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className={`font-black uppercase text-xs tracking-widest ${pricingMethod === item.key ? 'text-brand-900' : 'text-brand-200'}`}>
                          {item.label}
                        </Text>
                        {pricingMethod === item.key && <Ionicons name="checkmark-circle" size={22} color="#16a34a" />}
                      </View>
                      <Text className={`text-[11px] font-medium leading-4 ${pricingMethod === item.key ? 'text-brand-700' : 'text-brand-300'}`}>{item.description}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              <Text className="text-[10px] font-black text-brand-800 uppercase mb-2 tracking-widest">
                {pricingMethod === 'fixed' ? 'Raw Profit Amount' : `${pricingMethod === 'margin' ? 'Margin' : 'Markup'} % Value`}
              </Text>
              <TextInput
                value={pricingValue}
                onChangeText={setPricingValue}
                keyboardType="decimal-pad"
                className="rounded-[32px] border border-brand-100 bg-brand-50/50 px-5 py-4 text-base text-brand-900 font-black"
              />
            </FormSection>
          </View>
        )}

        {/* Navigation buttons */}
        <View className="mt-4 gap-4">
          {(step < TOTAL_STEPS) ? (
            <Pressable
              onPress={handleNext}
            >
              <View className="flex-row h-16 items-center justify-center rounded-[32px] bg-brand-900 shadow-lg">
                <Text className="font-black text-white text-base tracking-widest uppercase">Next Step</Text>
                <Ionicons name="chevron-forward" size={20} color="white" style={{ marginLeft: 8 }} />
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => { if (validateStep()) void handleSave(); }}
              disabled={isSaving}
            >
              <View className={`flex-row h-16 items-center justify-center rounded-[32px] bg-brand-900 shadow-lg ${isSaving ? 'opacity-70' : ''}`}>
                <Text className="font-black text-white text-base tracking-widest uppercase">
                  {isSaving ? 'Saving...' : initialProductId ? 'Commit Updates' : 'Launch Product'}
                </Text>
              </View>
            </Pressable>
          )}

          <View className="flex-row">
            <Pressable
              onPress={() => navigation.goBack()}
              className="w-full"
            >
              <View className="h-14 items-center justify-center rounded-[32px] bg-red-50 border border-red-100">
                <Text className="font-black text-red-600 text-[10px] tracking-widest uppercase">Cancel Setup</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
