import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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

export function SalesLoggerScreen() {
  const insets = useSafeAreaInsets();

  const products = useProductStore((state) => state.products);
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

  const initialPeriodType = useMemo(() => {
    const t = settings.lastSalesLogType || 'monthly';
    return (t.charAt(0).toUpperCase() + t.slice(1)) as 'Daily' | 'Weekly' | 'Monthly';
  }, [settings.lastSalesLogType]);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [periodType, setPeriodType] = useState<'Daily' | 'Weekly' | 'Monthly'>(initialPeriodType);
  const [month, setMonth] = useState(getCurrentMonth());
  const [unitsSoldInput, setUnitsSoldInput] = useState('');
  const [unitsUnsoldInput, setUnitsUnsoldInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (periodType === 'Daily') setMonth(getDailyPeriod());
    else if (periodType === 'Weekly') setMonth(getWeeklyPeriod());
    else setMonth(getCurrentMonth());
  }, [periodType]);

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
    if (!selectedProductId && products[0]?.id) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (selectedProductId) void loadProductIngredients(selectedProductId);
  }, [loadProductIngredients, selectedProductId]);

  useEffect(() => {
    // We no longer auto-populate existing entries to avoid confusion with "updating" vs "adding more".
    // Each log is now a separate entry in the history.
    setUnitsSoldInput('');
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

    let sPrice = isFinite(Number(selectedProduct.sellingPrice)) ? Number(selectedProduct.sellingPrice) : 0;
    const targetMarginVal = isFinite(Number(selectedProduct.targetMargin)) ? Number(selectedProduct.targetMargin) : 0;
    const vPercent = isFinite(Number(selectedProduct.vatPercent)) ? Number(selectedProduct.vatPercent) : 0;

    if (sPrice <= 0) {
      const suggestedPreVat = calculateSuggestedPrice(pPieceTotalCost, targetMarginVal, selectedProduct.pricingMethod as any);
      sPrice = suggestedPreVat * (1 + vPercent);
    }

    // Standardize to 2 decimal places (standard currency) to match user manual calculations
    sPrice = roundTo(isFinite(sPrice) ? sPrice : 0, 2);

    return {
      perPieceTotalCost: roundTo(pPieceTotalCost || 0, 4),
      sellingPrice: sPrice,
    };
  }, [selectedProduct, productIngredients]);

  const unitsSold = parseUnits(unitsSoldInput);
  const unitsUnsold = parseUnits(unitsUnsoldInput);
  const unitsProduced = unitsSold + unitsUnsold;

  const sellingPrice = derivedSellingPrice;
  const costPerPiece = perPieceTotalCost;

  const actualRevenue = calculateActualRevenue(sellingPrice, unitsSold);
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
        unitsUnsold,
        actualRevenue,
        actualCost,
        actualProfit,
        targetProfit,
        shortfall,
      });
      // Just clear success silently
      setUnitsSoldInput('');
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
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View style={{ height: 20 }} />

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

          <FormSection title="Period & Performance" icon="calendar">
            <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Log Type</Text>
            <View className="flex-row gap-2 mb-4 px-1">
               {['Daily', 'Weekly', 'Monthly'].map((type) => (
                 <OptionChip
                   key={type}
                   label={type}
                   selected={periodType === type}
                   onPress={() => {
                     const t = type as 'Daily' | 'Weekly' | 'Monthly';
                     setPeriodType(t);
                     void saveSettings({ lastSalesLogType: t.toLowerCase() as any });
                   }}
                   size="sm"
                 />
               ))}
            </View>

            <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Date / Period String</Text>
            <TextInput
              value={month}
              onChangeText={setMonth}
              placeholder={periodType === 'Daily' ? 'YYYY-MM-DD' : periodType === 'Weekly' ? 'YYYY-Wxx' : 'YYYY-MM'}
              className="rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-4 text-base text-brand-950 font-black mb-4"
              placeholderTextColor="#adb5bd"
            />
            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Sold Units</Text>
                <TextInput
                  value={unitsSoldInput}
                  onChangeText={setUnitsSoldInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  className="rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-4 text-base text-brand-950 font-black"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Unsold Units</Text>
                <TextInput
                  value={unitsUnsoldInput}
                  onChangeText={setUnitsUnsoldInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  className="rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-4 text-base text-brand-950 font-black"
                />
              </View>
            </View>
          </FormSection>

          <View className="mt-6 rounded-[32px] bg-brand-900 p-6 shadow-xl shadow-brand-900/20">
            <View className="flex-row items-center gap-2 mb-4">
              <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center">
                <Ionicons name="bulb" size={16} color="#34d399" />
              </View>
              <Text className="text-[10px] font-black text-brand-100 uppercase tracking-[2px]">Real-Time Batch Insights</Text>
            </View>

            <View className="flex-row gap-6">
              <View className="flex-1">
                <Text className="text-[9px] font-black text-brand-400 uppercase tracking-widest mb-1">Break-even</Text>
                <Text className="text-xl font-black text-white">
                  {sellingPrice > 0 ? Math.ceil(actualCost / sellingPrice) : 0} <Text className="text-[10px] text-brand-400 font-bold uppercase">units</Text>
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-[9px] font-black text-brand-400 uppercase tracking-widest mb-1">Max Potential Profit</Text>
                <Text className="text-xl font-black text-emerald-400">
                  {formatMoney(targetProfit, currencyCode)}
                </Text>
              </View>
            </View>

            <View className="h-[1px] bg-white/10 my-4" />

            <View className="flex-row justify-between items-center">
              <Text className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Efficiency Margin</Text>
              <Text className={`text-sm font-black ${actualMarginPercent > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {actualRevenue > 0 ? actualMarginPercent.toFixed(1) : '0.0'}%
              </Text>
            </View>
          </View>

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
                    <Text className="text-sm font-black text-brand-950">{entry.month} <Text className="font-semibold text-brand-400">· {entry.unitsSold} units</Text></Text>
                    <Text className="text-[10px] text-brand-600 font-bold uppercase tracking-tighter">
                      Revenue: {formatMoney(entry.actualRevenue, currencyCode)}
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
      <Text className={`text-sm font-black ${isStrong ? 'text-brand-950' : 'text-brand-800'}`}>{value}</Text>
    </View>
  );
}