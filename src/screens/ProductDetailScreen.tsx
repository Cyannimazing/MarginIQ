import React, { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useProductStore } from '../stores/productStore';
import { useSalesStore } from '../stores/salesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import { getCurrentMonth } from '../utils/month';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

const PRICING_METHOD_LABELS: Record<string, string> = {
  margin: 'Margin %',
  markup: 'Markup %',
  fixed: 'Fixed Profit',
};

export function ProductDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { productId } = route.params;
  const products = useProductStore((state) => state.products);
  const deleteProduct = useProductStore((state) => state.trashProduct);
  const getProductIngredients = useProductStore((state) => state.getProductIngredients);
  const loadProductIngredients = useProductStore((state) => state.loadProductIngredients);
  const isLoadingCategories = useProductStore((state) => state.isLoading);
  const editProduct = useProductStore((state) => state.editProduct);
  const settings = useSettingsStore((state) => state.settings);
  const monthlySales = useSalesStore((state) => state.monthlySales);

  const product = products.find((p) => Number(p.id) === Number(productId));
  const productIngredients = getProductIngredients(productId);

  React.useEffect(() => {
    void loadProductIngredients(Number(productId));
  }, [productId, loadProductIngredients]);

  // Derive records
  const currentMonthStr = getCurrentMonth();
  
  const monthlyGoalRecords = useMemo(() => {
    const records: Record<number, { earnedSoFar: number }> = {};
    monthlySales.forEach((sale) => {
      const matchMonth = sale.month.match(/^\d{4}-\d{2}-\d{2}$/) ? sale.month.substring(0, 7) : sale.month;
      if (matchMonth === currentMonthStr) {
        const pId = Number(sale.productId);
        if (!records[pId]) records[pId] = { earnedSoFar: 0 };
        records[pId].earnedSoFar += sale.actualRevenue;
      }
    });
    return records;
  }, [monthlySales, currentMonthStr]);

  const goalRecord = monthlyGoalRecords[productId] || { earnedSoFar: 0 };
  const currencyCode = settings.currencyCode;

  const [isGoalExpanded, setIsGoalExpanded] = useState(false);
  const [goalInput, setGoalInput] = useState(String(product?.monthlyGoalProfit || '0'));
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('0');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  const handleSaveGoal = async () => {
    if (!product) return;
    const val = Number(goalInput) || 0;
    try {
      setIsSavingGoal(true);
      await editProduct(product.id, { monthlyGoalProfit: val });
      setIsGoalExpanded(false);
    } catch (err) {
      Alert.alert('Error', 'Could not save monthly goal.');
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Move to Trash', 'Are you sure you want to move this product to the trash?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to Trash',
        style: 'destructive',
        onPress: async () => {
          await deleteProduct(product!.id);
          navigation.goBack();
        },
      },
    ]);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Product Analysis',
      headerRight: undefined,
    });
  }, [navigation]);

  // Helper to get true unit cost per 1 unit of measurement
  const getTrueUnitCost = (pi: any) => {
    const qty = Math.max(Number(pi.ingredientQuantity) || 1, 0.00000001);
    const yieldFactor = Math.max(Number(pi.ingredientYieldFactor) || 1, 0.00000001);
    const pricePerUnit = Number(pi.ingredientPricePerUnit) || 0;
    const cost = (pricePerUnit / qty) / yieldFactor;
    return isFinite(cost) ? cost : 0;
  };

  const {
    batchTotalCost,
    ingredientsTotal,
    otherCostsTotal,
    perPieceIngredients,
    perPieceOther,
    perPieceTotalCost,
    sellingPrice,
    priceBeforeVat,
    vatAmount,
    profitPerPiece,
    profitMarginPercent,
    priceMarkupPercent,
    isProfitValid,
    discountedPrice,
    preVatDiscountedPrice,
    profitIfDiscounted,
    marginIfDiscounted,
    categoryTotals
  } = useMemo(() => {
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
    const oTotal = oTotalList + (isFinite(Number(product?.baseCost)) ? Number(product?.baseCost) : 0);

    const bTotalCost = iTotal + oTotal;
    const bSize = Math.max(Number(product?.batchSize || 1), 0.00000001);
    const pPieceTotalCost = isFinite(bTotalCost / bSize) ? bTotalCost / bSize : 0;

    let sPrice = isFinite(Number(product?.sellingPrice)) ? Number(product?.sellingPrice) : 0;
    const targetMarginVal = isFinite(Number(product?.targetMargin)) ? Number(product?.targetMargin) : 0;
    const vPercent = isFinite(Number(product?.vatPercent)) ? Number(product?.vatPercent) : 0;

    if (sPrice <= 0) {
      let suggestedPreVat = pPieceTotalCost;
      if (product?.pricingMethod === 'markup') {
        suggestedPreVat = pPieceTotalCost * (1 + targetMarginVal);
      } else if (product?.pricingMethod === 'fixed') {
        suggestedPreVat = pPieceTotalCost + targetMarginVal;
      } else {
        const denom = (1 - targetMarginVal);
        suggestedPreVat = (denom > 0 && denom < 1) ? (pPieceTotalCost / denom) : (pPieceTotalCost * 1.5);
      }
      sPrice = suggestedPreVat * (1 + vPercent);
    }

    sPrice = Math.max(0, sPrice);

    const pBeforeVat = isFinite(sPrice / (1 + vPercent)) ? sPrice / (1 + vPercent) : sPrice;
    const vAmount = sPrice - pBeforeVat;
    const pPerPiece = sPrice - pPieceTotalCost;

    const roundedSPrice = Math.round(sPrice * 100) / 100;
    const roundedCost = Math.round(pPieceTotalCost * 100) / 100;
    const roundedProfit = roundedSPrice - roundedCost;

    const pMarginPercent = (isFinite(roundedSPrice) && roundedSPrice > 0) ? (roundedProfit / roundedSPrice) * 100 : 0;
    const pMarkupPercent = (isFinite(roundedCost) && roundedCost > 0) ? (roundedProfit / roundedCost) * 100 : 0;

    let profitValid = false;
    if (product?.pricingMethod === 'fixed') profitValid = pPerPiece >= targetMarginVal;
    else if (product?.pricingMethod === 'markup') profitValid = pMarkupPercent >= targetMarginVal * 100;
    else profitValid = pMarginPercent >= targetMarginVal * 100;

    const dPrice = sPrice * 0.80;
    const preVatDP = dPrice / (1 + vPercent);
    const pIfDiscounted = dPrice - pPieceTotalCost;
    const mIfDiscounted = dPrice > 0 ? (pIfDiscounted / dPrice) * 100 : 0;

    const catTotals = {
      ingredients: 0,
      material: 0,
      packaging: 0,
      labor: 0,
      utilities: 0,
      overhead: 0,
      other: 0
    } as Record<string, number>;

    ['ingredients', 'material', 'packaging', 'labor', 'utilities', 'overhead', 'other'].forEach(cat => {
      catTotals[cat] = productIngredients
        .filter(pi => pi.costType === cat)
        .reduce((sum, pi) => sum + (getTrueUnitCost(pi) * (Number(pi.quantityUsed) || 0)), 0);
    });

    return {
      ingredientsTotal: iTotal || 0,
      otherCostsTotal: oTotal || 0,
      batchTotalCost: (iTotal + oTotal) || 0,
      perPieceIngredients: (iTotal / bSize) || 0,
      perPieceOther: (oTotal / bSize) || 0,
      perPieceTotalCost: pPieceTotalCost || 0,
      sellingPrice: isFinite(sPrice) ? sPrice : 0,
      priceBeforeVat: isFinite(pBeforeVat) ? pBeforeVat : 0,
      vatAmount: isFinite(vAmount) ? vAmount : 0,
      profitPerPiece: isFinite(pPerPiece) ? pPerPiece : 0,
      profitMarginPercent: isFinite(pMarginPercent) ? pMarginPercent : 0,
      priceMarkupPercent: isFinite(pMarkupPercent) ? pMarkupPercent : 0,
      isProfitValid: profitValid,
      discountedPrice: isFinite(dPrice) ? dPrice : 0,
      preVatDiscountedPrice: isFinite(preVatDP) ? preVatDP : 0,
      profitIfDiscounted: isFinite(pIfDiscounted) ? pIfDiscounted : 0,
      marginIfDiscounted: isFinite(mIfDiscounted) ? mIfDiscounted : 0,
      categoryTotals: catTotals
    };
  }, [product, productIngredients, goalRecord]);

  // Early returns — after ALL hooks and memos to satisfy Rules of Hooks
  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-50/20">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="mt-4 text-lg font-bold text-brand-900">Product not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <View className="mt-6 rounded-[32px] bg-brand-900 px-8 py-3">
            <Text className="font-bold text-white text-xs uppercase tracking-widest">Go Back</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  if (isLoadingCategories && productIngredients.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-50/20">
        <View className="items-center gap-6">
          <View className="w-20 h-20 bg-white rounded-full items-center justify-center shadow-lg shadow-brand-900/10 border border-brand-100">
            <Ionicons name="analytics" size={40} color="#14532d" />
          </View>
          <View className="items-center">
            <Text className="text-2xl font-black text-brand-900 tracking-tighter mb-2">Calculating Insights</Text>
            <Text className="text-[10px] font-bold text-brand-500 uppercase tracking-[3px]">Preparing Intelligence</Text>
          </View>
          <ActivityIndicator color="#14532d" size="small" />
        </View>
      </View>
    );
  }

  const progress = product.monthlyGoalProfit > 0
    ? Math.min((goalRecord.earnedSoFar / product.monthlyGoalProfit) * 100, 100)
    : 0;

  const remainingRevenue = Math.max(0, product.monthlyGoalProfit - goalRecord.earnedSoFar);
  
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(lastDayOfMonth - currentDay + 1, 1);
  const dailyRevenueNeeded = remainingRevenue / daysRemaining;
  const dailyItemsNeeded = sellingPrice > 0 ? Math.ceil(dailyRevenueNeeded / sellingPrice) : 0;

  const expectedTotalProfit = sellingPrice > 0 ? (product.monthlyGoalProfit / sellingPrice) * profitPerPiece : 0;

  const targetMargin = isFinite(Number(product.targetMargin)) ? Number(product.targetMargin) : 0;
  const vatPercent = isFinite(Number(product.vatPercent)) ? Number(product.vatPercent) : 0;
  const batchSize = Math.max(Number(product.batchSize || 1), 1);

  const targetLabel = product.pricingMethod === 'markup' ? 'Target markup'
    : product.pricingMethod === 'fixed' ? 'Target profit (fixed)'
      : 'Target margin';

  const targetValueFormatted = product.pricingMethod === 'fixed'
    ? formatMoney(targetMargin, currencyCode)
    : `${(targetMargin * 100).toFixed(2)}%`;

  const renderCompositionRow = (pi: any, key: string) => {
    const subtotal = (getTrueUnitCost(pi) * (Number(pi.quantityUsed) || 0));
    const uCost = getTrueUnitCost(pi);
    return (
      <View key={key} className="py-3 border-b border-brand-50">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-[13px] font-bold text-brand-900 flex-1 pr-2" numberOfLines={1}>{pi.ingredientName}</Text>
          <Text className="text-[13px] font-black text-brand-900">{formatMoney(subtotal, currencyCode)}</Text>
        </View>
        <View className="flex-row items-center gap-1 mt-0.5">
          <Text className="text-[10px] font-semibold text-brand-400">{pi.quantityUsed} {pi.ingredientUnit}</Text>
          <Text className="text-[10px] text-brand-300 mx-0.5">×</Text>
          <Text className="text-[10px] font-semibold text-brand-400">{formatMoney(uCost, currencyCode, 3)} / unit</Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1">
        <View style={{ height: 20 }} />
        <View className="px-5 pb-20">

          {/* Product Header */}
          <View className="mb-5 px-1">
            <Text className="text-[10px] font-bold text-brand-400 uppercase tracking-[3px] mb-1">{product.category}</Text>
            <Text className="text-[28px] font-black text-brand-900 tracking-tighter leading-tight">{product.name.toUpperCase()}</Text>
          </View>

          {/* ── Financial Scorecard ── */}
          <View className="mb-4 rounded-[28px] bg-brand-900 p-6 shadow-lg overflow-hidden">
            <Text className="text-[8px] font-black text-brand-500 uppercase tracking-[3px] mb-3">Selling Price · Inc. VAT</Text>
            
               <View className="flex-row items-center justify-between gap-3 mb-2">
                 <Text className="text-5xl font-black text-white tracking-tighter shrink leading-none">{formatMoney(sellingPrice, currencyCode)}</Text>
                 <Pressable onPress={() => { setPriceInput(String(sellingPrice)); setIsEditingPrice(true); }}>
                   <View className="bg-emerald-500/20 px-4 h-10 rounded-full flex-row items-center gap-1.5 border border-emerald-500/30">
                     <Ionicons name="create" size={16} color="#34d399" />
                     <Text className="text-[10px] uppercase tracking-widest font-black text-emerald-400">Edit</Text>
                   </View>
                 </Pressable>
               </View>

            <View className="flex-row items-center gap-2 mb-5">
              <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                <Text className="text-[11px] font-black text-emerald-400">+{formatMoney(profitPerPiece, currencyCode)} profit</Text>
              </View>
            </View>

            <View className="h-px bg-brand-800 mb-5" />

            {/* Margin / Markup */}
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1 bg-brand-800/70 p-4 rounded-2xl">
                <Text className="text-[8px] font-black text-brand-500 uppercase tracking-[2px] mb-1">Profit Margin</Text>
                <Text className="text-2xl font-black text-emerald-400">{profitMarginPercent.toFixed(1)}%</Text>
              </View>
              <View className="flex-1 bg-brand-800/70 p-4 rounded-2xl">
                <Text className="text-[8px] font-black text-brand-500 uppercase tracking-[2px] mb-1">Price Markup</Text>
                <Text className="text-2xl font-black text-emerald-400">{priceMarkupPercent.toFixed(1)}%</Text>
              </View>
            </View>

            {/* VAT breakdown row */}
            <View className="flex-row gap-2">
              <View className="flex-1 bg-brand-800/40 p-3 rounded-xl">
                <Text className="text-[8px] font-bold text-brand-500 uppercase tracking-widest mb-1">Pre-VAT</Text>
                <Text className="text-[13px] font-black text-brand-200">{formatMoney(priceBeforeVat, currencyCode)}</Text>
              </View>
              <View className="flex-1 bg-brand-800/40 p-3 rounded-xl">
                <Text className="text-[8px] font-bold text-brand-500 uppercase tracking-widest mb-1">VAT {(vatPercent * 100).toFixed(0)}%</Text>
                <Text className="text-[13px] font-black text-brand-200">{formatMoney(vatAmount, currencyCode)}</Text>
              </View>
              <View className="flex-1 bg-brand-800/40 p-3 rounded-xl">
                <Text className="text-[8px] font-bold text-brand-500 uppercase tracking-widest mb-1">Unit Cost</Text>
                <Text className="text-[13px] font-black text-brand-200">{formatMoney(perPieceTotalCost, currencyCode)}</Text>
              </View>
            </View>
          </View>

          {/* ── Monthly Goal Progress ── */}
          <View className="mb-4 rounded-[24px] bg-white border border-brand-100 overflow-hidden shadow-sm">
            <Pressable onPress={() => setIsGoalExpanded(!isGoalExpanded)} className="px-5 pt-5 pb-5">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-[8px] font-black text-brand-400 uppercase tracking-[3px]">Monthly Goal Progress</Text>
                <Ionicons name={isGoalExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#4ade80" />
              </View>

              <View className="flex-row items-end justify-between mb-3">
                <View>
                  <Text className="text-[10px] font-semibold text-brand-400 mb-0.5">Revenue this month</Text>
                  <Text className="text-2xl font-black text-brand-900">{formatMoney(goalRecord.earnedSoFar, currencyCode)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] font-semibold text-brand-400 mb-0.5">Revenue goal</Text>
                  <Text className="text-sm font-black text-brand-900">{formatMoney(product.monthlyGoalProfit, currencyCode)}</Text>
                </View>
              </View>
              <View className="h-2.5 bg-brand-50 rounded-full overflow-hidden">
                <View className="h-full bg-brand-900 rounded-full" style={{ width: `${progress}%` as any }} />
              </View>
              <Text className="text-[10px] font-semibold text-brand-400 mt-2 text-right mb-4">{progress.toFixed(0)}% complete</Text>

              {product.monthlyGoalProfit > 0 && (
                <View className="mb-2">
                  <View className="flex-row items-center justify-between rounded-2xl bg-brand-50/50 border border-brand-100 p-3">
                    <View>
                      <Text className="text-[9px] font-black text-brand-400 uppercase tracking-[2px] mb-1">Target for next {daysRemaining} days</Text>
                      {remainingRevenue > 0 ? (
                         <Text className="text-[13px] font-black text-brand-950">Sell {dailyItemsNeeded} item{dailyItemsNeeded !== 1 ? 's' : ''} / day</Text>
                      ) : (
                         <Text className="text-[13px] font-black text-emerald-600">Revenue Goal Met! 🎉</Text>
                      )}
                    </View>
                    {remainingRevenue > 0 && (
                      <View className="items-end">
                        <Text className="text-[9px] font-black text-brand-400 uppercase tracking-widest mb-1">Pace needed</Text>
                        <Text className="text-xs font-black text-brand-900">{formatMoney(dailyRevenueNeeded, currencyCode)} / day</Text>
                      </View>
                    )}
                  </View>
                  
                  <View className="mt-2 flex-row items-center justify-between rounded-2xl bg-brand-50/50 border border-brand-100 p-3">
                    <View className="flex-1">
                       <Text className="text-[9px] font-black text-brand-400 uppercase tracking-[2px] mb-1">Projected Net Profit</Text>
                       <Text className="text-xs font-black text-brand-950">If revenue goal is met</Text>
                    </View>
                    <View className="items-end">
                       <Text className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Expected</Text>
                       <Text className="text-sm font-black text-emerald-600">+{formatMoney(expectedTotalProfit, currencyCode)}</Text>
                    </View>
                  </View>
                </View>
              )}
            </Pressable>
              
            {isGoalExpanded && (
              <View className="px-5 pb-5">
                <View className="pt-5 border-t border-brand-50">
                  <Text className="text-[10px] font-bold text-brand-900 uppercase tracking-widest mb-2">Set New Target ({currencyCode})</Text>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1 h-12 px-4 rounded-2xl bg-brand-50/50 border border-brand-100 justify-center">
                      <TextInput
                        className="text-sm font-black text-brand-950 p-0"
                        keyboardType="decimal-pad"
                        value={goalInput}
                        onChangeText={setGoalInput}
                        placeholder="0.00"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    <Pressable
                      onPress={handleSaveGoal}
                      disabled={isSavingGoal}
                    >
                      <View className={`h-12 px-6 items-center justify-center rounded-2xl bg-brand-900 ${isSavingGoal ? 'opacity-70' : ''}`}>
                         {isSavingGoal ? <ActivityIndicator color="#fff" size="small" /> : <Text className="font-black text-white text-xs uppercase tracking-widest">Save</Text>}
                      </View>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* ── Setup Configuration ── */}
          <View className="mb-4 rounded-[24px] bg-white border border-brand-100 overflow-hidden shadow-sm">
            <View className="px-5 pt-5 pb-5">
              <Text className="text-[8px] font-black text-brand-400 uppercase tracking-[3px] mb-4">Setup Configuration</Text>
              <SummaryRow label="Batch production qty" value={`${batchSize} pcs`} />
              <View className="h-px bg-brand-50 my-2.5" />
              <SummaryRow label={targetLabel} value={targetValueFormatted} />
              <View className="h-px bg-brand-50 my-2.5" />
              <SummaryRow label="VAT rate" value={`${(vatPercent * 100).toFixed(0)}%`} />
            </View>
          </View>

          {/* ── Composition Groups ── */}
          {categoryTotals && ['ingredients', 'material', 'packaging', 'labor', 'utilities', 'overhead', 'other'].map((catType) => {
            const groupItems = productIngredients.filter(pi => pi.costType === catType);
            if (groupItems.length === 0) return null;
            return (
              <View key={catType} className="mb-4 rounded-[24px] bg-white border border-brand-100 overflow-hidden shadow-sm">
                <View className="px-5 pt-5 pb-5">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-[8px] font-black text-brand-400 uppercase tracking-[3px]">{catType}</Text>
                    <Text className="text-[10px] font-semibold text-brand-300">{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <View className="mt-2">
                    {groupItems.map((pi) => renderCompositionRow(pi, `${pi.id}`))}
                  </View>
                  <View className="mt-4 pt-1 flex-row items-center justify-between">
                    <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">{catType} subtotal</Text>
                    <Text className="text-base font-black text-brand-900">{formatMoney(categoryTotals?.[catType] || 0, currencyCode)}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* ── Direct Base Cost ── */}
          {product.baseCost > 0 && (
            <View className="mb-4 rounded-[24px] bg-white border border-brand-100 overflow-hidden shadow-sm">
              <View className="px-5 pt-5 pb-5">
                <Text className="text-[8px] font-black text-brand-400 uppercase tracking-[3px] mb-4">Direct Base Cost</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-brand-500">Pre-made / Wholesale Item Cost</Text>
                  <Text className="text-base font-black text-brand-900">{formatMoney(product.baseCost, currencyCode)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Per Batch & Per Piece (side-by-side) ── */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 rounded-[24px] bg-white border border-brand-100 overflow-hidden shadow-sm">
              <View className="bg-brand-900 px-4 py-3">
                <Text className="text-[8px] font-black text-white uppercase tracking-[2px] text-center">Per Batch</Text>
              </View>
              <View className="p-4 gap-2">
                {Object.entries(categoryTotals || {}).map(([cat, val]) => {
                  if (val <= 0) return null;
                  return (
                    <SummaryRow key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} value={formatMoney(val, currencyCode)} />
                  );
                })}
                <View className="h-px bg-brand-50 my-1" />
                <SummaryRow label="Total" value={formatMoney(batchTotalCost, currencyCode)} isStrong />
              </View>
            </View>

            <View className="flex-1 rounded-[24px] bg-white border border-brand-100 overflow-hidden shadow-sm">
              <View className="bg-brand-900 px-4 py-3">
                <Text className="text-[8px] font-black text-white uppercase tracking-[2px] text-center">Per Piece</Text>
              </View>
              <View className="p-4 gap-2">
                {Object.entries(categoryTotals || {}).map(([cat, val]) => {
                  if (val <= 0) return null;
                  return (
                    <SummaryRow key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} value={formatMoney(val / batchSize, currencyCode)} />
                  );
                })}
                <View className="h-px bg-brand-50 my-1" />
                <SummaryRow label="Total" value={formatMoney(perPieceTotalCost, currencyCode)} isStrong />
              </View>
            </View>
          </View>

          {/* ── Special Discount (PWD / Senior) ── */}
          <View className="mb-4 rounded-[24px] bg-white border border-amber-100 overflow-hidden shadow-sm">
            <View className="bg-amber-600 px-5 py-3">
              <Text className="text-[8px] font-black text-amber-100 uppercase tracking-[3px]">Special Discount · PWD / Senior — 20% off</Text>
            </View>
            <View className="p-5 gap-2">
              <SummaryRow label="Discounted price" value={formatMoney(discountedPrice, currencyCode)} />
              <View className="h-px bg-brand-50 my-1" />
              <SummaryRow
                label="Profit if discounted"
                value={formatMoney(profitIfDiscounted, currencyCode)}
                color={profitIfDiscounted > 0 ? 'text-emerald-700 font-black text-sm' : 'text-red-500 font-black text-sm'}
              />
              <SummaryRow
                label="Margin if discounted"
                value={`${marginIfDiscounted.toFixed(1)}%`}
                color={marginIfDiscounted > 0 ? 'text-emerald-700 font-black text-sm' : 'text-red-500 font-black text-sm'}
              />
            </View>
          </View>

        </View>
      </ScrollView>

      <Modal visible={isEditingPrice} transparent animationType="fade">
        <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View className="bg-white w-full rounded-[32px] p-6 shadow-2xl pb-8 top-[-5%]">
            <View className="items-center mb-6">
              <Text className="text-xl font-black text-brand-900 mb-1">Custom Selling Price</Text>
              <Text className="text-[10px] font-bold text-brand-400 text-center uppercase tracking-widest mt-1">
                Enter 0 to restore MarginIQ auto-calculations
              </Text>
            </View>

            <View className="flex-row items-center bg-emerald-50/50 rounded-[24px] py-4 px-2 border border-emerald-100 mb-8">
              <Text className="text-3xl font-black text-emerald-700 pl-4 pr-1">{getCurrencySymbol(currencyCode)}</Text>
              <TextInput
                className="text-5xl font-black text-emerald-900 p-0 flex-1 tracking-tighter h-[55px]"
                keyboardType="decimal-pad"
                value={priceInput}
                onChangeText={setPriceInput}
                autoFocus
                selectTextOnFocus
              />
            </View>

            <View className="flex-row gap-3">
              <Pressable className="flex-1" onPress={() => setIsEditingPrice(false)}>
                <View className="h-14 items-center justify-center rounded-[20px] bg-red-50 border border-red-100">
                  <Text className="font-bold text-red-500 uppercase tracking-widest text-[11px]">Cancel</Text>
                </View>
              </Pressable>
              <Pressable
                className="flex-[1.5]"
                onPress={async () => {
                  if (isSavingPrice || !product) return;
                  setIsSavingPrice(true);
                  await editProduct(product.id, { sellingPrice: Number(priceInput) || 0 });
                  setIsSavingPrice(false);
                  setIsEditingPrice(false);
                }}
              >
                <View className="h-14 items-center justify-center rounded-[20px] bg-emerald-500 flex-row gap-2 shadow-sm shadow-emerald-500/30">
                  {isSavingPrice ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text className="font-black text-white uppercase tracking-widest text-[11px]">Save Price</Text>
                    </>
                  )}
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

function SummaryRow({
  label,
  value,
  isStrong,
  color,
}: {
  label: string;
  value: string;
  isStrong?: boolean;
  color?: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text
        className={`flex-1 pr-2 ${isStrong
            ? 'text-[11px] font-black text-brand-900 uppercase tracking-tight'
            : 'text-[11px] font-semibold text-brand-500'
          }`}
      >
        {label}
      </Text>
      <Text
        className={`text-right ${color ?? (isStrong ? 'text-sm font-black text-brand-900' : 'text-sm font-bold text-brand-900')
          }`}
      >
                {value}
      </Text>
    </View>
  );
}
