import React, { useMemo } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useProductStore } from '../stores/productStore';
import { useSalesStore } from '../stores/salesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';

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
  const settings = useSettingsStore((state) => state.settings);
  const monthlySales = useSalesStore((state) => state.monthlySales);

  const product = products.find((p) => Number(p.id) === Number(productId));
  const productIngredients = getProductIngredients(productId);
  
  // Derive records
  const monthlyGoalRecords = useMemo(() => {
    const records: Record<number, { earnedSoFar: number }> = {};
    monthlySales.forEach((sale) => {
      const pId = Number(sale.productId);
      if (!records[pId]) records[pId] = { earnedSoFar: 0 };
      records[pId].earnedSoFar += sale.actualProfit;
    });
    return records;
  }, [monthlySales]);

  const goalRecord = monthlyGoalRecords[productId] || { earnedSoFar: 0 };
  const currencyCode = settings.currencyCode;

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-50/20">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="mt-4 text-lg font-black text-brand-900">Product not found</Text>
        <Pressable
          onPress={() => navigation.goBack()}
        >
          <View className="mt-6 rounded-[32px] bg-brand-900 px-8 py-3">
            <Text className="font-bold text-white text-xs uppercase tracking-widest">Go Back</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  // Cost Breakdown Logic
  const costsByType = useMemo(() => {
    const totals: Record<string, number> = {
      material: 0,
      packaging: 0,
      labor: 0,
      utilities: 0,
      overhead: 0,
      other: 0,
    };
    
    productIngredients.forEach((pi) => {
      // Cost = (Resource Price / Yield) * Multiplier (always 1 for now)
      const lineCost = (pi.ingredientPricePerUnit / (pi.ingredientYieldFactor || 1)) * pi.quantityUsed;
      if (totals[pi.costType] !== undefined) {
        totals[pi.costType] += lineCost;
      } else {
        totals.other += lineCost;
      }
    });
    
    return totals;
  }, [productIngredients]);

  const totalLinkedCost = Object.values(costsByType).reduce((a, b) => a + b, 0);
  const directCostPerBatch = Number(product.baseCost || 0) + totalLinkedCost;
  
  const unitCostRaw = product.batchSize > 0 ? directCostPerBatch / product.batchSize : 0;
  const unitCostWithVat = unitCostRaw * (1 + product.vatPercent);

  const breakdown = {
    baseCost: Number(product.baseCost || 0),
    materials: costsByType.material,
    packaging: costsByType.packaging,
    labor: costsByType.labor,
    utilities: costsByType.utilities,
    overhead: costsByType.overhead + costsByType.other,
    totalUnitCost: unitCostWithVat,
    vat: unitCostWithVat - unitCostRaw,
  };

  const handleDelete = () => {
    Alert.alert('Move to Trash', 'Are you sure you want to move this product to the trash?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to Trash',
        style: 'destructive',
        onPress: async () => {
          await deleteProduct(product.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const progress = product.monthlyGoalProfit > 0 
    ? Math.min((goalRecord.earnedSoFar / product.monthlyGoalProfit) * 100, 100) 
    : 0;

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Product Analysis',
      headerRight: undefined,
    });
  }, [navigation]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1">
        <View style={{ height: 24 }} />
        <View className="px-6 pb-20">
          
          <Pressable 
            onPress={() => navigation.navigate('ProductForm', { productId })}
          >
            <View className="flex-row items-center justify-between gap-3 rounded-[32px] border border-brand-100 bg-white p-6 shadow-sm">
              <View className="flex-1">
                <Text className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">{product.category}</Text>
                <Text className="text-2xl font-black text-brand-950 pr-4">{product.name}</Text>
                <Text className="mt-1 text-xs font-bold text-brand-600">
                  {PRICING_METHOD_LABELS[product.pricingMethod] ?? 'Margin %'} •{' '}
                  VAT {(product.vatPercent * 100).toFixed(0)}%
                </Text>
              </View>
              <View className="h-12 w-12 rounded-full border border-brand-50 items-center justify-center">
                 <Ionicons name="chevron-forward" size={24} color="#bbf7d0" />
              </View>
            </View>
          </Pressable>

          <View className="mt-4 rounded-[32px] border border-brand-100 bg-white p-6">
            <View className="flex-row justify-between items-end mb-4">
               <View>
                 <Text className="text-[10px] font-black text-brand-300 uppercase tracking-widest mb-1">Profitability Threshold</Text>
                 <Text className="text-xl font-black text-brand-900">{formatMoney(goalRecord.earnedSoFar, currencyCode)}</Text>
               </View>
               <Text className="text-xs font-bold text-brand-600">
                  {progress.toFixed(0)}% <Text className="text-brand-200">/ Goal</Text>
               </Text>
            </View>
            <View className="h-2 bg-brand-50 rounded-full overflow-hidden">
               <View 
                 className="h-full bg-brand-500" 
                 style={{ width: `${progress}%` as any }} 
               />
            </View>
          </View>

          {/* Cost Breakdown Section */}
          <View className="mt-4 rounded-[32px] border border-brand-100 bg-white p-6">
            <Text className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Unit Economics (COGS)</Text>
            
            <View className="gap-3">
              {breakdown.baseCost > 0 && <CostRow label="Fixed Inventory Cost" value={formatMoney(breakdown.baseCost, currencyCode)} color="bg-brand-50" />}
              {breakdown.materials > 0 && <CostRow label="Raw Materials" value={formatMoney(breakdown.materials, currencyCode)} color="bg-brand-500" />}
              {breakdown.packaging > 0 && <CostRow label="Packaging" value={formatMoney(breakdown.packaging, currencyCode)} color="bg-emerald-500" />}
              {breakdown.labor > 0 && <CostRow label="Labor Operations" value={formatMoney(breakdown.labor, currencyCode)} color="bg-brand-800" />}
              {breakdown.utilities > 0 && <CostRow label="Business Utilities" value={formatMoney(breakdown.utilities, currencyCode)} color="bg-amber-400" />}
              {breakdown.overhead > 0 && <CostRow label="Overhead / Other" value={formatMoney(breakdown.overhead, currencyCode)} color="bg-brand-300" />}
              
              <View className="h-px bg-brand-50 my-2" />
              <View className="flex-row justify-between items-center bg-brand-50/30 -mx-6 px-6 py-4">
                 <Text className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Total Unit COGS</Text>
                 <Text className="text-lg font-black text-brand-950">{formatMoney(breakdown.totalUnitCost, currencyCode)}</Text>
              </View>
            </View>
          </View>

          <View className="mt-4 rounded-[32px] border border-brand-100 bg-white p-6">
            <Text className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">Target Unit Revenue</Text>
            <Text className="text-2xl font-black text-brand-950 mb-2">{formatMoney(product.sellingPrice, currencyCode)}</Text>
            <Text className="text-xs text-brand-400 font-medium">Calculated based on your strategic {PRICING_METHOD_LABELS[product.pricingMethod]} model.</Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

function CostRow({ label, value, isStrong, color }: { label: string; value: string; isStrong?: boolean; color: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <View className={`w-2 h-2 rounded-full mr-3 ${color}`} />
        <Text className={`text-sm ${isStrong ? 'font-black text-brand-900 uppercase tracking-tighter' : 'font-bold text-brand-600'}`}>{label}</Text>
      </View>
      <Text className={`text-sm ${isStrong ? 'font-black text-brand-950' : 'font-black text-brand-800'}`}>{value}</Text>
    </View>
  );
}
