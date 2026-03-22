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
  calculateTargetProfit,
} from '../utils/formulas';
import { formatMoney } from '../utils/currency';
import { getCurrentMonth, isValidMonth } from '../utils/month';
import { useSettingsStore } from '../stores/settingsStore';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';

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

  const monthlySales = useSalesStore((state) => state.monthlySales);
  const loadMonthlySales = useSalesStore((state) => state.loadMonthlySales);
  const saveMonthlySale = useSalesStore((state) => state.saveMonthlySale);
  const removeMonthlySale = useSalesStore((state) => state.removeMonthlySale);
  const getMonthlySale = useSalesStore((state) => state.getMonthlySale);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());
  const [unitsSoldInput, setUnitsSoldInput] = useState('');
  const [unitsUnsoldInput, setUnitsUnsoldInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const existingEntry = useMemo(() => {
    return selectedProductId ? getMonthlySale(selectedProductId, month.trim()) : undefined;
  }, [getMonthlySale, month, selectedProductId]);

  useEffect(() => {
    if (existingEntry) {
      setUnitsSoldInput(String(existingEntry.unitsSold));
      setUnitsUnsoldInput(String(existingEntry.unitsUnsold));
    } else {
      setUnitsSoldInput('');
      setUnitsUnsoldInput('');
    }
  }, [existingEntry?.id, selectedProductId, month]);

  const selectedProduct = selectedProductId ? getProductById(selectedProductId) : undefined;
  const breakdown = selectedProductId ? getProductCostBreakdown(selectedProductId) : null;

  const unitsSold = parseUnits(unitsSoldInput);
  const unitsUnsold = parseUnits(unitsUnsoldInput);
  const unitsProduced = unitsSold + unitsUnsold;

  const sellingPrice = selectedProduct?.sellingPrice ?? 0;
  const costPerPiece = breakdown?.totalCost ?? 0;

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
    if (!selectedProductId || !isValidMonth(month) || unitsProduced <= 0 || costPerPiece <= 0) {
      Alert.alert('Incomplete Data', 'Please check product, month, and unit counts.');
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
      Alert.alert('Success', 'Sales record updated.');
    } catch {
      Alert.alert('Error', 'Failed to save sales data.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Record', 'Permanently delete this sales record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeMonthlySale(id) },
    ]);
  };

  return (
    <View className="flex-1 bg-white">

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">

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

          <FormSection title="Month & Performance" icon="calendar">
            <Text className="text-[10px] font-black text-brand-600 uppercase mb-2 tracking-widest px-1">Period (YYYY-MM)</Text>
            <TextInput
              value={month}
              onChangeText={setMonth}
              placeholder="2026-03"
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

          <FormSection title="Real-Time Analytics" icon="stats-chart">
            <View className="gap-3">
              <SummaryRow label="Revenue Earned" value={formatMoney(actualRevenue, currencyCode)} />
              <SummaryRow label="Production Cost" value={formatMoney(actualCost, currencyCode)} />
              <View className="h-px bg-brand-50 my-1" />
              <SummaryRow label="Net Profit" value={formatMoney(actualProfit, currencyCode)} isStrong />
              <SummaryRow label="Profit Margin" value={`${actualMarginPercent.toFixed(1)}%`} isStrong />
            </View>
          </FormSection>

          <View className="mt-4 gap-4 pb-20">
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
            >
              <View className={`h-16 items-center justify-center rounded-[32px] bg-brand-900 shadow-lg ${isSaving ? 'opacity-70' : ''}`}>
                <Text className="font-black text-white text-sm tracking-widest uppercase">
                  {isSaving ? 'Recording...' : existingEntry ? 'Update Entry' : 'Log Monthly Sales'}
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
                    <Text className="text-sm font-black text-brand-950">{entry.month}</Text>
                    <Text className="text-[10px] text-brand-600 font-bold uppercase tracking-tighter">
                      Profit: {formatMoney(entry.actualProfit, currencyCode)}
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