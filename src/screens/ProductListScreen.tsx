import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useProductStore } from '../stores/productStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductList'>;

export function ProductListScreen({ navigation }: Props) {
  const products = useProductStore((state) => state.products);
  const isLoading = useProductStore((state) => state.isLoading);
  const error = useProductStore((state) => state.error);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Delete Product', `Remove "${name}" and all linked ingredient rows?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void removeProduct(id);
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      <View className="flex-1 px-4 pt-4">
        <View className="mb-4">
          <Text className="text-base font-bold text-slate-900">Products</Text>
          <Text className="mt-1 text-sm text-slate-600">
            Manage your product catalog, base costs, and linked ingredient recipes.
          </Text>
        </View>
      {!!error && <Text className="mb-2 text-sm text-red-600">{error}</Text>}

        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          refreshing={isLoading}
          onRefresh={() => void loadProducts()}
          contentContainerClassName="gap-2.5 pb-24"
          ListEmptyComponent={
            <View className="items-center py-10">
              <Text className="text-sm text-slate-500">
                {isLoading ? 'Loading products...' : 'No products yet. Add one to start.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
            >
              <View className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-slate-900">{item.name}</Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    {item.category} • Batch: {item.batchSize}
                  </Text>
                  <View className="mt-3 flex-row items-center justify-between pr-4">
                     <View>
                        <Text className="text-xs font-semibold text-slate-700">
                          {formatMoney(item.sellingPrice, currencyCode)}
                        </Text>
                        <Text className="text-[10px] text-slate-500">Selling Price</Text>
                     </View>
                     <View className="items-end">
                        <Text className="text-xs font-semibold text-brand-700">
                          {item.pricingMethod === 'fixed' 
                            ? formatMoney(item.targetMargin, currencyCode)
                            : `${(item.targetMargin * 100).toFixed(0)}%`}
                        </Text>
                        <Text className="text-[10px] text-slate-500">
                          Target {item.pricingMethod === 'fixed' ? 'Profit' : 'Margin'}
                        </Text>
                     </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </View>
            </Pressable>
          )}
        />

        <Pressable
          onPress={() => navigation.navigate('ProductForm', { productId: undefined })}
        >
          <View className="absolute bottom-4 right-4 rounded-full bg-brand-600 px-4 py-3">
            <Text className="font-semibold text-white">+ Add Product</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
