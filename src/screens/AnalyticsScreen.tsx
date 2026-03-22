import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, ViewStyle } from 'react-native';
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
      const current = map.get(entry.month) ?? { month: entry.month, revenue: 0, cost: 0, profit: 0 };
      current.revenue += entry.actualRevenue;
      current.cost += entry.actualCost;
      current.profit += entry.actualProfit;
      map.set(entry.month, current);
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

  const s = {
    container: { flex: 1, backgroundColor: '#ffffff' } as ViewStyle,
    header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 24 } as ViewStyle,
    headerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    headerText: { fontSize: 14, fontWeight: '900' as const, color: '#064e3b', textTransform: 'uppercase' as const, letterSpacing: 2 },
    content: { paddingHorizontal: 24, paddingBottom: 40 } as ViewStyle,
    subHeader: { fontSize: 12, fontWeight: 'bold' as const, color: '#059669', marginBottom: 24 },
    card: { marginTop: 16, borderRadius: 32, borderWidth: 1, borderColor: '#ecfdf5', backgroundColor: '#ffffff', padding: 24 } as ViewStyle,
    cardLabel: { fontSize: 10, fontWeight: '900' as const, color: '#059669', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16 },
    metricRow: { marginTop: 8, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    metricLabel: { fontSize: 10, fontWeight: '700' as const, color: '#059669', textTransform: 'uppercase' as const },
    metricValue: { fontSize: 14, fontWeight: '900' as const, color: '#064e3b' },
    progressBarContainer: { marginTop: 24, height: 8, borderRadius: 4, backgroundColor: '#f0fdf4', overflow: 'hidden' as const } as ViewStyle,
    progressBar: { height: '100%', borderRadius: 4, backgroundColor: '#10b981' } as ViewStyle,
    chartRow: { marginBottom: 24 } as ViewStyle,
    chartBarLabel: { fontSize: 11, color: '#475569', marginBottom: 4 },
    chartBarTrack: { height: 10, borderRadius: 5, backgroundColor: '#f1f5f9' } as ViewStyle,
    chartBar: { height: '100%', borderRadius: 5 } as ViewStyle,
    performanceCard: { marginTop: 16, borderRadius: 32, borderWidth: 1, borderColor: '#ecfdf5', backgroundColor: '#ffffff', padding: 24 } as ViewStyle,
    starCard: { borderRadius: 32, backgroundColor: '#064e3b', padding: 20 } as ViewStyle,
    starText: { fontSize: 10, fontWeight: '900' as const, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' as const },
    starTitle: { fontSize: 18, fontWeight: '900' as const, color: '#ffffff' },
    starSubtitle: { fontSize: 12, fontWeight: 'bold' as const, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    itemRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderRadius: 16, backgroundColor: 'rgba(16,185,129,0.05)', padding: 16, marginTop: 12 } as ViewStyle,
    itemMain: { flex: 1 } as ViewStyle,
    itemName: { fontSize: 14, fontWeight: '900' as const, color: '#064e3b' },
    itemMeta: { fontSize: 10, fontWeight: '700' as const, color: '#059669', textTransform: 'uppercase' as const, marginTop: 4 },
    itemBadge: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#ecfdf5' } as ViewStyle,
    itemBadgeText: { fontSize: 12, fontWeight: '900' as const, color: '#064e3b' }
  };

  return (
    <View style={s.container}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ height: 24 }} />
        <View style={s.content}>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {RANGE_OPTIONS.map((option) => (
              <OptionChip
                key={option}
                label={`Last ${option} months`}
                selected={rangeMonths === option}
                onPress={() => setRangeMonths(option)}
              />
            ))}
          </View>

          <View style={s.card}>
            <Text style={s.cardLabel}>Forecast</Text>
            <View style={s.metricRow}>
              <Text style={s.metricLabel}>Latest Month Profit</Text>
              <Text style={s.metricValue}>{formatMoney(latest?.profit || 0, currencyCode)}</Text>
            </View>
            <View style={s.metricRow}>
              <Text style={s.metricLabel}>MoM Growth %</Text>
              <Text style={s.metricValue}>{growthRate.toFixed(2)}%</Text>
            </View>
            <View style={s.metricRow}>
              <Text style={s.metricValue}>Next Month Forecast</Text>
              <Text style={s.metricValue}>{formatMoney(forecastNextMonthProfit, currencyCode)}</Text>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardLabel}>Goal Progress ({goalMonth})</Text>
            <View style={s.metricRow}>
              <Text style={s.metricLabel}>Target</Text>
              <Text style={s.metricValue}>{formatMoney(goalTarget, currencyCode)}</Text>
            </View>
            <View style={s.metricRow}>
              <Text style={s.metricLabel}>Earned</Text>
              <Text style={s.metricValue}>{formatMoney(goalEarned, currencyCode)}</Text>
            </View>
            <View style={s.metricRow}>
              <Text style={s.metricLabel}>Remaining</Text>
              <Text style={s.metricValue}>{formatMoney(goalRemaining, currencyCode)}</Text>
            </View>
            <View style={s.progressBarContainer}>
              <View style={[s.progressBar, { width: `${goalProgressPercent}%` }]} />
            </View>
            <Text style={{ marginTop: 8, fontSize: 10, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>
              Progress: {goalProgressPercent.toFixed(1)}%
            </Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardLabel}>Revenue vs Cost</Text>
            {visibleAggregates.map((item) => (
              <View key={item.month} style={s.chartRow}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#020617', marginBottom: 12 }}>{item.month}</Text>
                
                <Text style={s.chartBarLabel}>Revenue</Text>
                <View style={s.chartBarTrack}><View style={[s.chartBar, { backgroundColor: '#6ee7b7', width: toPercentWidth(item.revenue, maxRevenue) }]} /></View>
                
                <Text style={[s.chartBarLabel, { marginTop: 8 }]}>Cost</Text>
                <View style={s.chartBarTrack}><View style={[s.chartBar, { backgroundColor: '#d1fae5', width: toPercentWidth(item.cost, maxCost) }]} /></View>
                
                <Text style={[s.chartBarLabel, { marginTop: 8 }]}>Profit</Text>
                <View style={s.chartBarTrack}>
                  <View style={[s.chartBar, { backgroundColor: item.profit >= 0 ? '#064e3b' : '#ef4444', width: toPercentWidth(Math.abs(item.profit), maxProfit) }]} />
                </View>

                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(5,150,105,0.05)', padding: 8, borderRadius: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#059669' }}>{formatMoney(item.profit, currencyCode)} Net</Text>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#064e3b', textTransform: 'uppercase' }}>Margin: {((item.profit / (item.revenue || 1)) * 100).toFixed(0)}%</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.performanceCard}>
            <Text style={s.cardLabel}>Product Performance</Text>
            {bestProduct && (
              <View style={s.starCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={s.starText}>Star Performer</Text>
                  <Ionicons name="trophy" size={16} color="#fbbf24" />
                </View>
                <Text style={s.starTitle} numberOfLines={1}>{bestProduct.productName}</Text>
                <Text style={s.starSubtitle}>
                  {bestProduct.marginPercent.toFixed(1)}% Margin • {formatMoney(bestProduct.profit, currencyCode)} Net
                </Text>
              </View>
            )}
            {productPerformance.map((item) => (
              <View key={item.productId} style={s.itemRow}>
                <View style={s.itemMain}>
                  <Text style={s.itemName} numberOfLines={1}>{item.productName}</Text>
                  <Text style={s.itemMeta}>Net Profit: {formatMoney(item.profit, currencyCode)}</Text>
                </View>
                <View style={s.itemBadge}>
                  <Text style={s.itemBadgeText}>{item.marginPercent.toFixed(1)}%</Text>
                </View>
              </View>
            ))}
          </View>

          {!!salesError && <Text style={{ marginTop: 16, fontSize: 14, color: '#ef4444' }}>{salesError}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}