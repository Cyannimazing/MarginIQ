import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '../../../utils/currency';

const PRICING_METHOD_LABELS: Record<string, string> = {
  margin: 'Margin',
  markup: 'Markup',
  fixed: 'Fixed',
};

type ProductCardProps = {
  product: any;
  onPress: () => void;
  onLongPress: (product: any) => void;
  earned?: number;
  currencyCode: string;
  isTrashView?: boolean;
};

export function ProductCard({ 
  product, 
  onPress, 
  onLongPress, 
  earned = 0, 
  currencyCode,
  isTrashView
}: ProductCardProps) {
  const goal = product.monthlyGoalProfit ?? 0;
  const progress = goal > 0 ? Math.min((earned / goal) * 100, 100) : 0;
  const pricingLabel = PRICING_METHOD_LABELS[product.pricingMethod] ?? 'Margin';
  const backgroundColor = product.isPinned && !isTrashView ? '#f0fdf4' : (product.color || '#ffffff');
  const borderColor = product.isPinned && !isTrashView ? '#16a34a' : '#f1f5f9';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => onLongPress(product)}
      delayLongPress={500}
    >
      <View 
        style={{ 
          backgroundColor, 
          borderColor, 
          borderWidth: product.isPinned && !isTrashView ? 2 : 1 
        }} 
        className="rounded-[32px] mb-4 overflow-hidden relative shadow-sm"
      >
        <View className="p-5 flex-row items-center">
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
               <Text className={`text-[10px] font-black uppercase tracking-widest ${product.isPinned && !isTrashView ? 'text-brand-800' : 'text-brand-600'}`}>
                 {product.isPinned && !isTrashView ? '★ PRIORITY' : (product.category || 'NO CATEGORY')}
               </Text>
            </View>
            <Text className="text-lg font-black text-brand-950 pr-8" numberOfLines={1}>{product.name}</Text>
            <Text className="text-sm font-bold text-brand-700 mt-0.5">
              {formatMoney(product.sellingPrice, currencyCode)} 
              <Text className="text-[10px] font-black text-brand-400 uppercase tracking-tighter"> • {pricingLabel}</Text>
            </Text>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onLongPress(product);
            }}
          >
            <View className={`h-10 w-10 items-center justify-center rounded-full ${product.isPinned && !isTrashView ? 'bg-brand-100/50' : 'bg-brand-50/50'}`}>
              <Ionicons name="ellipsis-vertical" size={20} color="#166534" />
            </View>
          </Pressable>
        </View>

        {!isTrashView && goal > 0 && (
          <View className="h-1.5 bg-brand-50">
            <View
              className="h-full bg-brand-600"
              style={{ width: `${progress}%` as any }}
            />
          </View>
        )}

        {isTrashView && (
          <View className="bg-slate-50 px-5 py-2 border-t border-slate-100 flex-row items-center">
            <Ionicons name="trash-outline" size={12} color="#64748b" />
            <Text className="ml-2 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
              Deleted {product.deletedAt ? `on ${new Date(product.deletedAt).toLocaleDateString()}` : ''}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
