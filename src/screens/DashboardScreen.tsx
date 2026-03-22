import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useProductStore } from '../stores/productStore';
import { useSalesStore } from '../stores/salesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { FilterChip } from '../components/ui/FilterChip';
import { ProductCard } from '../features/products/components/ProductCard';
import { ProductActionModal } from '../features/products/components/ProductActionModal';
import { useUIStore } from '../stores/uiStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setSidebarOpen = (open: boolean) => useUIStore.getState().setSidebarOpen(open);
  const activeFilter = useUIStore((state) => state.activeFilter);
  const setActiveFilter = (filter: string) => useUIStore.getState().setActiveFilter(filter);
  const viewMode = useUIStore((state) => state.viewMode);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const products = useProductStore((state) => state.products);
  const trashProducts = useProductStore((state) => state.trashProducts);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const loadTrashProducts = useProductStore((state) => state.loadTrashProducts);
  const togglePin = useProductStore((state) => state.togglePin);
  const toggleArchive = useProductStore((state) => state.toggleArchive);
  const updateColor = useProductStore((state) => state.updateColor);
  const trashProduct = useProductStore((state) => state.trashProduct);
  const restoreProduct = useProductStore((state) => state.restoreProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const loadMonthlySales = useSalesStore((state) => state.loadMonthlySales);
  const monthlySales = useSalesStore((state) => state.monthlySales);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  useEffect(() => {
    void loadProducts();
    void loadTrashProducts();
    void loadMonthlySales();
  }, [loadProducts, loadTrashProducts, loadMonthlySales]);

  const currentList = useMemo(() => {
    if (viewMode === 'trash') return trashProducts;
    if (viewMode === 'archived') return products.filter(p => p.isArchived);
    return products.filter(p => !p.isArchived);
  }, [products, trashProducts, viewMode]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('All');
    currentList.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [currentList]);

  const filteredProducts = useMemo(() => {
    let list = activeFilter === 'All'
      ? currentList
      : currentList.filter((p) => p.category === activeFilter);

    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  }, [currentList, activeFilter]);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Action failed.');
    }
  };

  const getProductEarned = (productId: number) => {
    const entry = monthlySales.find(s => s.productId === productId);
    return entry?.actualProfit || 0;
  };

  React.useLayoutEffect(() => {
    const title = viewMode === 'trash' ? 'Trash' : viewMode === 'archived' ? 'Archive' : 'Products';
    navigation.setOptions({ title });
  }, [navigation, viewMode]);

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={() => (
          <View className="px-6 py-6">
            <FlatList
              data={categories}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <FilterChip
                  label={item}
                  active={activeFilter === item}
                  onPress={() => setActiveFilter(item)}
                />
              )}
              className="mb-2"
            />
          </View>
        )}
        renderItem={({ item }) => (
          <View className="px-6 mb-4">
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
              onLongPress={(p) => setSelectedProduct(p)}
              earned={getProductEarned(item.id)}
              currencyCode={currencyCode}
              isTrashView={viewMode === 'trash'}
            />
          </View>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20 px-10">
            <Ionicons name="cube-outline" size={64} color="#f1f5f9" />
            <Text className="mt-4 text-center text-slate-400 font-bold">
              {viewMode === 'active' ? 'No active products yet.' : 'Empty list.'}
            </Text>
          </View>
        }
      />

      <ProductActionModal
        visible={!!selectedProduct}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onPin={(id) => handleAction(() => togglePin(id))}
        onArchive={(id) => handleAction(() => toggleArchive(id))}
        onColorChange={(id, color) => handleAction(() => updateColor(id, color))}
        onTrash={(id) => handleAction(() => trashProduct(id))}
        onRestore={(id) => handleAction(() => restoreProduct(id))}
        onDeletePermanent={(id) => handleAction(() => removeProduct(id))}
        navigation={navigation}
      />

      {/* Google Keep Style FAB */}
      {viewMode === 'active' && (
        <Pressable
          onPress={() => navigation.navigate('ProductForm')}
          style={{
            position: 'absolute',
            bottom: Math.max(insets.bottom, 24) + 16,
            right: 24,
            height: 64,
            width: 64,
            borderRadius: 32,
            backgroundColor: '#14532d', // brand-900
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#14532d',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 12,
            borderWidth: 4,
            borderColor: '#ffffff',
          }}
        >
          <Ionicons name="add" size={32} color="white" />
        </Pressable>
      )}
    </View>
  );
}