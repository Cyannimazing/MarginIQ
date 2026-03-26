import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useGoalStore } from '../stores/goalStore';
import { useProductStore } from '../stores/productStore';
import { useSalesStore } from '../stores/salesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';

type PeriodPreset = 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'this_year';
type Props = NativeStackScreenProps<RootStackParamList, 'Analytics'>;

const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3m', label: 'Last 3M' },
  { key: 'last_6m', label: 'Last 6M' },
  { key: 'this_year', label: 'This Year' },
];

const roundTo = (value: number, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

function mk(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function normMonth(m: string) {
  return m.match(/^\d{4}-\d{2}-\d{2}$/) ? m.substring(0, 7) : m;
}

function periodMonthsFor(preset: PeriodPreset): string[] {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = now.getMonth();
  switch (preset) {
    case 'this_month':
      return [mk(yr, mo)];
    case 'last_month': {
      const d = new Date(yr, mo - 1, 1);
      return [mk(d.getFullYear(), d.getMonth())];
    }
    case 'last_3m':
      return Array.from({ length: 3 }, (_, i) => {
        const d = new Date(yr, mo - i, 1);
        return mk(d.getFullYear(), d.getMonth());
      });
    case 'last_6m':
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(yr, mo - i, 1);
        return mk(d.getFullYear(), d.getMonth());
      });
    case 'this_year':
      return Array.from({ length: mo + 1 }, (_, i) => mk(yr, i));
  }
}

export function AnalyticsScreen({ navigation: _navigation }: Props) {
  const products = useProductStore((s) => s.products);
  const loadProducts = useProductStore((s) => s.loadProducts);
  const monthlySales = useSalesStore((s) => s.monthlySales);
  const loadMonthlySales = useSalesStore((s) => s.loadMonthlySales);
  const salesError = useSalesStore((s) => s.error);
  const monthlyGoals = useGoalStore((s) => s.monthlyGoals);
  const loadMonthlyGoals = useGoalStore((s) => s.loadMonthlyGoals);
  const currencyCode = useSettingsStore((s) => s.settings.currencyCode);

  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<PeriodPreset>('this_month');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [periodPickerVisible, setPeriodPickerVisible] = useState(false);

  useEffect(() => {
    void loadProducts();
    void loadMonthlySales();
    void loadMonthlyGoals();
  }, [loadProducts, loadMonthlySales, loadMonthlyGoals]);

  const periodMonths = useMemo(() => periodMonthsFor(period), [period]);
  const periodLabel = PERIOD_PRESETS.find((p) => p.key === period)?.label ?? '';

  // All sales entries within the selected period + product filter
  const filteredSales = useMemo(
    () =>
      monthlySales.filter((s) => {
        const m = normMonth(s.month);
        return (
          periodMonths.includes(m) &&
          (selectedProductId === null || s.productId === selectedProductId)
        );
      }),
    [monthlySales, periodMonths, selectedProductId],
  );

  // Monthly breakdown for bar chart (oldest → newest)
  const monthlyAggs = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; cost: number; profit: number }>();
    for (const s of filteredSales) {
      const m = normMonth(s.month);
      const cur = map.get(m) ?? { month: m, revenue: 0, cost: 0, profit: 0 };
      cur.revenue += s.actualRevenue;
      cur.cost += s.actualCost;
      cur.profit += s.actualProfit;
      map.set(m, cur);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredSales]);

  // P&L totals — COGS is the actual ingredient/production cost, NOT revenue minus profit
  const totalRevenue = useMemo(() => filteredSales.reduce((s, e) => s + e.actualRevenue, 0), [filteredSales]);
  // ingredientCost = pure production cost (no overhead). Falls back to actualCost for old records.
  const totalCOGS = useMemo(() => filteredSales.reduce((s, e) => s + (e.ingredientCost > 0 ? e.ingredientCost : e.actualCost), 0), [filteredSales]);
  const totalGrossProfit = totalRevenue - totalCOGS;

  // Overhead from stored snapshots per unique (productId, month) — avoids retroactive changes
  // when the user updates their monthly overhead setting in the future.
  const totalFixedOverhead = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    for (const s of filteredSales) {
      const key = `${s.productId}-${normMonth(s.month)}`;
      if (!seen.has(key)) {
        seen.add(key);
        total += s.overheadCost;
      }
    }
    return total;
  }, [filteredSales]);
  const totalNetProfit = totalGrossProfit - totalFixedOverhead;
  const netMargin = totalRevenue > 0 ? roundTo((totalNetProfit / totalRevenue) * 100) : 0;
  const totalUnitsSold = useMemo(() => filteredSales.reduce((s, e) => s + e.unitsSold, 0), [filteredSales]);
  const avgMonthlyProfit =
    monthlyAggs.length > 0 ? totalNetProfit / monthlyAggs.length : 0;

  // Current month goal (always the real current month, not tied to period)
  const now = new Date();
  const currentMonthKey = mk(now.getFullYear(), now.getMonth());
  const currentGoal = monthlyGoals.find((g) => g.month === currentMonthKey);
  const goalTarget = currentGoal?.targetProfit ?? 0;
  const goalEarned = currentGoal?.earnedSoFar ?? 0;
  const goalRemaining = Math.max(goalTarget - goalEarned, 0);
  const goalPct = goalTarget > 0 ? Math.min((goalEarned / goalTarget) * 100, 100) : 0;

  // Product breakdown for the period
  const productBreakdown = useMemo(() => {
    const map = new Map<
      number,
      { name: string; revenue: number; cost: number; profit: number; units: number }
    >();
    for (const s of filteredSales) {
      const prod = products.find((p) => p.id === s.productId);
      const cur = map.get(s.productId) ?? {
        name: prod?.name ?? `#${s.productId}`,
        revenue: 0,
        cost: 0,
        profit: 0,
        units: 0,
      };
      cur.revenue += s.actualRevenue;
      cur.cost += s.ingredientCost > 0 ? s.ingredientCost : s.actualCost;
      cur.profit += s.actualProfit;
      cur.units += s.unitsSold;
      map.set(s.productId, cur);
    }
    return [...map.values()].sort((a, b) => b.profit - a.profit);
  }, [filteredSales, products]);

  // Sales health (discounts + waste losses)
  const salesHealth = useMemo(() => {
    let discountedUnits = 0;
    let revenueLost = 0;
    let unsoldUnits = 0;
    let costWasted = 0;
    for (const s of filteredSales) {
      const prod = products.find((p) => p.id === s.productId);
      discountedUnits += s.unitsSoldDiscounted;
      unsoldUnits += s.unitsUnsold;
      if (prod) revenueLost += s.unitsSoldDiscounted * prod.sellingPrice * prod.discountPercent;
      const total = s.unitsSold + s.unitsUnsold;
      if (total > 0) costWasted += (s.unitsUnsold / total) * s.actualCost;
    }
    return { discountedUnits, revenueLost, unsoldUnits, costWasted };
  }, [filteredSales, products]);

  const hasData = filteredSales.length > 0;
  const maxBarProfit = Math.max(...monthlyAggs.map((a) => Math.abs(a.profit)), 1);
  const activeProducts = products.filter((p) => !p.isArchived);

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-28">
        <View style={{ height: 20 }} />

        {/* Period Dropdown */}
        <Pressable
          onPress={() => setPeriodPickerVisible(true)}
          className="mb-3 flex-row items-center justify-between rounded-[24px] border border-brand-100 bg-white px-5 py-3.5 shadow-sm"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={16} color="#14532d" />
            <Text className="text-sm font-black text-brand-900">
              {PERIOD_PRESETS.find((p) => p.key === period)?.label ?? 'This Month'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#94a3b8" />
        </Pressable>

        <Modal
          visible={periodPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPeriodPickerVisible(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
            onPress={() => setPeriodPickerVisible(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={{ backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 20, paddingBottom: Math.max(insets.bottom, 40) }}>
                <View className="w-10 h-1 rounded-full bg-brand-100 self-center mb-5" />
                <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">
                  Select Period
                </Text>
                {PERIOD_PRESETS.map((opt) => (
                  <Pressable
                    key={opt.key}
                    onPress={() => { setPeriod(opt.key); setPeriodPickerVisible(false); }}
                    className={`flex-row items-center justify-between px-4 py-4 rounded-2xl mb-2 ${
                      period === opt.key ? 'bg-brand-900' : 'bg-brand-50 border border-brand-100'
                    }`}
                  >
                    <Text className={`text-sm font-black ${period === opt.key ? 'text-white' : 'text-brand-900'}`}>
                      {opt.label}
                    </Text>
                    {period === opt.key && (
                      <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Product Dropdown */}
        {activeProducts.length > 0 && (
          <>
            <Pressable
              onPress={() => setProductPickerVisible(true)}
              className="mb-5 flex-row items-center justify-between rounded-[24px] border border-brand-100 bg-white px-5 py-3.5 shadow-sm"
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="storefront-outline" size={16} color="#14532d" />
                <Text className="text-sm font-black text-brand-900" numberOfLines={1}>
                  {selectedProductId === null
                    ? 'All Products'
                    : activeProducts.find((p) => p.id === selectedProductId)?.name ?? 'All Products'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#94a3b8" />
            </Pressable>

            <Modal
              visible={productPickerVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setProductPickerVisible(false)}
            >
              <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
                onPress={() => setProductPickerVisible(false)}
              >
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <View style={{ backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 20, paddingBottom: Math.max(insets.bottom, 40) }}>
                    <View className="w-10 h-1 rounded-full bg-brand-100 self-center mb-5" />
                    <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">
                      Select Product
                    </Text>

                    {/* All Products option */}
                    <Pressable
                      onPress={() => { setSelectedProductId(null); setProductPickerVisible(false); }}
                      className={`flex-row items-center justify-between px-4 py-4 rounded-2xl mb-2 ${
                        selectedProductId === null ? 'bg-brand-900' : 'bg-brand-50 border border-brand-100'
                      }`}
                    >
                      <Text className={`text-sm font-black ${selectedProductId === null ? 'text-white' : 'text-brand-900'}`}>
                        All Products
                      </Text>
                      {selectedProductId === null && (
                        <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                      )}
                    </Pressable>

                    {activeProducts.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => { setSelectedProductId(p.id); setProductPickerVisible(false); }}
                        className={`flex-row items-center justify-between px-4 py-4 rounded-2xl mb-2 ${
                          selectedProductId === p.id ? 'bg-brand-900' : 'bg-brand-50 border border-brand-100'
                        }`}
                      >
                        <Text
                          className={`text-sm font-black flex-1 mr-2 ${selectedProductId === p.id ? 'text-white' : 'text-brand-900'}`}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                        {selectedProductId === p.id && (
                          <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          </>
        )}

        {/* Empty state */}
        {!hasData ? (
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full bg-brand-50 items-center justify-center mb-4">
              <Ionicons name="bar-chart-outline" size={28} color="#14532d" />
            </View>
            <Text className="text-sm font-black text-brand-600 text-center">
              No sales logged for {periodLabel}
            </Text>
            <Text className="text-xs font-bold text-brand-300 text-center mt-1">
              Log sales in the Sales Logger to see your analytics here.
            </Text>
          </View>
        ) : (
          <>
            {/* ─── P&L Hero Card ─── */}
            <View className="mb-4 rounded-[32px] bg-brand-900 p-6">
              <View className="flex-row items-start justify-between mb-1">
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#4ade80', letterSpacing: 2, textTransform: 'uppercase' }}>
                    P&L Summary
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#bbf7d0', marginTop: 3 }}>
                    {periodLabel}
                    {selectedProductId
                      ? ` · ${products.find((p) => p.id === selectedProductId)?.name}`
                      : ' · All Products'}
                  </Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: netMargin >= 0 ? '#4ade80' : '#f87171' }}>
                    {netMargin >= 0 ? '+' : ''}{netMargin}% margin
                  </Text>
                </View>
              </View>

              {/* Bar chart — only shown when there are multiple months */}
              {monthlyAggs.length > 1 && (
                <View
                  className="flex-row items-end mt-5 mb-6"
                  style={{ height: 72, gap: 4 }}
                >
                  {monthlyAggs.map((item) => {
                    const barH = Math.max((Math.abs(item.profit) / maxBarProfit) * 64, 4);
                    const isPos = item.profit >= 0;
                    return (
                      <View key={item.month} className="flex-1 items-center">
                        <View
                          style={{
                            height: barH,
                            borderRadius: 6,
                            backgroundColor: isPos ? '#4ade80' : '#f87171',
                            width: '100%',
                            marginBottom: 4,
                          }}
                        />
                        <Text style={{ fontSize: 7, fontWeight: '900', color: '#bbf7d0' }}>
                          {item.month.substring(5)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {monthlyAggs.length <= 1 && <View style={{ height: 20 }} />}

              {/* Line items */}
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#bbf7d0' }}>Gross Revenue</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#ffffff' }}>
                    {formatMoney(totalRevenue, currencyCode)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#bbf7d0' }}>Cost of Goods Sold</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#fca5a5' }}>
                    − {formatMoney(totalCOGS, currencyCode)}
                  </Text>
                </View>

                <View style={{ height: 1, backgroundColor: 'rgba(187,247,208,0.2)' }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#bbf7d0' }}>Gross Profit</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#ffffff' }}>
                    {formatMoney(totalGrossProfit, currencyCode)}
                  </Text>
                </View>

                {totalFixedOverhead > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#bbf7d0' }}>
                      Operating Overhead
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#fca5a5' }}>
                      − {formatMoney(totalFixedOverhead, currencyCode)}
                    </Text>
                  </View>
                )}

                <View style={{ height: 1, backgroundColor: 'rgba(187,247,208,0.2)' }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Net Profit
                  </Text>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: totalNetProfit >= 0 ? '#4ade80' : '#f87171' }}>
                    {formatMoney(totalNetProfit, currencyCode)}
                  </Text>
                </View>
              </View>
            </View>

            {/* ─── Quick KPIs ─── */}
            <View className="mb-5 rounded-[24px] border border-brand-100 bg-white shadow-sm overflow-hidden">
              <View className="flex-row items-center justify-between px-5 py-4">
                <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Units Sold</Text>
                <Text className="text-base font-black text-brand-900">{totalUnitsSold} units</Text>
              </View>
              <View className="h-px bg-brand-50" />
              {monthlyAggs.length > 1 && (
                <>
                  <View className="flex-row items-center justify-between px-5 py-4">
                    <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Avg Profit / Month</Text>
                    <Text className="text-base font-black text-brand-900">{formatMoney(avgMonthlyProfit, currencyCode)}</Text>
                  </View>
                  <View className="h-px bg-brand-50" />
                </>
              )}
              <View className="flex-row items-center justify-between px-5 py-4">
                <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Net Margin</Text>
                <Text className={`text-base font-black ${netMargin >= 0 ? 'text-brand-900' : 'text-red-500'}`}>{netMargin}%</Text>
              </View>
              <View className="h-px bg-brand-50" />
              <View className="flex-row items-center justify-between px-5 py-4">
                <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Net Profit / Unit</Text>
                <Text className="text-base font-black text-brand-900">
                  {totalUnitsSold > 0 ? formatMoney(totalNetProfit / totalUnitsSold, currencyCode) : '—'}
                </Text>
              </View>
            </View>

            {/* ─── Per-product detail when a product is selected ─── */}
            {selectedProductId !== null && (() => {
              const prod = products.find((p) => p.id === selectedProductId);
              const pd = productBreakdown[0];
              if (!prod || !pd) return null;
              const cogs = pd.cost;
              const grossP = pd.revenue - pd.cost;
              // Overhead from stored snapshots — same logic as main P&L
              const overhead = (() => {
                const seen = new Set<string>();
                let total = 0;
                for (const s of filteredSales) {
                  const key = normMonth(s.month);
                  if (!seen.has(key)) { seen.add(key); total += s.overheadCost; }
                }
                return total;
              })();
              const netP = grossP - overhead;
              const margin = pd.revenue > 0 ? roundTo((netP / pd.revenue) * 100) : 0;
              return (
                <View className="mb-5 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Product Detail</Text>
                    <View className="bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
                      <Text className="text-[10px] font-black text-brand-700 uppercase tracking-widest" numberOfLines={1}>{prod.name}</Text>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    <View className="flex-row justify-between">
                      <Text className="text-xs font-bold text-brand-500">Revenue</Text>
                      <Text className="text-xs font-black text-brand-900">{formatMoney(pd.revenue, currencyCode)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-xs font-bold text-brand-500">Cost of Goods</Text>
                      <Text className="text-xs font-black text-red-500">− {formatMoney(cogs, currencyCode)}</Text>
                    </View>
                    <View className="h-px bg-brand-50" />
                    <View className="flex-row justify-between">
                      <Text className="text-xs font-bold text-brand-500">Gross Profit</Text>
                      <Text className="text-xs font-black text-brand-900">{formatMoney(grossP, currencyCode)}</Text>
                    </View>
                    {overhead > 0 && (
                      <View className="flex-row justify-between">
                        <Text className="text-xs font-bold text-brand-500">Operating Overhead</Text>
                        <Text className="text-xs font-black text-red-500">− {formatMoney(overhead, currencyCode)}</Text>
                      </View>
                    )}
                    <View className="h-px bg-brand-50" />
                    <View className="flex-row justify-between items-center">
                      <Text className="text-sm font-black text-brand-900 uppercase tracking-wide">Net Profit</Text>
                      <Text className={`text-xl font-black ${netP >= 0 ? 'text-emerald-700' : 'text-red-500'}`}>
                        {formatMoney(netP, currencyCode)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>Units Sold</Text>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#0f172a' }}>{pd.units} units</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>Net Margin</Text>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: margin >= 0 ? '#15803d' : '#ef4444' }}>{margin}%</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>Net Profit / Unit</Text>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#0f172a' }}>
                        {pd.units > 0 ? formatMoney(netP / pd.units, currencyCode) : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* ─── Goal Progress (always current month) ─── */}
            {goalTarget > 0 && (
              <View className="mb-5 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">
                    Monthly Goal
                  </Text>
                  <Text className="text-[10px] font-bold text-brand-400">{currentMonthKey}</Text>
                </View>

                <View className="flex-row justify-between items-end mb-4">
                  <View>
                    <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">
                      Earned
                    </Text>
                    <Text className="text-2xl font-black text-brand-900">
                      {formatMoney(goalEarned, currencyCode)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">
                      Target
                    </Text>
                    <Text className="text-lg font-black text-brand-500">
                      {formatMoney(goalTarget, currencyCode)}
                    </Text>
                  </View>
                </View>

                <View className="h-3 rounded-full bg-brand-50 overflow-hidden mb-2">
                  <View
                    className="h-full rounded-full bg-brand-900"
                    style={{ width: `${goalPct}%` }}
                  />
                </View>

                <View className="flex-row justify-between items-center mt-1">
                  <Text className="text-[10px] font-black text-brand-500 uppercase tracking-widest">
                    {goalPct.toFixed(0)}% achieved
                  </Text>
                  {goalRemaining > 0 ? (
                    <Text className="text-[10px] font-bold text-brand-400">
                      {formatMoney(goalRemaining, currencyCode)} remaining
                    </Text>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text className="text-[10px] font-black text-green-600 uppercase tracking-widest">
                        Goal Met!
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ─── Product Breakdown ─── */}
            {productBreakdown.length > 0 && !selectedProductId && (
              <View className="mb-5 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
                <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">
                  Per Product
                </Text>
                <Text className="text-[11px] font-bold text-brand-300 mb-4">Select a product above for detailed analysis</Text>

                {productBreakdown.map((item, i) => {
                  const margin =
                    item.revenue > 0 ? roundTo((item.profit / item.revenue) * 100) : 0;
                  const maxP = Math.max(
                    ...productBreakdown.map((p) => Math.abs(p.profit)),
                    1,
                  );
                  const barW = Math.max((Math.abs(item.profit) / maxP) * 100, 4);
                  const isTop = i === 0 && productBreakdown.length > 1;
                  return (
                    <View
                      key={i}
                      className={`py-4 ${i !== 0 ? 'border-t border-brand-50' : ''}`}
                    >
                      <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center flex-1 mr-2">
                          <Text
                            className="text-sm font-black text-brand-900 flex-1"
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          {isTop && (
                            <View className="ml-2 bg-brand-100 px-2 py-0.5 rounded-full">
                              <Text className="text-[8px] font-black text-brand-700 uppercase">
                                Top
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          className={`text-sm font-black ${
                            item.profit >= 0 ? 'text-emerald-700' : 'text-red-500'
                          }`}
                        >
                          {formatMoney(item.profit, currencyCode)}
                        </Text>
                      </View>

                      <View className="h-1.5 rounded-full bg-brand-50 mb-2 overflow-hidden">
                        <View
                          className={`h-full rounded-full ${item.profit >= 0 ? 'bg-brand-900' : 'bg-red-400'}`}
                          style={{ width: `${barW}%` }}
                        />
                      </View>

                      <View className="flex-row justify-between">
                        <Text className="text-[10px] font-bold text-brand-400">
                          {item.units} units · {formatMoney(item.revenue, currencyCode)} rev
                        </Text>
                        <Text className="text-[10px] font-black text-brand-500">
                          {margin}% margin
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ─── Sales Health — only shown if there are actual losses ─── */}
            {(salesHealth.unsoldUnits > 0 || salesHealth.discountedUnits > 0) && (
              <View className="mb-5 rounded-[32px] border border-red-100 bg-red-50/50 p-6">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                    Sales Losses
                  </Text>
                  <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                </View>

                {salesHealth.discountedUnits > 0 && (
                  <View
                    className={`flex-row justify-between items-center py-3 ${
                      salesHealth.unsoldUnits > 0 ? 'border-b border-red-100' : ''
                    }`}
                  >
                    <View>
                      <Text className="text-xs font-black text-brand-900">Discounted Sales</Text>
                      <Text className="text-[10px] font-bold text-brand-400">
                        {salesHealth.discountedUnits} units at reduced price
                      </Text>
                    </View>
                    <Text className="text-sm font-black text-red-500">
                      − {formatMoney(salesHealth.revenueLost, currencyCode)}
                    </Text>
                  </View>
                )}

                {salesHealth.unsoldUnits > 0 && (
                  <View className="flex-row justify-between items-center py-3">
                    <View>
                      <Text className="text-xs font-black text-brand-900">Unsold Waste</Text>
                      <Text className="text-[10px] font-bold text-brand-400">
                        {salesHealth.unsoldUnits} units produced but not sold
                      </Text>
                    </View>
                    <Text className="text-sm font-black text-red-500">
                      − {formatMoney(salesHealth.costWasted, currencyCode)}
                    </Text>
                  </View>
                )}

                <View className="mt-3 pt-3 border-t border-red-100 flex-row justify-between items-center">
                  <Text className="text-xs font-black text-red-600 uppercase tracking-widest">
                    Total Losses
                  </Text>
                  <Text className="text-sm font-black text-red-600">
                    − {formatMoney(salesHealth.revenueLost + salesHealth.costWasted, currencyCode)}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {!!salesError && (
          <Text className="mt-4 text-sm font-bold text-red-500 text-center">{salesError}</Text>
        )}
      </ScrollView>
    </View>
  );
}
