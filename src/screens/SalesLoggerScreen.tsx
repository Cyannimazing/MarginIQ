import React, { useEffect, useMemo, useState } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProductStore } from '../stores/productStore';
import { useSalesStore } from '../stores/salesStore';
import {
  calculateActualProfit,
  calculateActualRevenue,
  calculateBatchCostFromUnits,
  calculateGrossMarginPercent,
  calculateShortfall,
  calculateSuggestedPrice,
  calculateTargetProfit,
  roundTo,
} from '../utils/formulas';
import { formatMoney } from '../utils/currency';
import { getCurrentMonth, getDailyPeriod, getWeeklyPeriod, isValidMonth } from '../utils/month';
import { useSettingsStore } from '../stores/settingsStore';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';
import { ActionModal } from '../components/ui/ActionModal';

const parseUnits = (value: string) => {
  const parsed = Number(value);
  return !Number.isFinite(parsed) ? 0 : Math.max(0, Math.floor(parsed));
};

type SalesLoggerRoute = RouteProp<{ SalesLogger: { productId?: number } }, 'SalesLogger'>;

export function SalesLoggerScreen() {
  const route = useRoute<SalesLoggerRoute>();
  const routeProductId = route.params?.productId ?? null;
  const insets = useSafeAreaInsets();

  const products = useProductStore((state) => state.products);
  const costGroups = useProductStore((state) => state.costGroups);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const loadProductIngredients = useProductStore((state) => state.loadProductIngredients);
  const getProductById = useProductStore((state) => state.getProductById);
  const getProductCostBreakdown = useProductStore((state) => state.getProductCostBreakdown);
  const getProductIngredients = useProductStore((state) => state.getProductIngredients);

  const monthlySales = useSalesStore((state) => state.monthlySales);
  const loadMonthlySales = useSalesStore((state) => state.loadMonthlySales);
  const saveMonthlySale = useSalesStore((state) => state.saveMonthlySale);
  const removeMonthlySale = useSalesStore((state) => state.removeMonthlySale);
  const getMonthlySale = useSalesStore((state) => state.getMonthlySale);

  const settings = useSettingsStore((state) => state.settings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const currencyCode = settings.currencyCode;

  const [selectedProductId, setSelectedProductId] = useState<number | null>(routeProductId);
  const [month, setMonth] = useState(getDailyPeriod());
  const [unitsSoldInput, setUnitsSoldInput] = useState('');
  const [unitsSoldDiscountedInput, setUnitsSoldDiscountedInput] = useState('');
  const [unitsUnsoldInput, setUnitsUnsoldInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    isAlert?: boolean;
    onConfirm?: () => void;
  }>({ visible: false, title: '', message: '' });

  useEffect(() => {
    void loadProducts();
    void loadMonthlySales();
  }, [loadMonthlySales, loadProducts]);

  useEffect(() => {
    if (!routeProductId && !selectedProductId && products[0]?.id) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId, routeProductId]);

  useEffect(() => {
    if (selectedProductId) void loadProductIngredients(selectedProductId);
  }, [loadProductIngredients, selectedProductId]);

  useEffect(() => {
    // We no longer auto-populate existing entries to avoid confusion with "updating" vs "adding more".
    // Each log is now a separate entry in the history.
    setUnitsSoldInput('');
    setUnitsSoldDiscountedInput('');
    setUnitsUnsoldInput('');
  }, [selectedProductId, month]);

  const selectedProduct = selectedProductId ? getProductById(selectedProductId) : undefined;
  const productIngredients = selectedProductId ? getProductIngredients(selectedProductId) : [];

  const getTrueUnitCost = (pi: any) => {
    const qty = Number(pi.ingredientQuantity) || 1;
    const yieldFactor = Number(pi.ingredientYieldFactor) || 1;
    const pricePerUnit = Number(pi.ingredientPricePerUnit) || 0;
    return (pricePerUnit / qty) / yieldFactor;
  };

  const { perPieceTotalCost, sellingPrice: derivedSellingPrice } = useMemo(() => {
    if (!selectedProduct) {
      return { perPieceTotalCost: 0, sellingPrice: 0 };
    }
    const ingredientsList = productIngredients.filter(pi => pi.costType === 'ingredients');
    const otherCostsList = productIngredients.filter(pi => pi.costType !== 'ingredients');

    const iTotal = ingredientsList.reduce((sum, pi) => {
      const uCost = getTrueUnitCost(pi);
      const c = uCost * (Number(pi.quantityUsed) || 0);
      return sum + (isFinite(c) ? c : 0);
    }, 0);

    const oTotalList = otherCostsList.reduce((sum, pi) => {
      const uCost = getTrueUnitCost(pi);
      const c = uCost * (Number(pi.quantityUsed) || 0);
      return sum + (isFinite(c) ? c : 0);
    }, 0);
    const oTotal = oTotalList + (isFinite(Number(selectedProduct.baseCost)) ? Number(selectedProduct.baseCost) : 0);

    const bTotalCost = iTotal + oTotal;
    const bSize = Math.max(Number(selectedProduct.batchSize || 1), 1);
    const pPieceTotalCost = bTotalCost / bSize;

    const fullyLoadedPerPieceCost = pPieceTotalCost;

    let sPrice = isFinite(Number(selectedProduct.sellingPrice)) ? Number(selectedProduct.sellingPrice) : 0;
    const targetMarginVal = isFinite(Number(selectedProduct.targetMargin)) ? Number(selectedProduct.targetMargin) : 0;
    const vPercent = isFinite(Number(selectedProduct.vatPercent)) ? Number(selectedProduct.vatPercent) : 0;

    if (sPrice <= 0) {
      const suggestedPreVat = calculateSuggestedPrice(pPieceTotalCost, targetMarginVal, selectedProduct.pricingMethod as any, bSize);
      sPrice = suggestedPreVat * (1 + vPercent);
    }

    // Standardize to 2 decimal places (standard currency) to match user manual calculations
    sPrice = roundTo(isFinite(sPrice) ? sPrice : 0, 2);

    return {
      perPieceTotalCost: roundTo(fullyLoadedPerPieceCost || 0, 4),
      sellingPrice: sPrice,
    };
  }, [selectedProduct, productIngredients, costGroups, products]);

  const unitsSold = parseUnits(unitsSoldInput);
  const unitsSoldDiscounted = parseUnits(unitsSoldDiscountedInput);
  const unitsUnsold = parseUnits(unitsUnsoldInput);
  const unitsProduced = unitsSold + unitsSoldDiscounted + unitsUnsold;

  const sellingPrice = derivedSellingPrice;
  const discountedPrice = roundTo(sellingPrice * 0.80, 2);
  const actualRevenue = (unitsSold * sellingPrice) + (unitsSoldDiscounted * discountedPrice);
  const costPerPiece = perPieceTotalCost;

  const actualCost = calculateBatchCostFromUnits(costPerPiece, unitsProduced);
  const actualProfit = calculateActualProfit(actualRevenue, actualCost);
  const targetRevenue = calculateActualRevenue(sellingPrice, unitsProduced);
  const targetProfit = calculateTargetProfit(targetRevenue, actualCost);
  const shortfall = calculateShortfall(targetProfit, actualProfit);
  const actualMarginPercent = calculateGrossMarginPercent(actualRevenue, actualCost);

  const productSales = useMemo(() => {
    return selectedProductId ? monthlySales.filter((entry) => entry.productId === selectedProductId) : [];
  }, [monthlySales, selectedProductId]);

  const handleSave = async () => {
    if (!selectedProductId || !isValidMonth(month) || unitsProduced <= 0) {
      setModalState({
        visible: true,
        isAlert: true,
        title: 'Incomplete Data',
        message: 'Please check product, month, and unit counts.',
      });
      return;
    }
    setIsSaving(true);
    try {
      await saveMonthlySale({
        productId: selectedProductId,
        month: month.trim(),
        unitsSold,
        unitsSoldDiscounted,
        unitsUnsold,
        actualRevenue,
        actualCost,
        actualProfit,
        targetProfit,
        shortfall,
      });
      // Just clear success silently
      setUnitsSoldInput('');
      setUnitsSoldDiscountedInput('');
      setUnitsUnsoldInput('');
    } catch {
      setModalState({
        visible: true,
        isAlert: true,
        title: 'Error',
        message: 'Failed to save sales data.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setModalState({
      visible: true,
      title: 'Delete Record',
      message: 'Permanently delete this sales record?',
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: () => removeMonthlySale(id),
    });
  };

  return (
    <View className="flex-1 bg-white">

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView 
          className="flex-1 px-5" 
          keyboardShouldPersistTaps="handled" 
          removeClippedSubviews={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <View style={{ height: 20 }} />

          {routeProductId ? (
            <View className="mb-2 px-1">
              <Text className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">Product</Text>
              <Text className="text-xl font-black text-brand-900 tracking-tight" numberOfLines={1}>
                {selectedProduct?.name ?? '—'}
              </Text>
            </View>
          ) : (
            <FormSection title="Product Selection" icon="cube">
              <View className="flex-row flex-wrap gap-2">
                {products.map((p) => (
                  <OptionChip
                    key={p.id}
                    label={p.name}
                    selected={selectedProductId === p.id}
                    onPress={() => setSelectedProductId(p.id)}
                  />
                ))}
              </View>
            </FormSection>
          )}

          <FormSection title="Period & Performance" icon="calendar">
            <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Logging Date</Text>
            <View className="rounded-2xl border border-brand-100 bg-brand-50/30 px-4 py-4 mb-6">
              <Text className="text-base text-brand-900 font-black">Today · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            </View>

            <View className="gap-4 mb-6">
              <View>
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Sold (Full Price)</Text>
                <TextInput
                  value={unitsSoldInput}
                  onChangeText={setUnitsSoldInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#adb5bd"
                  multiline={false}
                  className="rounded-2xl border border-brand-100 bg-brand-50/50 w-full px-4 h-16 text-xl text-brand-900 font-black"
                />
              </View>
              <View>
                <Text className="text-[10px] font-black text-emerald-600 uppercase mb-2 tracking-widest px-1">Sold (Discounted)</Text>
                <TextInput
                  value={unitsSoldDiscountedInput}
                  onChangeText={setUnitsSoldDiscountedInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#adb5bd"
                  multiline={false}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/30 w-full px-4 h-16 text-xl text-emerald-700 font-black"
                />
              </View>
              <View>
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Unsold / Wasted</Text>
                <TextInput
                  value={unitsUnsoldInput}
                  onChangeText={setUnitsUnsoldInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#adb5bd"
                  multiline={false}
                  className="rounded-2xl border border-brand-100 bg-brand-50/50 w-full px-4 h-16 text-xl text-brand-900 font-black"
                />
              </View>
            </View>
          </FormSection>


          <View className="mt-8 gap-4 pb-20">
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
            >
              <View className={`h-16 items-center justify-center rounded-[32px] bg-brand-900 shadow-lg ${isSaving ? 'opacity-70' : ''}`}>
                <Text className="font-black text-white text-sm tracking-widest uppercase">
                  {isSaving ? 'Recording...' : 'Log Sales Data'}
                </Text>
              </View>
            </Pressable>

            <Text className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4 mt-8 px-2">
              History for {selectedProduct?.name}
            </Text>

            {productSales.length ? (
              productSales.map((entry) => (
                <View key={entry.id} className="rounded-3xl border border-brand-100 bg-white p-5 flex-row items-center justify-between mb-3 shadow-sm">
                  <View>
                    <Text className="text-sm font-black text-brand-900">
                      {entry.month} <Text className="font-semibold text-brand-400">· {Number(entry.unitsSold) + Number(entry.unitsSoldDiscounted)} sold</Text>
                    </Text>
                    <Text className="text-[10px] text-brand-600 font-bold uppercase tracking-tighter">
                      Revenue: {formatMoney(entry.actualRevenue, currencyCode)} {entry.unitsSoldDiscounted > 0 ? `(${entry.unitsSoldDiscounted} disc.)` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDelete(entry.id)}>
                    <View className="h-10 w-10 items-center justify-center bg-red-50 rounded-full">
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </View>
                  </Pressable>
                </View>
              ))
            ) : (
              <View className="items-center py-8 border-2 border-dashed border-brand-50 rounded-[32px] bg-brand-50/10">
                <Text className="text-[10px] font-black text-brand-600 uppercase tracking-widest">No history found</Text>
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <ActionModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        primaryActionText={modalState.isAlert ? 'OK' : (modalState.confirmText || 'Confirm')}
        secondaryActionText={modalState.isAlert ? undefined : 'Cancel'}
        isDestructive={modalState.isDestructive}
        onPrimaryAction={() => {
          setModalState((s: any) => ({ ...s, visible: false }));
          modalState.onConfirm?.();
        }}
        onSecondaryAction={() => setModalState((s: any) => ({ ...s, visible: false }))}
      />
    </View>
  );
}

function SummaryRow({ label, value, isStrong }: { label: string; value: string; isStrong?: boolean }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className={`text-xs ${isStrong ? 'font-black text-brand-900 uppercase tracking-widest' : 'font-bold text-brand-600'}`}>{label}</Text>
      <Text className={`text-sm font-black ${isStrong ? 'text-brand-900' : 'text-brand-800'}`}>{value}</Text>
    </View>
  );
}