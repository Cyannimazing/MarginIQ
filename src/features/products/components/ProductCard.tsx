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
  onChevronPress: () => void;
  earned?: number;
  currencyCode: string;
  isTrashView?: boolean;
};

export function ProductCard({ 
  product, 
  onPress, 
  onLongPress,
  onChevronPress,
  earned = 0, 
  currencyCode,
  isTrashView
}: ProductCardProps) {
  const pricingLabel = PRICING_METHOD_LABELS[product.pricingMethod] ?? 'Margin';
  const backgroundColor = product.isPinned && !isTrashView ? '#f0fdf4' : (product.color || '#ffffff');
  const borderColor = product.isPinned && !isTrashView ? '#16a34a' : '#f1f5f9';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => onLongPress(product)}
      delayLongPress={500}
    >
      <View className="shadow-sm">
        <View 
          style={{ 
            backgroundColor, 
            borderColor, 
            borderWidth: product.isPinned && !isTrashView ? 2 : 1 
          }} 
          className="rounded-[24px] overflow-hidden relative"
        >
          <View className="p-5 flex-row items-center">
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                 <Text className={`text-[10px] font-black uppercase tracking-widest ${product.isPinned && !isTrashView ? 'text-brand-800' : 'text-brand-600'}`}>
                   {product.isPinned && !isTrashView ? '★ PRIORITY' : (product.category || 'NO CATEGORY')}
                 </Text>
              </View>
              <Text className="text-lg font-black text-brand-900 pr-8" numberOfLines={1}>{product.name}</Text>
              <Text className="text-sm font-bold text-brand-700 mt-0.5">
                {formatMoney(product.sellingPrice, currencyCode)} 
                <Text className="text-[10px] font-black text-brand-400 uppercase tracking-tighter"> • {pricingLabel}</Text>
              </Text>
            </View>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onChevronPress();
              }}
            >
              <Ionicons name="chevron-forward" size={18} color="#166534" />
            </Pressable>
          </View>

          {isTrashView && (
            <View className="bg-slate-50 px-5 py-2 border-t border-slate-100 flex-row items-center">
              <Ionicons name="trash-outline" size={12} color="#64748b" />
              <Text className="ml-2 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                Deleted {product.deletedAt ? `on ${new Date(product.deletedAt).toLocaleDateString()}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
