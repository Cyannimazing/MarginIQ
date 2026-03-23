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
          
          <View className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <View className="h-full rounded-full bg-brand-900" style={{ width: `${goalProgressPercent}%` }} />
          </View>
          <Text className="mt-3 text-[10px] font-black text-brand-400 uppercase text-center tracking-widest">
            Progress: {goalProgressPercent.toFixed(1)}%
          </Text>
        </View>

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