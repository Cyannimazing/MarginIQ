import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useProductStore } from '../stores/productStore';
import { useSalesStore } from '../stores/salesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';
import { compareMonths, isMonthInRange, isValidMonth } from '../utils/month';

type ProductFilter = 'all' | number;

const formatMonthLabel = (value: string) => {
  if (!value || value === 'all') return value;
  try {
    const [year, month] = value.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return value;
  }
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const isMonthRangeValid = (startMonth: string, endMonth: string) => {
  if (!isValidMonth(startMonth) || !isValidMonth(endMonth)) {
    return false;
  }
  return compareMonths(startMonth, endMonth) <= 0;
};

const buildReportHtml = (title: string, reportBody: string) => `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #0f172a; }
        h1 { font-size: 20px; margin-bottom: 8px; }
        p { color: #475569; margin-top: 0; }
        pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.6; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <p>Generated offline by MarginIQ</p>
      <pre>${escapeHtml(reportBody)}</pre>
    </body>
  </html>
`;

export function ReportsScreen() {
  const products = useProductStore((state) => state.products);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const monthlySales = useSalesStore((state) => state.monthlySales);
  const loadMonthlySales = useSalesStore((state) => state.loadMonthlySales);
  const isLoadingSales = useSalesStore((state) => state.isLoading);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);
  const businessName = useSettingsStore((state) => state.settings.businessName);

  const [selectedProduct, setSelectedProduct] = useState<ProductFilter>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  useEffect(() => {
    void loadProducts();
    void loadMonthlySales();
  }, [loadMonthlySales, loadProducts]);

  const availableMonths = useMemo(() => {
    return [...new Set(monthlySales.map((entry) => entry.month))].sort((a, b) =>
      b.localeCompare(a),
    );
  }, [monthlySales]);

  useEffect(() => {
    if (!availableMonths.length) {
      return;
    }

    if (!startMonth) {
      setStartMonth(availableMonths[availableMonths.length - 1]);
    }
    if (!endMonth) {
      setEndMonth(availableMonths[0]);
    }
  }, [availableMonths, endMonth, startMonth]);

  const isRangeFilterActive = isValidMonth(startMonth) && isValidMonth(endMonth);
  const hasValidRange = !isRangeFilterActive || isMonthRangeValid(startMonth, endMonth);

  const filteredEntries = useMemo(() => {
    const normalizedStart = startMonth.trim();
    const normalizedEnd = endMonth.trim();
    return monthlySales.filter((entry) => {
      const byProduct =
        selectedProduct === 'all' || entry.productId === selectedProduct;
      const byMonth = selectedMonth === 'all' || entry.month === selectedMonth;
      const byRange =
        !isRangeFilterActive ||
        (hasValidRange &&
          isMonthInRange(entry.month, normalizedStart, normalizedEnd));
      return byProduct && byMonth && byRange;
    });
  }, [
    endMonth,
    hasValidRange,
    isRangeFilterActive,
    monthlySales,
    selectedMonth,
    selectedProduct,
    startMonth,
  ]);

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.revenue += entry.actualRevenue;
        acc.cost += entry.actualCost;
        acc.profit += entry.actualProfit;
        acc.shortfall += entry.shortfall;
        acc.sold += entry.unitsSold;
        acc.unsold += entry.unitsUnsold;
        return acc;
      },
      {
        revenue: 0,
        cost: 0,
        profit: 0,
        shortfall: 0,
        sold: 0,
        unsold: 0,
      },
    );
  }, [filteredEntries]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<
      string,
      { revenue: number; cost: number; profit: number; sold: number; unsold: number }
    >();

    for (const entry of filteredEntries) {
      const current = map.get(entry.month) ?? {
        revenue: 0,
        cost: 0,
        profit: 0,
        sold: 0,
        unsold: 0,
      };

      current.revenue += entry.actualRevenue;
      current.cost += entry.actualCost;
      current.profit += entry.actualProfit;
      current.sold += entry.unitsSold;
      current.unsold += entry.unitsUnsold;
      map.set(entry.month, current);
    }

    return [...map.entries()]
      .map(([month, metrics]) => ({
        month,
        ...metrics,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredEntries]);

  const groupedByProduct = useMemo(() => {
    const map = new Map<
      number,
      {
        productName: string;
        revenue: number;
        cost: number;
        profit: number;
        sold: number;
        unsold: number;
      }
    >();

    for (const entry of filteredEntries) {
      const product = products.find((item) => item.id === entry.productId);
      const current = map.get(entry.productId) ?? {
        productName: product?.name ?? `Product #${entry.productId}`,
        revenue: 0,
        cost: 0,
        profit: 0,
        sold: 0,
        unsold: 0,
      };

      current.revenue += entry.actualRevenue;
      current.cost += entry.actualCost;
      current.profit += entry.actualProfit;
      current.sold += entry.unitsSold;
      current.unsold += entry.unitsUnsold;
      map.set(entry.productId, current);
    }

    return [...map.entries()]
      .map(([productId, metrics]) => ({
        productId,
        ...metrics,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredEntries, products]);

  const reportText = useMemo(() => {
    const productLabel =
      selectedProduct === 'all'
        ? 'All products'
        : products.find((item) => item.id === selectedProduct)?.name ?? 'Selected product';
    const monthLabel = selectedMonth === 'all' ? 'All months' : formatMonthLabel(selectedMonth);
    const rangeLabel =
      isRangeFilterActive && hasValidRange
        ? `${formatMonthLabel(startMonth)} to ${formatMonthLabel(endMonth)}`
        : isRangeFilterActive && !hasValidRange
          ? `Invalid range (${startMonth} to ${endMonth})`
          : 'Not applied';

    return [
      `${businessName} — MarginIQ Report`,
      `Scope: ${productLabel} | ${monthLabel} | Range: ${rangeLabel}`,
      `Entries: ${filteredEntries.length}`,
      '',
      `Revenue: ${formatMoney(totals.revenue, currencyCode)}`,
      `Cost: ${formatMoney(totals.cost, currencyCode)}`,
      `Profit: ${formatMoney(totals.profit, currencyCode)}`,
      `Shortfall: ${formatMoney(totals.shortfall, currencyCode)}`,
      `Units Sold: ${totals.sold}`,
      `Units Unsold: ${totals.unsold}`,
      '',
      'Month Breakdown:',
      ...groupedByMonth.map(
        (item) =>
          `• ${formatMonthLabel(item.month)} | Revenue ${formatMoney(item.revenue, currencyCode)} | Profit ${formatMoney(item.profit, currencyCode)} | Sold ${item.sold} | Unsold ${item.unsold}`,
      ),
      '',
      'Product Breakdown:',
      ...groupedByProduct.map(
        (item) =>
          `• ${item.productName} | Revenue ${formatMoney(item.revenue, currencyCode)} | Profit ${formatMoney(item.profit, currencyCode)} | Sold ${item.sold} | Unsold ${item.unsold}`,
      ),
      '',
      'Generated by MarginIQ (offline)',
    ].join('\n');
  }, [
    businessName,
    currencyCode,
    filteredEntries.length,
    groupedByMonth,
    groupedByProduct,
    hasValidRange,
    isRangeFilterActive,
    endMonth,
    products,
    selectedMonth,
    selectedProduct,
    startMonth,
    totals.cost,
    totals.profit,
    totals.revenue,
    totals.shortfall,
    totals.sold,
    totals.unsold,
  ]);

  const handleShareText = async () => {
    if (!filteredEntries.length) {
      Alert.alert('No Data', 'No report entries found for the current filters.');
      return;
    }

    try {
      await Share.share({ message: reportText });
    } catch {
      Alert.alert('Share Failed', 'Unable to open share sheet right now.');
    }
  };

  const handleExportPdf = async () => {
    if (!filteredEntries.length) {
      Alert.alert('No Data', 'No report entries found for the current filters.');
      return;
    }

    if (isRangeFilterActive && !hasValidRange) {
      Alert.alert('Invalid Range', 'Start month must be less than or equal to end month.');
      return;
    }

    try {
      const { uri } = await Print.printToFileAsync({
        html: buildReportHtml(`${businessName} — MarginIQ Report`, reportText),
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Share MarginIQ Report',
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
        return;
      }

      await Share.share({ message: reportText });
    } catch {
      Alert.alert('Export Failed', 'Unable to export PDF right now.');
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 pb-10 pt-4">

        <Text className="mb-2 mt-5 text-sm font-semibold text-slate-800">Product</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pr-2"
        >
          <FilterChip
            label="All Products"
            selected={selectedProduct === 'all'}
            onPress={() => setSelectedProduct('all')}
          />
          {products.map((product) => (
            <FilterChip
              key={product.id}
              label={product.name}
              selected={selectedProduct === product.id}
              onPress={() => setSelectedProduct(product.id)}
            />
          ))}
        </ScrollView>

        <Text className="mb-2 mt-4 text-sm font-semibold text-slate-800">Month</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pr-2"
        >
          <FilterChip
            label="All Months"
            selected={selectedMonth === 'all'}
            onPress={() => setSelectedMonth('all')}
          />
          {availableMonths.map((month) => (
            <FilterChip
              key={month}
              label={formatMonthLabel(month)}
              selected={selectedMonth === month}
              onPress={() => setSelectedMonth(month)}
            />
          ))}
        </ScrollView>

        <Text className="mb-2 mt-4 text-sm font-semibold text-slate-800">Date Range filter</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-1 text-xs text-slate-500">Start (YYYY-MM)</Text>
            <TextInput
              value={startMonth}
              onChangeText={setStartMonth}
              placeholder="2026-01"
              autoCapitalize="none"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-xs text-slate-500">End (YYYY-MM)</Text>
            <TextInput
              value={endMonth}
              onChangeText={setEndMonth}
              placeholder="2026-03"
              autoCapitalize="none"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>
        {isRangeFilterActive && !hasValidRange ? (
          <Text className="mt-2 text-sm text-red-600">
            Invalid range. Start month must be less than or equal to end month.
          </Text>
        ) : (
          <Text className="mt-2 text-xs text-slate-500">
            Optional range filter applies only when both start and end are valid YYYY-MM.
          </Text>
        )}

        <View className="mt-4 gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-sm font-bold text-slate-900">Summary</Text>
          <MetricRow label="Entries" value={String(filteredEntries.length)} />
          <MetricRow label="Revenue" value={formatMoney(totals.revenue, currencyCode)} />
          <MetricRow label="Cost" value={formatMoney(totals.cost, currencyCode)} />
          <MetricRow
            label="Profit"
            value={formatMoney(totals.profit, currencyCode)}
            strong
          />
          <MetricRow
            label="Shortfall"
            value={formatMoney(totals.shortfall, currencyCode)}
          />
          <MetricRow label="Units Sold" value={String(totals.sold)} />
          <MetricRow label="Units Unsold" value={String(totals.unsold)} />
        </View>

        <View className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-sm font-bold text-slate-900">Monthly Breakdown</Text>
          {groupedByMonth.length ? (
            <View className="mt-2 gap-2">
              {groupedByMonth.map((item) => (
                <View
                  key={item.month}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-2.5"
                >
                  <Text className="text-xs font-semibold text-slate-800">{formatMonthLabel(item.month)}</Text>
                  <Text className="mt-1 text-[11px] text-slate-600">
                    Revenue {formatMoney(item.revenue, currencyCode)} • Profit{' '}
                    {formatMoney(item.profit, currencyCode)}
                  </Text>
                  <Text className="mt-1 text-[11px] text-slate-600">
                    Sold {item.sold} • Unsold {item.unsold}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="mt-2 text-sm text-slate-500">No monthly data for current filters.</Text>
          )}
        </View>

        <View className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-sm font-bold text-slate-900">Per-Product Breakdown</Text>
          {groupedByProduct.length ? (
            <View className="mt-2 gap-2">
              {groupedByProduct.map((item) => (
                <View
                  key={item.productId}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-2.5"
                >
                  <Text className="text-xs font-semibold text-slate-800">
                    {item.productName}
                  </Text>
                  <Text className="mt-1 text-[11px] text-slate-600">
                    Revenue {formatMoney(item.revenue, currencyCode)} • Profit{' '}
                    {formatMoney(item.profit, currencyCode)}
                  </Text>
                  <Text className="mt-1 text-[11px] text-slate-600">
                    Sold {item.sold} • Unsold {item.unsold}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="mt-2 text-sm text-slate-500">No product data for current filters.</Text>
          )}
        </View>

        <View className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-sm font-bold text-slate-900">Preview</Text>
          <Text className="mt-2 text-xs leading-5 text-slate-700">{reportText}</Text>
        </View>

        <Pressable
          onPress={() => {
            void handleExportPdf();
          }}
          disabled={isLoadingSales}
        >
          <View className={`mt-5 items-center rounded-xl bg-brand-600 py-3 ${
            isLoadingSales ? 'opacity-70' : ''
          }`}>
            <Text className="font-semibold text-white">Export PDF</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            void handleShareText();
          }}
          disabled={isLoadingSales}
        >
          <View className={`mt-3 items-center rounded-xl border border-brand-600 bg-white py-3 ${
            isLoadingSales ? 'opacity-70' : ''
          }`}>
            <Text className="font-semibold text-brand-600">Share Text Summary</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
    >
      <View className={`rounded-full border px-3 py-1.5 ${
        selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
      }`}>
        <Text className={`text-xs ${selected ? 'font-semibold text-white' : 'text-slate-700'}`}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

type MetricRowProps = {
  label: string;
  value: string;
  strong?: boolean;
};

function MetricRow({ label, value, strong = false }: MetricRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className={strong ? 'font-semibold text-slate-900' : 'text-slate-700'}>{label}</Text>
      <Text className={strong ? 'font-semibold text-slate-900' : 'text-slate-700'}>{value}</Text>
    </View>
  );
}
