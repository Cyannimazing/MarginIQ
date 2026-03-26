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
import { normalizeUnitsPerSale, perSaleCost, saleUnitDisplayName } from '../utils/productEconomics';
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

  const { perPieceTotalCost, sellingPrice: derivedSellingPrice, unitsPerSale: logPackageSize } = useMemo(() => {
    if (!selectedProduct) {
      return { perPieceTotalCost: 0, sellingPrice: 0, unitsPerSale: 1 };
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
    const uSale = normalizeUnitsPerSale((selectedProduct as any).unitsPerSale, bSize);
    const costPerLoggedUnit = perSaleCost(pPieceTotalCost, uSale);

    let sPrice = isFinite(Number(selectedProduct.sellingPrice)) ? Number(selectedProduct.sellingPrice) : 0;
    const targetMarginVal = isFinite(Number(selectedProduct.targetMargin)) ? Number(selectedProduct.targetMargin) : 0;
    const vPercent = isFinite(Number(selectedProduct.vatPercent)) ? Number(selectedProduct.vatPercent) : 0;

    if (sPrice <= 0) {
      const batchSales = bSize / uSale;
      const suggestedPreVat = calculateSuggestedPrice(
        costPerLoggedUnit,
        targetMarginVal,
        selectedProduct.pricingMethod as any,
        batchSales,
      );
      sPrice = suggestedPreVat * (1 + vPercent);
    }

    // Standardize to 2 decimal places (standard currency) to match user manual calculations
    sPrice = roundTo(isFinite(sPrice) ? sPrice : 0, 2);

    return {
      perPieceTotalCost: roundTo(costPerLoggedUnit || 0, 4),
      sellingPrice: sPrice,
      unitsPerSale: uSale,
    };
  }, [selectedProduct, productIngredients, costGroups, products]);

  const totalMonthlyOverhead = useMemo(() => {
    if (!selectedProduct) return 0;
    const directOverhead = Math.max(Number(selectedProduct.monthlyOverhead) || 0, 0);
    const costGroupId = (selectedProduct as any).costGroupId;
    const linkedGroup = costGroups.find(g => g.id === costGroupId);
    const groupOverhead = linkedGroup
      ? Math.max(Number((linkedGroup as any).monthlySharedCost) || 0, 0)
      : 0;
    const peersInGroup = costGroupId
      ? products.filter(p => (p as any).costGroupId === costGroupId).length
      : 0;
    const groupShare = peersInGroup > 0 ? groupOverhead / peersInGroup : 0;
    return directOverhead + groupShare;
  }, [selectedProduct, costGroups, products]);

  const overheadPerUnit = useMemo(() => {
    if (!selectedProduct || totalMonthlyOverhead <= 0) return 0;
    const goalProfit = Math.max(Number(selectedProduct.monthlyGoalProfit) || 0, 0);
    const profitPerPiece = derivedSellingPrice - perPieceTotalCost;
    const goalUnits = goalProfit > 0 && profitPerPiece > 0
      ? Math.ceil((goalProfit + totalMonthlyOverhead) / profitPerPiece)
      : 0;
    return goalUnits > 0 ? totalMonthlyOverhead / goalUnits : 0;
  }, [selectedProduct, totalMonthlyOverhead, derivedSellingPrice, perPieceTotalCost]);

  const unitsSold = parseUnits(unitsSoldInput);
  const unitsSoldDiscounted = parseUnits(unitsSoldDiscountedInput);
  const unitsUnsold = parseUnits(unitsUnsoldInput);
  const unitsProduced = unitsSold + unitsSoldDiscounted + unitsUnsold;

  const sellingPrice = derivedSellingPrice;
  const discPct = Math.min(
    Math.max(Number(selectedProduct?.discountPercent ?? 0), 0),
    0.99,
  );
  const discountedPrice = roundTo(sellingPrice * (1 - discPct), 2);

  // Clear discounted input when switching to a product that has no discount
  useEffect(() => {
    if (discPct === 0) setUnitsSoldDiscountedInput('');
  }, [discPct]);
  const logSaleLabel = selectedProduct
    ? saleUnitDisplayName((selectedProduct as any).saleUnitLabel, logPackageSize)
    : 'unit';
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
      const overheadCostTotal = roundTo(Math.min(overheadPerUnit * unitsProduced, totalMonthlyOverhead), 2);
      const totalActualCost = roundTo(actualCost + overheadCostTotal, 2);
      const actualProfitNet = roundTo(actualRevenue - totalActualCost, 2);

      await saveMonthlySale({
        productId: selectedProductId,
        month: month.trim(),
        unitsSold,
        unitsSoldDiscounted,
        unitsUnsold,
        actualRevenue,
        ingredientCost: actualCost,
        overheadCost: totalMonthlyOverhead,
        actualCost: totalActualCost,
        actualProfit: actualProfitNet,
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

            {selectedProduct && logPackageSize > 1 && (
              <Text className="text-[10px] text-brand-500 font-semibold italic px-1 mb-4">
                Count each row as one {logSaleLabel} ({logPackageSize} pcs). Price and cost assume one {logSaleLabel} per entry.
              </Text>
            )}

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
              {discPct > 0 && (
                <View>
                  <Text className="text-[10px] font-black text-emerald-600 uppercase mb-2 tracking-widest px-1">
                    Sold (Discounted {Math.round(discPct * 100)}% off · {formatMoney(discountedPrice, currencyCode)})
                  </Text>
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
              )}
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
            {overheadPerUnit > 0 && unitsProduced > 0 && (
              <View className="flex-row items-center gap-2 px-4 py-3 rounded-2xl bg-blue-50 border border-blue-100">
                <Ionicons name="layers-outline" size={13} color="#2563eb" />
                <Text className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex-1">
                  Overhead share · {formatMoney(overheadPerUnit, currencyCode)}/unit × {unitsProduced} = {formatMoney(Math.min(overheadPerUnit * unitsProduced, totalMonthlyOverhead), currencyCode)} deducted{overheadPerUnit * unitsProduced > totalMonthlyOverhead ? ' (capped at monthly max)' : ''}
                </Text>
              </View>
            )}
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