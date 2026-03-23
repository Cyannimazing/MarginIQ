import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useGoalStore } from '../stores/goalStore';
import { useProductStore } from '../stores/productStore';
import { useSalesStore } from '../stores/salesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';
import { getCurrentMonth } from '../utils/month';
import { OptionChip } from '../components/ui/OptionChip';
import { useUIStore } from '../stores/uiStore';

type RangeOption = 3 | 6 | 12;

type MonthAggregate = {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
};

type CategoryMetric = {
  category: string;
  revenue: number;
  profit: number;
  margin: number;
};

const RANGE_OPTIONS: RangeOption[] = [3, 6, 12];

const roundTo = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toPercentWidth = (value: number, max: number): any => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const width = Math.max((safeValue / safeMax) * 100, 4);
  return `${Math.min(width, 100)}%`;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Analytics'>;

export function AnalyticsScreen({ navigation }: Props) {
  const products = useProductStore((state) => state.products);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const monthlySales = useSalesStore((state) => state.monthlySales);
  const loadMonthlySales = useSalesStore((state) => state.loadMonthlySales);
  const salesError = useSalesStore((state) => state.error);
  const monthlyGoals = useGoalStore((state) => state.monthlyGoals);
  const loadMonthlyGoals = useGoalStore((state) => state.loadMonthlyGoals);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  const [rangeMonths, setRangeMonths] = useState<RangeOption>(6);

  useEffect(() => {
    void loadProducts();
    void loadMonthlySales();
    void loadMonthlyGoals();
  }, [loadMonthlyGoals, loadMonthlySales, loadProducts]);

  const monthAggregates = useMemo<MonthAggregate[]>(() => {
    const map = new Map<string, MonthAggregate>();
    for (const entry of monthlySales) {
      const gMonth = entry.month.match(/^\d{4}-\d{2}-\d{2}$/) ? entry.month.substring(0, 7) : entry.month;
      const current = map.get(gMonth) ?? { month: gMonth, revenue: 0, cost: 0, profit: 0 };
      current.revenue += entry.actualRevenue;
      current.cost += entry.actualCost;
      current.profit += entry.actualProfit;
      map.set(gMonth, current);
    }
    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [monthlySales]);

  const visibleAggregates = monthAggregates.slice(0, rangeMonths);
  const latest = visibleAggregates[0];
  const previous = visibleAggregates[1];

  const growthRate = useMemo(() => {
    if (!latest || !previous) return 0;
    if (previous.profit === 0) return latest.profit > 0 ? 100 : 0;
    return roundTo(((latest.profit - previous.profit) / previous.profit) * 100);
  }, [latest, previous]);

  const forecastNextMonthProfit = latest ? roundTo(latest.profit * (1 + growthRate / 100)) : 0;

  const maxRevenue = Math.max(...visibleAggregates.map((item) => item.revenue), 1);
  const maxCost = Math.max(...visibleAggregates.map((item) => item.cost), 1);
  const maxProfit = Math.max(...visibleAggregates.map((item) => Math.abs(item.profit)), 1);

  const productPerformance = useMemo(() => {
    const map = new Map<number, { revenue: number; cost: number; profit: number; productName: string }>();
    for (const entry of monthlySales) {
      const product = products.find((item) => item.id === entry.productId);
      const current = map.get(entry.productId) ?? { revenue: 0, cost: 0, profit: 0, productName: product?.name ?? `Product #${entry.productId}` };
      current.revenue += entry.actualRevenue;
      current.cost += entry.actualCost;
      current.profit += entry.actualProfit;
      map.set(entry.productId, current);
    }
    return [...map.entries()]
      .map(([productId, metrics]) => {
        const marginPercent = metrics.revenue > 0 ? roundTo((metrics.profit / metrics.revenue) * 100) : 0;
        return { productId, ...metrics, marginPercent };
      })
      .sort((a, b) => b.marginPercent - a.marginPercent);
  }, [monthlySales, products]);

  const bestProduct = productPerformance[0];
  const goalMonth = latest?.month ?? getCurrentMonth();
  const currentGoal = monthlyGoals.find((goal) => goal.month === goalMonth);
  const goalTarget = currentGoal?.targetProfit ?? 0;
  const goalEarned = currentGoal?.earnedSoFar ?? latest?.profit ?? 0;
  const goalRemaining = Math.max(goalTarget - goalEarned, 0);
  const goalProgressPercent = goalTarget > 0 ? Math.min((goalEarned / goalTarget) * 100, 100) : 0;

  const filteredSalesForPeriod = useMemo(() => {
    const visibleMonths = visibleAggregates.map(a => a.month);
    return monthlySales.filter(sale => {
      const gMonth = sale.month.match(/^\d{4}-\d{2}-\d{2}$/) ? sale.month.substring(0, 7) : sale.month;
      return visibleMonths.includes(gMonth);
    });
  }, [monthlySales, visibleAggregates]);

  const batchesNeeded = useMemo(() => {
    if (goalRemaining <= 0 || !bestProduct) return 0;
    const product = products.find(p => p.id === bestProduct.productId);
    if (!product || !product.batchSize || product.batchSize <= 0) return 0;

    // Use unitsSold to get avg profit per unit
    const unitsSoldVal = filteredSalesForPeriod
      .filter(s => s.productId === bestProduct.productId)
      .reduce((sum, s) => sum + s.unitsSold, 0);
    
    const avgProfitPerUnit = unitsSoldVal > 0 ? bestProduct.profit / unitsSoldVal : (product.sellingPrice - (product.baseCost / product.batchSize));
    const profitPerBatch = avgProfitPerUnit * product.batchSize;
    
    return profitPerBatch > 0 ? Math.ceil(goalRemaining / profitPerBatch) : 0;
  }, [goalRemaining, bestProduct, products, filteredSalesForPeriod]);

  const summaryKPIs = useMemo(() => {
    const totalProfit = visibleAggregates.reduce((acc, item) => acc + item.profit, 0);
    const totalRevenue = visibleAggregates.reduce((acc, item) => acc + item.revenue, 0);
    const totalUnits = filteredSalesForPeriod.reduce((acc, item) => acc + item.unitsSold, 0);
    const avgMonthlyProfit = rangeMonths > 0 ? totalProfit / rangeMonths : 0;

    return { totalProfit, totalRevenue, totalUnits, avgMonthlyProfit };
  }, [visibleAggregates, filteredSalesForPeriod, rangeMonths]);

  const performanceInsights = useMemo(() => {
    if (visibleAggregates.length === 0) return null;
    
    const bestMonth = visibleAggregates.reduce((prev, curr) => curr.profit > prev.profit ? curr : prev, visibleAggregates[0]);
    const worstMonth = visibleAggregates.reduce((prev, curr) => curr.profit < prev.profit ? curr : prev, visibleAggregates[0]);
    
    const visibleMonths = visibleAggregates.map(a => a.month);
    const visibleGoals = monthlyGoals.filter(g => visibleMonths.includes(g.month));
    const goalHitCount = visibleGoals.filter(g => g.earnedSoFar >= g.targetProfit && g.targetProfit > 0).length;
    const goalHitPercent = visibleGoals.length > 0 ? (goalHitCount / visibleGoals.length) * 100 : 0;

    return { bestMonth, worstMonth, goalHitPercent };
  }, [visibleAggregates, monthlyGoals]);

  const salesMixAnalysis = useMemo(() => {
    let totalDiscountedUnits = 0;
    let totalUnits = 0;
    let revenueLost = 0;
    let unsoldUnits = 0;
    let costWasted = 0;

    for (const sale of filteredSalesForPeriod) {
      const product = products.find(p => p.id === sale.productId);
      const saleTotalUnits = sale.unitsSold + sale.unitsUnsold;
      
      totalUnits += sale.unitsSold;
      totalDiscountedUnits += sale.unitsSoldDiscounted;
      unsoldUnits += sale.unitsUnsold;
      
      if (product) {
        revenueLost += (sale.unitsSoldDiscounted * product.sellingPrice * product.discountPercent);
      }
      
      if (saleTotalUnits > 0) {
        costWasted += (sale.unitsUnsold / saleTotalUnits) * sale.actualCost;
      }
    }

    const fullPriceUnits = totalUnits - totalDiscountedUnits;
    const discountedPercent = totalUnits > 0 ? (totalDiscountedUnits / totalUnits) * 100 : 0;

    return { totalUnits, totalDiscountedUnits, fullPriceUnits, discountedPercent, revenueLost, unsoldUnits, costWasted };
  }, [filteredSalesForPeriod, products]);

  const categoryPerformance = useMemo(() => {
    const map = new Map<string, { revenue: number; profit: number }>();
    
    for (const sale of filteredSalesForPeriod) {
      const product = products.find(p => p.id === sale.productId);
      const category = product?.category || 'Uncategorized';
      
      const current = map.get(category) ?? { revenue: 0, profit: 0 };
      current.revenue += sale.actualRevenue;
      current.profit += sale.actualProfit;
      map.set(category, current);
    }

    const result: CategoryMetric[] = [...map.entries()].map(([category, metrics]) => ({
      category,
      ...metrics,
      margin: metrics.revenue > 0 ? (metrics.profit / metrics.revenue) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);

    return result;
  }, [filteredSalesForPeriod, products]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-24">
        <View style={{ height: 24 }} />

        <View className="flex-row flex-wrap mb-6 gap-2">
          {RANGE_OPTIONS.map((option) => (
            <OptionChip
              key={option}
              label={`Last ${option} months`}
              selected={rangeMonths === option}
              onPress={() => setRangeMonths(option)}
              size="sm"
            />
          ))}
        </View>

        {/* Summary KPI Strip */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="mb-8 -mx-6 px-6"
          contentContainerStyle={{ gap: 12 }}
        >
          <View className="bg-brand-900 px-5 py-4 rounded-[24px] min-w-[140px]">
            <Text className="text-[10px] font-black text-brand-300 uppercase tracking-widest mb-1">Total Profit</Text>
            <Text className="text-lg font-black text-white">{formatMoney(summaryKPIs.totalProfit, currencyCode)}</Text>
          </View>
          <View className="bg-white border border-brand-100 px-5 py-4 rounded-[24px] min-w-[140px] shadow-sm">
            <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Total Revenue</Text>
            <Text className="text-lg font-black text-brand-900">{formatMoney(summaryKPIs.totalRevenue, currencyCode)}</Text>
          </View>
          <View className="bg-white border border-brand-100 px-5 py-4 rounded-[24px] min-w-[140px] shadow-sm">
            <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Units Sold</Text>
            <Text className="text-lg font-black text-brand-900">{summaryKPIs.totalUnits}</Text>
          </View>
          <View className="bg-white border border-brand-100 px-5 py-4 rounded-[24px] min-w-[140px] shadow-sm">
            <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Avg Profit/Mo</Text>
            <Text className="text-lg font-black text-brand-900">{formatMoney(summaryKPIs.avgMonthlyProfit, currencyCode)}</Text>
          </View>
        </ScrollView>

        {/* Forecast Card */}
        <View className="mb-6 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
          <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">Forecast</Text>
          
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wide">Latest Month Profit</Text>
            <Text className="text-sm font-black text-brand-900">{formatMoney(latest?.profit || 0, currencyCode)}</Text>
          </View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wide">MoM Growth %</Text>
            <Text className={`text-sm font-black ${growthRate >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
              {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(2)}%
            </Text>
          </View>
          <View className="flex-row items-center justify-between mt-2 pt-4 border-t border-brand-50">
            <Text className="text-xs font-black text-brand-900 uppercase tracking-wide">Next Month Forecast</Text>
            <Text className="text-lg font-black text-brand-900">{formatMoney(forecastNextMonthProfit, currencyCode)}</Text>
          </View>
        </View>

        {/* Goal Progress Card */}
        <View className="mb-6 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
          <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">Goal Progress ({goalMonth})</Text>
          
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wide">Target</Text>
            <Text className="text-sm font-black text-brand-900">{formatMoney(goalTarget, currencyCode)}</Text>
          </View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wide">Earned</Text>
            <Text className="text-sm font-black text-brand-600">{formatMoney(goalEarned, currencyCode)}</Text>
          </View>
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wide">Remaining</Text>
            <Text className="text-sm font-black text-brand-900">{formatMoney(goalRemaining, currencyCode)}</Text>
          </View>
          
          {batchesNeeded > 0 && (
            <View className="mt-2 flex-row items-center justify-between rounded-2xl bg-brand-50/50 border border-brand-100 p-3">
              <View>
                <Text className="text-[9px] font-black text-brand-400 uppercase tracking-[2px] mb-1">Batches Needed / Month</Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-[15px] font-black text-brand-900">{batchesNeeded}</Text>
                  <Text className="text-[10px] font-bold text-brand-400 uppercase tracking-tighter">batches</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[9px] font-black text-brand-400 uppercase tracking-widest mb-1">Based on {bestProduct.productName}</Text>
                <Text className="text-xs font-black text-brand-900">Estimated</Text>
              </View>
            </View>
          )}

          <View className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <View className="h-full rounded-full bg-brand-900" style={{ width: `${goalProgressPercent}%` }} />
          </View>
          <Text className="mt-3 text-[10px] font-black text-brand-400 uppercase text-center tracking-widest">
            Progress: {goalProgressPercent.toFixed(1)}%
          </Text>
        </View>

        {/* Performance Insights Card */}
        {performanceInsights && (
          <View className="mb-6 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
            <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">Performance Insights</Text>
            
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 bg-brand-50/50 p-4 rounded-2xl border border-brand-100">
                <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Best Month</Text>
                <Text className="text-sm font-black text-brand-900">{performanceInsights.bestMonth.month}</Text>
                <Text className="text-xs font-bold text-brand-600">{formatMoney(performanceInsights.bestMonth.profit, currencyCode)}</Text>
              </View>
              <View className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Worst Month</Text>
                <Text className="text-sm font-black text-slate-900">{performanceInsights.worstMonth.month}</Text>
                <Text className="text-xs font-bold text-slate-500">{formatMoney(performanceInsights.worstMonth.profit, currencyCode)}</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between p-4 bg-brand-900 rounded-2xl">
              <View>
                <Text className="text-[10px] font-black text-brand-300 uppercase tracking-widest mb-0.5">Goal Completion</Text>
                <Text className="text-base font-black text-white">Hit {performanceInsights.goalHitPercent.toFixed(0)}% of goals</Text>
              </View>
              <Ionicons name="trending-up" size={24} color="#4ade80" />
            </View>
          </View>
        )}

        {/* Revenue vs Cost Timeline */}
        <View className="mb-6 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
          <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-6">Revenue vs Cost</Text>
          
          {visibleAggregates.map((item) => (
            <View key={item.month} className="mb-8">
              <Text className="text-sm font-black text-brand-900 mb-3">{item.month}</Text>

              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Revenue</Text>
              <View className="h-2.5 rounded-full bg-slate-100 mb-3">
                <View className="h-full rounded-full bg-brand-300" style={{ width: toPercentWidth(item.revenue, maxRevenue) }} />
              </View>

              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cost</Text>
              <View className="h-2.5 rounded-full bg-slate-100 mb-3">
                <View className="h-full rounded-full bg-brand-200" style={{ width: toPercentWidth(item.cost, maxCost) }} />
              </View>

              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Profit</Text>
              <View className="h-2.5 rounded-full bg-slate-100 mb-4">
                <View className={`h-full rounded-full ${item.profit >= 0 ? 'bg-brand-900' : 'bg-red-500'}`} style={{ width: toPercentWidth(item.profit >= 0 ? item.profit : Math.abs(item.profit), maxProfit) }} />
              </View>

              <View className="flex-row justify-between items-center bg-brand-50/50 p-3 rounded-2xl border border-brand-100">
                <Text className="text-[10px] font-bold text-brand-600">{formatMoney(item.profit, currencyCode)} Net</Text>
                <Text className="text-[10px] font-black text-brand-900 uppercase tracking-widest">
                  Margin: {((item.profit / (item.revenue || 1)) * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Sales Mix & Loss Analysis Card */}
        <View className="my-6 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
          <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">Sales Mix & Loss Analysis</Text>
          
          <View className="flex-row items-center mb-6">
            <View className="h-3 rounded-l-full bg-brand-900" style={{ flex: salesMixAnalysis.fullPriceUnits || 1 }} />
            <View className="h-3 rounded-r-full bg-brand-200" style={{ flex: salesMixAnalysis.totalDiscountedUnits || 0 }} />
          </View>
          
          <View className="flex-row justify-between mb-6">
            <View>
              <View className="flex-row items-center mb-1">
                <View className="w-2 h-2 rounded-full bg-brand-900 mr-2" />
                <Text className="text-[10px] font-bold text-slate-500 uppercase">Full Price</Text>
              </View>
              <Text className="text-sm font-black text-brand-900">{salesMixAnalysis.fullPriceUnits} units</Text>
            </View>
            <View className="items-end">
              <View className="flex-row items-center mb-1">
                <Text className="text-[10px] font-bold text-slate-500 uppercase mr-2">Discounted</Text>
                <View className="w-2 h-2 rounded-full bg-brand-200" />
              </View>
              <Text className="text-sm font-black text-brand-900">{salesMixAnalysis.totalDiscountedUnits} units ({salesMixAnalysis.discountedPercent.toFixed(1)}%)</Text>
            </View>
          </View>

          <View className="bg-red-50 p-5 rounded-[24px] border border-red-100">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[10px] font-black text-red-500 uppercase tracking-widest">Estimated Losses</Text>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
            </View>
            
            <View className="flex-row justify-between mb-3">
              <Text className="text-xs font-bold text-slate-600">Revenue lost to discounts</Text>
              <Text className="text-sm font-black text-red-600">-{formatMoney(salesMixAnalysis.revenueLost, currencyCode)}</Text>
            </View>
            <View className="flex-row justify-between pt-3 border-t border-red-100">
              <View>
                <Text className="text-xs font-bold text-slate-600">Unsold waste cost</Text>
                <Text className="text-[10px] text-slate-400">{salesMixAnalysis.unsoldUnits} units wasted</Text>
              </View>
              <Text className="text-sm font-black text-red-600">-{formatMoney(salesMixAnalysis.costWasted, currencyCode)}</Text>
            </View>
          </View>
        </View>

        {/* Category Performance Card */}
        <View className="mb-6 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
          <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">Category Performance</Text>
          
          {categoryPerformance.map((item, index) => (
            <View key={item.category} className={`py-4 ${index !== 0 ? 'border-t border-brand-50' : ''}`}>
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center">
                  <Text className="text-sm font-black text-brand-900">{item.category}</Text>
                  {index === 0 && (
                    <View className="ml-2 bg-brand-100 px-2 py-0.5 rounded-full">
                      <Text className="text-[8px] font-black text-brand-600 uppercase">Top</Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm font-black text-brand-900">{formatMoney(item.profit, currencyCode)}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <View className="flex-1 h-1.5 rounded-full bg-slate-100 mr-4">
                  <View className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(item.margin, 100)}%` }} />
                </View>
                <Text className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{item.margin.toFixed(0)}% Margin</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Product Performance */}
        <View className="rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
          <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">Product Performance</Text>
          
          {bestProduct && (
            <View className="rounded-[24px] bg-brand-900 p-5 mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-[10px] font-black text-brand-300 uppercase tracking-widest">Star Performer</Text>
                <Ionicons name="trophy" size={16} color="#4ade80" />
              </View>
              <Text className="text-xl font-black text-white mb-1" numberOfLines={1}>{bestProduct.productName}</Text>
              <Text className="text-xs font-bold text-brand-200">
                {bestProduct.marginPercent.toFixed(1)}% Margin • {formatMoney(bestProduct.profit, currencyCode)} Net
              </Text>
            </View>
          )}

          {productPerformance.map((item) => (
            <View key={item.productId} className="flex-row items-center justify-between bg-brand-50/50 p-4 rounded-[20px] mb-2 border border-brand-100">
              <View className="flex-1 mr-3">
                <Text className="text-sm font-black text-brand-900" numberOfLines={1}>{item.productName}</Text>
                <Text className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mt-1">
                  Net: {formatMoney(item.profit, currencyCode)}
                </Text>
              </View>
              <View className="bg-white px-3 py-2 rounded-xl border border-brand-100">
                <Text className="text-xs font-black text-brand-900">{item.marginPercent.toFixed(1)}%</Text>
              </View>
            </View>
          ))}
        </View>

        {!!salesError && <Text className="mt-4 text-sm font-bold text-red-500 text-center">{salesError}</Text>}

      </ScrollView>
    </View>
  );
}