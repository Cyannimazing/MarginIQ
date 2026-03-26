import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
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
import { PRODUCT_CATEGORIES } from '../constants/productCategories';
import { ProductCategory } from '../features/products/types';
import { PricingMethod } from '../features/settings/types';
import { RootStackParamList } from '../navigation/types';
import { useIngredientStore } from '../stores/ingredientStore';
import { useProductStore } from '../stores/productStore';
import { useSettingsStore } from '../stores/settingsStore';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';
import { ActionModal } from '../components/ui/ActionModal';
import { safeNavigate } from '../navigation/navigationService';

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
  const getProductSalePackages = useProductStore((state) => state.getProductSalePackages);
  const loadProductSalePackages = useProductStore((state) => state.loadProductSalePackages);
  const addProductSalePackage = useProductStore((state) => state.addProductSalePackage);
  
  const getProductIngredients = useProductStore((state) => state.getProductIngredients);
  const loadProductIngredients = useProductStore((state) => state.loadProductIngredients);
  const addIngredientToProduct = useProductStore((state) => state.addIngredientToProduct);
  const removeIngredientFromProduct = useProductStore((state) => state.removeIngredientFromProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);
  
  const ingredients = useIngredientStore((state) => state.ingredients);
  const loadIngredients = useIngredientStore((state) => state.loadIngredients);
  const addIngredient = useIngredientStore((state) => state.addIngredient);
  
  const settings = useSettingsStore((state) => state.settings);
  const currencyCode = settings.currencyCode;

  const existingProduct = useMemo(
    () => (initialProductId ? products.find((item) => Number(item.id) === Number(initialProductId)) : undefined),
    [products, initialProductId],
  );

  // Step state
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [autoCreatedId, setAutoCreatedId] = useState<number | null>(null);
  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isError?: boolean;
  }>({ visible: false, title: '', message: '' });
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [packageModalVisible, setPackageModalVisible] = useState(false);
  const [newPackageName, setNewPackageName] = useState('');
  const [newPackagePieces, setNewPackagePieces] = useState('');
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // Consumables State
  const [selectedConsumables, setSelectedConsumables] = useState<number[]>([]);
  const [consumableSearch, setConsumableSearch] = useState('');

  const effectiveProductId = initialProductId || autoCreatedId || null;
  const productSalePackages = effectiveProductId ? getProductSalePackages(effectiveProductId) : [];
  const existingProductIngredients = effectiveProductId ? getProductIngredients(effectiveProductId) : [];

  useEffect(() => {
    void loadIngredients();
    if (effectiveProductId) {
      void loadProductSalePackages(effectiveProductId);
      void loadProductIngredients(effectiveProductId);
    }
  }, [effectiveProductId, loadProductSalePackages, loadProductIngredients, loadIngredients]);

  useFocusEffect(
    useCallback(() => {
      void loadIngredients();
      if (effectiveProductId) {
        void loadProductIngredients(effectiveProductId);
      }
    }, [loadIngredients, loadProductIngredients, effectiveProductId])
  );

  // Pre-populate selectedConsumables once ingredients are loaded
  useEffect(() => {
    if (initialProductId && existingProductIngredients.length > 0) {
      const packagingItems = existingProductIngredients
        .filter(pi => pi.costType === 'packaging' || pi.costType === 'material')
        .map(pi => pi.ingredientId);
      
      setSelectedConsumables(prev => {
        // Only merge if not strictly identical to prevent loops
        const currentSet = new Set(prev);
        const hasNew = packagingItems.some(id => !currentSet.has(id));
        return hasNew ? Array.from(new Set([...prev, ...packagingItems])) : prev;
      });
    }
  }, [existingProductIngredients, initialProductId]);

  const toggleConsumable = (ingredientId: number) => {
    setSelectedConsumables((prev) => 
      prev.includes(ingredientId) 
        ? prev.filter((id) => id !== ingredientId)
        : [...prev, ingredientId]
    );
  };

  const handleQuickAddConsumable = async () => {
    const name = consumableSearch.trim();
    if (!name) return;
    
    // Quick create as a Fixed Classification item by default, with 0 cost.
    try {
      const ingId = await addIngredient({
        productId: 0,
        name,
        unit: 'pcs',
        quantity: 1,
        pricePerUnit: 0,
        yieldFactor: 1,
        classification: 'fixed',
        tag: 'Packaging'
      });
      toggleConsumable(ingId);
      setConsumableSearch('');
    } catch (err) {
      setModalState({ visible: true, title: 'Error', message: 'Failed to create item.', isError: true });
    }
  };

  const handleCreatePackage = useCallback(async () => {
    if (!initialProductId) return;
    const n = newPackageName.trim();
    const pieces = Math.max(1, Math.floor(Number(newPackagePieces) || 0));
    if (!n) return;
    if (!Number.isFinite(pieces) || pieces < 1) return;
    setIsSavingPackage(true);
    try {
      await addProductSalePackage({ productId: initialProductId, name: n, piecesPerPackage: pieces });
      setUnitsPerSale(String(pieces));
      setSaleUnitLabel(n);
      setPackageModalVisible(false);
      setNewPackageName('');
      setNewPackagePieces('');
    } finally {
      setIsSavingPackage(false);
    }
  }, [initialProductId, newPackageName, newPackagePieces, addProductSalePackage]);

  // Step 1 — Basic Info
  const [name, setName] = useState(existingProduct?.name ?? '');
  const [category, setCategory] = useState<ProductCategory>(
    (existingProduct?.category as ProductCategory) ?? 'Beverages',
  );

  // Step 2 — Cost Setup
  const [batchSize, setBatchSize] = useState(String(existingProduct?.batchSize ?? 1));
  const [unitsPerSale, setUnitsPerSale] = useState(
    String((existingProduct as any)?.unitsPerSale ?? 1),
  );
  const [saleUnitLabel, setSaleUnitLabel] = useState(
    String((existingProduct as any)?.saleUnitLabel ?? ''),
  );
  const [baseCost, setBaseCost] = useState(String(existingProduct?.baseCost ?? 0));
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
  const [hasDiscount, setHasDiscount] = useState(
    existingProduct ? Number(existingProduct.discountPercent ?? 0) > 0 : false,
  );
  const [discountPercent, setDiscountPercent] = useState(
    String(
      existingProduct
        ? Math.max(Number(existingProduct.discountPercent ?? 0), 0) * 100
        : (settings.defaultDiscountPercent ?? 0),
    ),
  );

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // (No product-specific monthly overhead: overhead is handled via cost groups.)

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
    settings.defaultVatPercent,
    settings.defaultDiscountPercent
  ]);

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!name.trim()) {
        setModalState({ visible: true, title: 'Name Required', message: 'Please enter a product name.', isError: true });
        return false;
      }
      // Duplicate name guard (skip check when editing the same product)
      if (!initialProductId) {
        const duplicate = products.find(
          p => p.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (duplicate) {
          setModalState({ visible: true, title: 'Duplicate Product', message: `A product named "${duplicate.name}" already exists. Please use a different name.`, isError: true });
          return false;
        }
      }
      return true;
    }
    if (step === 2) {
      const bs = Number(batchSize);
      if (!Number.isInteger(bs) || bs <= 0) {
        setModalState({ visible: true, title: 'Invalid Batch Size', message: 'Batch size must be a whole number greater than 0.', isError: true });
        return false;
      }
      const val = Number(baseCost);
      if (!Number.isFinite(val) || val < 0) {
        setModalState({ visible: true, title: 'Invalid Cost', message: 'Direct/Base Cost must be 0 or greater.', isError: true });
        return false;
      }
      if (hasVat) {
        const vat = Number(vatPercent);
        if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
          setModalState({ visible: true, title: 'Invalid VAT', message: 'VAT must be between 0 and 100.', isError: true });
          return false;
        }
      }
      if (hasDiscount) {
        const discountVal = Number(discountPercent);
        if (!Number.isFinite(discountVal) || discountVal <= 0 || discountVal >= 100) {
          setModalState({ visible: true, title: 'Invalid Discount', message: 'Discount % must be greater than 0 and less than 100.', isError: true });
          return false;
        }
      }
      const ups = Number(unitsPerSale);
      if (!Number.isInteger(ups) || ups <= 0) {
        setModalState({ visible: true, title: 'Invalid Units per Sale', message: 'Units per sale must be a whole number greater than 0.', isError: true });
        return false;
      }
      // Removed mandatory label requirement for packaged units
      return true;
    }
    if (step === 3) {
      const val = Number(pricingValue);
      if (!Number.isFinite(val) || val < 0) {
        setModalState({ visible: true, title: 'Invalid Value', message: 'Please enter a valid pricing value (0 or greater).', isError: true });
        return false;
      }
      if ((pricingMethod === 'margin' || pricingMethod === 'markup') && val >= 100) {
        setModalState({ visible: true, title: 'Invalid Value', message: 'Margin/Markup % must be less than 100.', isError: true });
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

  const performSave = async () => {
    const pricingVal = Number(pricingValue);
    const targetMargin = (pricingMethod === 'margin' || pricingMethod === 'markup')
      ? pricingVal / 100
      : pricingVal;

    setIsSaving(true);
    try {
      const resolvedDiscountPercent = hasDiscount
        ? Math.min(Math.max(Number(discountPercent) || 0, 0), 99) / 100
        : 0;
      const bs = Number(batchSize);
      const payload = {
        name: name.trim(),
        category,
        batchSize: bs,
        unitsPerSale: Number(unitsPerSale),
        saleUnitLabel: saleUnitLabel.trim(),
        baseCost: Number(baseCost),
        targetMargin,
        sellingPrice: existingProduct?.sellingPrice ?? 0,
        vatPercent: hasVat ? Number(vatPercent) / 100 : 0,
        pricingMethod,
        monthlyGoalProfit: existingProduct?.monthlyGoalProfit ?? 0,
        discountPercent: resolvedDiscountPercent,
        monthlyOverhead: existingProduct?.monthlyOverhead ?? 0,
        monthlyOverheadBreakdown: (existingProduct as any)?.monthlyOverheadBreakdown ?? '',
      };

      const existingId = initialProductId || autoCreatedId;
      let finalProductId = existingId;

      if (existingId) {
        await editProduct(existingId, payload);
      } else {
        finalProductId = await addProduct(payload);
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
      return finalProductId;
    } catch (err) {
      console.error(err);
      setModalState({ visible: true, title: 'Save Failed', message: 'Unable to save product.', isError: true });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (autoCreatedId) {
      await removeProduct(autoCreatedId);
    }
    navigation.goBack();
  };

  const handleSave = async () => {
    const pid = await performSave();
    if (pid) navigation.goBack();
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => setShowExitConfirm(true)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={24} color="#166534" />
        </Pressable>
      ),
      headerRight: undefined,
      headerBackVisible: false,
      gestureEnabled: false,
    });
  }, [navigation, setShowExitConfirm]);

  // Intercept Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowExitConfirm(true);
      return true; // prevent default back
    });
    return () => sub.remove();
  }, []);

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
                    <Text className="text-[10px] font-black text-brand-800 uppercase mb-2 tracking-widest">Batch output (pieces)</Text>
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
                <Text className="text-[10px] text-brand-400 mt-2 italic font-medium px-1">Total smallest units one full recipe run makes (e.g. donuts). Cost for wholesale or pre-made items.</Text>
            </FormSection>

            <FormSection title="Composition & Cost" icon="layers">
                <Text className="text-[10px] font-black text-brand-800 uppercase tracking-widest px-1 mb-4">Link Ingredients & Packaging to calculate cost</Text>
                
                <Pressable
                  onPress={async () => {
                    let pid = Number(initialProductId) || autoCreatedId || 0;
                    if (!pid) {
                      // First check if at least step 1 (identity) is valid
                      if (!name.trim()) {
                        setModalState({ visible: true, title: 'Name Required', message: 'Please provide a product name before linking resources.', isError: true });
                        return;
                      }
                      // Auto-save the product shell first
                      pid = await performSave() || 0;
                      if (pid > 0) setAutoCreatedId(pid);
                    }
                    
                    if (pid > 0) {
                      safeNavigate('ProductAddIngredient', { productId: pid });
                    }
                  }}
                  disabled={isSaving}
                  className={`bg-brand-900 h-16 rounded-[24px] flex-row items-center justify-center gap-3 shadow-lg ${isSaving ? 'opacity-50' : ''}`}
                >
                    <Ionicons name="add-circle" size={20} color="white" />
                    <Text className="text-[13px] font-black text-white uppercase tracking-widest">
                      {isSaving ? 'Saving...' : 'Link Resources'}
                    </Text>
                </Pressable>

                {existingProductIngredients.length > 0 && (
                  <View className="mt-6 bg-brand-50/50 rounded-2xl p-4 border border-brand-100">
                     <View className="flex-row justify-between mb-2">
                        <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Linked Resources</Text>
                        <Text className="text-[10px] font-black text-brand-900 uppercase">{existingProductIngredients.length} Items</Text>
                     </View>
                     <View className="flex-row flex-wrap gap-2">
                        {existingProductIngredients.slice(0, 5).map(pi => (
                          <View key={pi.id} className="bg-white px-3 py-1.5 rounded-full border border-brand-100">
                             <Text className="text-[10px] font-bold text-brand-700">{pi.ingredientName}</Text>
                          </View>
                        ))}
                        {existingProductIngredients.length > 5 && (
                          <Text className="text-[10px] font-bold text-brand-400 self-center">+{existingProductIngredients.length - 5} more</Text>
                        )}
                     </View>
                  </View>
                )}
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

                <View className="flex-row items-center justify-between mb-4 mt-6">
                  <View>
                    <Text className="text-sm font-black text-brand-900">Discount</Text>
                    <Text className="text-[10px] text-brand-400 font-bold uppercase tracking-tighter">Enable discount pricing</Text>
                  </View>
                  <Switch
                    value={hasDiscount}
                    onValueChange={(val) => {
                      setHasDiscount(val);
                      if (val && (!discountPercent || Number(discountPercent) <= 0)) {
                        setDiscountPercent(String(settings.defaultDiscountPercent ?? '0'));
                      }
                    }}
                    trackColor={{ true: '#16a34a' }}
                    thumbColor={hasDiscount ? '#ffffff' : '#f8f9fa'}
                  />
                </View>
                {hasDiscount && (
                  <View>
                    <Text className="text-[10px] font-black text-brand-800 uppercase mb-2 tracking-widest">Discount Rate %</Text>
                    <TextInput
                      value={discountPercent}
                      onChangeText={setDiscountPercent}
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
              onPress={() => setShowExitConfirm(true)}
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

      <ActionModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        onPrimaryAction={() => setModalState(prev => ({ ...prev, visible: false }))}
        isDestructive={!!modalState.isError}
      />

      <ActionModal
        visible={showExitConfirm}
        title="Exit Setup?"
        message={`Exiting without committing will void the entire setup${autoCreatedId ? ' and delete this product' : ''}.`}
        primaryActionText="Stay"
        secondaryActionText="Cancel Setup"
        onPrimaryAction={() => setShowExitConfirm(false)}
        onSecondaryAction={() => { setShowExitConfirm(false); void handleCancel(); }}
      />

      {/* Package Creation Modal */}
      <Modal visible={packageModalVisible} transparent animationType="fade" onRequestClose={() => setPackageModalVisible(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1 bg-black/50 justify-center items-center px-6">
            <View className="bg-white rounded-[32px] w-full p-6 shadow-xl">
              <Text className="text-xl font-black text-brand-900 text-center mb-2">Create Package</Text>
              <Text className="text-[11px] font-medium text-brand-500 text-center mb-6 leading-4 px-2">
                Save this packaging setup so you can quickly switch to it later.
              </Text>
              
              <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest pl-2">Package Name</Text>
              <TextInput
                value={newPackageName}
                onChangeText={setNewPackageName}
                placeholder="e.g. Box of 12"
                placeholderTextColor="#adb5bd"
                className="rounded-3xl bg-brand-50/50 border border-brand-100 px-5 py-4 text-base font-bold text-brand-900 mb-4"
              />

              <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest pl-2">Pieces inside</Text>
              <TextInput
                value={newPackagePieces}
                onChangeText={setNewPackagePieces}
                placeholder="12"
                keyboardType="number-pad"
                placeholderTextColor="#adb5bd"
                className="rounded-3xl bg-brand-50/50 border border-brand-100 px-5 py-4 text-base font-bold text-brand-900 mb-8"
              />

              <View className="flex-row gap-3">
                <Pressable className="flex-1" onPress={() => setPackageModalVisible(false)}>
                  <View className="h-14 items-center justify-center rounded-[24px] bg-slate-100">
                    <Text className="font-bold text-slate-600 text-xs uppercase tracking-widest">Cancel</Text>
                  </View>
                </Pressable>
                <Pressable className="flex-1" onPress={() => void handleCreatePackage()} disabled={isSavingPackage || !newPackageName.trim() || !newPackagePieces.trim()}>
                  <View className={`h-14 items-center justify-center rounded-[24px] ${isSavingPackage || !newPackageName.trim() || !newPackagePieces.trim() ? 'bg-brand-400' : 'bg-brand-900'}`}>
                    <Text className="font-black text-white text-xs uppercase tracking-widest">{isSavingPackage ? 'Saving...' : 'Confirm'}</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

