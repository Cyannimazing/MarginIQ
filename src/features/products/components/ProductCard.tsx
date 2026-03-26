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
  groupName?: string | null;
  onPress: () => void;
  onLongPress: (product: any) => void;
  onChevronPress: () => void;
  earned?: number;
  currencyCode: string;
  isTrashView?: boolean;
  isGroupingMode?: boolean;
  isSelected?: boolean;
  isGrouped?: boolean;
};

export function ProductCard({ 
  product, 
  groupName,
  onPress, 
  onLongPress,
  onChevronPress,
  earned = 0, 
  currencyCode,
  isTrashView,
  isGroupingMode,
  isSelected,
  isGrouped,
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
      <View style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        opacity: isGroupingMode && isGrouped ? 0.5 : 1,
      }}>
        <View 
          style={{ 
            backgroundColor, 
            borderColor, 
            borderWidth: product.isPinned && !isTrashView ? 2 : 1,
            borderRadius: 24,
            overflow: 'hidden',
            position: 'relative',
          }} 
        >
          {isTrashView && (
            <View style={{
              backgroundColor: '#f8fafc',
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Ionicons name="trash-outline" size={12} color="#64748b" />
              <Text style={{
                marginLeft: 8,
                fontSize: 10,
                color: '#64748b',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: -0.5,
              }}>
                Deleted {product.deletedAt ? `on ${new Date(product.deletedAt).toLocaleDateString()}` : ''}
              </Text>
            </View>
          )}

          <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                 <Text style={{
                   fontSize: 10,
                   fontWeight: '900',
                   textTransform: 'uppercase',
                   letterSpacing: 1,
                   color: product.isPinned && !isTrashView ? '#14532d' : '#166534',
                 }}>
                   {product.isPinned && !isTrashView ? '★ PRIORITY' : (product.category || 'NO CATEGORY')}
                 </Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#14532d', paddingRight: 32 }} numberOfLines={1}>{product.name}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#15803d', marginTop: 2 }}>
                {formatMoney(product.sellingPrice, currencyCode)} 
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: -0.5 }}> • {pricingLabel}</Text>
              </Text>
            </View>

            {isGroupingMode ? (
              <View style={{
                height: 24,
                width: 24,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isGrouped ? '#e2e8f0' : isSelected ? '#14532d' : '#cbd5e1',
                backgroundColor: isGrouped ? '#f1f5f9' : isSelected ? '#14532d' : '#ffffff',
              }}>
                {isSelected && !isGrouped && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
            ) : (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onChevronPress();
                }}
              >
                <Ionicons name="chevron-forward" size={18} color="#166534" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
