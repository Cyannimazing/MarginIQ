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
import { ActionModal } from '../components/ui/ActionModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setSidebarOpen = (open: boolean) => useUIStore.getState().setSidebarOpen(open);
  const activeFilter = useUIStore((state) => state.activeFilter);
  const setActiveFilter = (filter: string) => useUIStore.getState().setActiveFilter(filter);
  const viewMode = useUIStore((state) => state.viewMode);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    isAlert?: boolean;
    onConfirm?: () => void;
  }>({ visible: false, title: '', message: '', confirmText: 'Confirm' });

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

  const currentProduct = useMemo(() => {
    if (selectedProductId === null) return null;
    return products.find(p => p.id === selectedProductId) || trashProducts.find(p => p.id === selectedProductId) || null;
  }, [products, trashProducts, selectedProductId]);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (err: any) {
      setModalState({
        visible: true,
        title: 'Error',
        message: err.message || 'Action failed.',
        confirmText: 'OK',
        isAlert: true,
      });
    }
  };

  const confirmAction = (title: string, message: string, confirmText: string, action: () => Promise<void> | void, isDestructive = false) => {
    setModalState({
      visible: true,
      title,
      message,
      confirmText,
      isDestructive,
      isAlert: false,
      onConfirm: async () => {
        setModalState((s: any) => ({ ...s, visible: false }));
        await handleAction(async () => await action());
      }
    });
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
              onPress={() => setSelectedProductId(item.id)}
              onLongPress={(p) => setSelectedProductId(p.id)}
              onChevronPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
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
        visible={!!selectedProductId}
        product={currentProduct}
        onClose={() => setSelectedProductId(null)}
        onPin={(id) => handleAction(() => togglePin(id))}
        onArchive={(id) => handleAction(() => toggleArchive(id))}
        onColorChange={(id, color) => handleAction(() => updateColor(id, color))}
        onTrash={(id) => confirmAction('Move to Trash', 'Are you sure you want to move this product to the trash?', 'Move to Trash', () => trashProduct(id), true)}
        onRestore={(id) => confirmAction('Restore Product', 'Are you sure you want to restore this product?', 'Restore', () => restoreProduct(id), false)}
        onDeletePermanent={(id) => confirmAction('Delete Forever', 'Permanently delete this product? This action cannot be undone.', 'Delete Forever', () => removeProduct(id), true)}
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

      <ActionModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        primaryActionText={modalState.isAlert ? 'OK' : modalState.confirmText}
        secondaryActionText={modalState.isAlert ? undefined : 'Cancel'}
        isDestructive={!modalState.isAlert && modalState.isDestructive}
        onPrimaryAction={() => {
          if (modalState.isAlert) {
            setModalState((s: any) => ({ ...s, visible: false }));
          } else {
            modalState.onConfirm?.();
          }
        }}
        onSecondaryAction={() => setModalState((s: any) => ({ ...s, visible: false }))}
      />
    </View>
  );
}