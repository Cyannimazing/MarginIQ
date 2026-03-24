import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  useDerivedValue,
  SharedValue
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useProductStore } from '../stores/productStore';
import { useSalesStore } from '../stores/salesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { FilterChip } from '../components/ui/FilterChip';
import { ProductCard } from '../features/products/components/ProductCard';
import { formatMoney } from '../utils/currency';
import { ProductActionModal } from '../features/products/components/ProductActionModal';
import { useUIStore } from '../stores/uiStore';
import { ActionModal } from '../components/ui/ActionModal';
import { OptionChip } from '../components/ui/OptionChip';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setSidebarOpen = (open: boolean) => useUIStore.getState().setSidebarOpen(open);
  const activeFilter = useUIStore((state) => state.activeFilter);
  const setActiveFilter = (filter: string) => useUIStore.getState().setActiveFilter(filter);
  const viewMode = useUIStore((state) => state.viewMode);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isGroupingMode, setIsGroupingMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [updateGroupId, setUpdateGroupId] = useState<number | null>(null);
  const [isFABExpanded, setIsFABExpanded] = useState(false);

  // Animation values
  const fabRotation = useDerivedValue(() => {
    return withSpring(isFABExpanded ? 1 : 0, { damping: 15 });
  });

  const menuOpacity = useDerivedValue(() => {
    return withTiming(isFABExpanded ? 1 : 0, { duration: 250 });
  });

  const backdropOpacity = useDerivedValue(() => {
    return withTiming(isFABExpanded ? 0.5 : 0, { duration: 300 });
  });

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(fabRotation.value, [0, 1], [0, 135])}deg` }]
  }));

  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuOpacity.value,
    transform: [{ translateY: interpolate(menuOpacity.value, [0, 1], [20, 0]) }],
    pointerEvents: isFABExpanded ? 'auto' : 'none' as any
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const [overheadModal, setOverheadModal] = useState<{
    visible: boolean;
    type: 'group' | 'product';
    id: number;
    currentValue: string;
  }>({ visible: false, type: 'product', id: 0, currentValue: '' });

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
  const costGroups = useProductStore((state) => state.costGroups);
  const trashProducts = useProductStore((state) => state.trashProducts);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const loadTrashProducts = useProductStore((state) => state.loadTrashProducts);
  const togglePin = useProductStore((state) => state.togglePin);
  const toggleArchive = useProductStore((state) => state.toggleArchive);
  const updateColor = useProductStore((state) => state.updateColor);
  const trashProduct = useProductStore((state) => state.trashProduct);
  const restoreProduct = useProductStore((state) => state.restoreProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const addCostGroup = useProductStore((state) => state.addCostGroup);
  const editCostGroup = useProductStore((state) => state.editCostGroup);
  const deleteCostGroup = useProductStore((state) => state.deleteCostGroup);
  const editProduct = useProductStore((state) => state.editProduct);
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

  const groupedData = useMemo(() => {
    let list = activeFilter === 'All'
      ? currentList
      : currentList.filter((p) => p.category === activeFilter);

    const groupsMap = new Map<number, any[]>();
    const ungrouped: any[] = [];

    list.forEach((p) => {
      if (p.costGroupId != null) {
        if (!groupsMap.has(p.costGroupId)) groupsMap.set(p.costGroupId, []);
        groupsMap.get(p.costGroupId)!.push(p);
      } else {
        ungrouped.push(p);
      }
    });

    const groups = Array.from(groupsMap.entries()).map(([groupId, prods]) => {
      const g = costGroups.find((g) => g.id === groupId);
      return {
        type: 'group' as const,
        costGroupId: groupId,
        groupName: g?.name ?? 'Unnamed Group',
        monthlySharedCost: g?.monthlySharedCost ?? 0,
        products: prods.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.id - a.id;
        }),
      };
    });

    groups.sort((a, b) => a.costGroupId - b.costGroupId);

    ungrouped.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.id - a.id;
    });

    return [...groups, ...ungrouped.map((p) => ({ type: 'product' as const, product: p }))];
  }, [currentList, activeFilter, costGroups]);

  const currentProduct = useMemo(() => {
    if (selectedProductId === null) return null;
    return products.find(p => p.id === selectedProductId) || trashProducts.find(p => p.id === selectedProductId) || null;
  }, [products, trashProducts, selectedProductId]);

  const toggleSelection = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupNameInput.trim()) return;
    setIsCreatingGroup(true);
    try {
      if (updateGroupId) {
        // Update existing group
        await editCostGroup(updateGroupId, { name: groupNameInput.trim() });
        const currentGroupProducts = products.filter((p) => p.costGroupId === updateGroupId);

        // If less than 2 products, dissolve the group
        if (selectedProductIds.length < 2) {
          await deleteCostGroup(updateGroupId);
        } else {
          // Remove unselected ones
          for (const p of currentGroupProducts) {
            if (!selectedProductIds.includes(p.id)) {
              await editProduct(p.id, { costGroupId: null });
            }
          }
          // Add newly selected ones
          for (const pid of selectedProductIds) {
            if (!currentGroupProducts.some((p) => p.id === pid)) {
              await editProduct(pid, { costGroupId: updateGroupId });
            }
          }
        }
      } else {
        // Create new
        if (selectedProductIds.length < 2) {
          setModalState({
            visible: true,
            title: 'Group Required',
            message: 'Please select at least 2 products to create a group.',
            confirmText: 'OK',
            isAlert: true,
          });
          setIsCreatingGroup(false);
          return;
        }
        const groupId = await addCostGroup({
          name: groupNameInput.trim(),
          monthlySharedCost: 0,
        });
        for (const pid of selectedProductIds) {
          await editProduct(pid, { costGroupId: groupId });
        }
      }

      setIsGroupModalVisible(false);
      setGroupNameInput('');
      setIsGroupingMode(false);
      setSelectedProductIds([]);
      setUpdateGroupId(null);
    } catch {
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Unable to save product group.',
        confirmText: 'OK',
        isAlert: true,
      });
    } finally {
      setIsCreatingGroup(false);
    }
  };

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

  const getProductGroupName = (product: any) => {
    const costGroupId = (product as any).costGroupId;
    if (!costGroupId) return null;
    return costGroups.find((group) => group.id === costGroupId)?.name ?? null;
  };

  React.useLayoutEffect(() => {
    const title = viewMode === 'trash' ? 'Trash' : viewMode === 'archived' ? 'Archive' : 'Products';
    navigation.setOptions({ title });
  }, [navigation, viewMode]);

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={groupedData}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyExtractor={(item, index) => item.type === 'group' ? `group-${item.costGroupId}` : `prod-${item.product.id}`}
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
        renderItem={({ item }) => {
          if (item.type === 'group') {
            const hasOverhead = item.monthlySharedCost > 0;
            return (
              <View className="px-6 mb-8">
                <View className="bg-brand-50 border border-brand-200 rounded-[32px] overflow-hidden" style={{ zIndex: 10, elevation: 2 }}>
                  <View className="px-6 py-4 bg-brand-100/80 flex-row items-center justify-between">
                    <Text className="text-sm font-black text-brand-900 tracking-[2px] uppercase">{item.groupName}</Text>
                    {!isGroupingMode && (
                      <Pressable
                        onPress={() => {
                          setIsGroupingMode(true);
                          setUpdateGroupId(item.costGroupId);
                          setGroupNameInput(item.groupName);
                          setSelectedProductIds(item.products.map(p => p.id));
                        }}
                        className="w-8 h-8 rounded-full bg-white items-center justify-center shadow-sm"
                      >
                        <Ionicons name="pencil" size={14} color="#14532d" />
                      </Pressable>
                    )}
                  </View>
                  <View className="px-4 py-4 gap-3 bg-white/50">
                    {item.products.map(p => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <ProductCard
                          key={p.id}
                          product={p}
                          isGroupingMode={isGroupingMode}
                          isSelected={isSelected}
                          isGrouped={isGroupingMode && p.costGroupId != null && p.costGroupId !== updateGroupId}
                          onPress={() => {
                            if (isGroupingMode) {
                              if (p.costGroupId != null && p.costGroupId !== updateGroupId) return;
                              toggleSelection(p.id);
                            } else {
                              navigation.navigate('ProductDetail', { productId: p.id });
                            }
                          }}
                          onLongPress={(pr) => !isGroupingMode && setSelectedProductId(pr.id)}
                          onChevronPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                          earned={getProductEarned(p.id)}
                          currencyCode={currencyCode}
                          isTrashView={viewMode === 'trash'}
                        />
                      );
                    })}
                  </View>
                </View>

                {/* Tucked Badge - Positioned to always be visible */}
                <View className="flex-row justify-center -mt-4" style={{ zIndex: 30, elevation: 8 }}>
                  <Pressable
                    onPress={() => setOverheadModal({
                      visible: true,
                      type: 'group',
                      id: item.costGroupId,
                      currentValue: item.monthlySharedCost ? item.monthlySharedCost.toString() : ''
                    })}
                  >
                    <View className="bg-brand-900 rounded-full px-5 py-2.5 shadow-lg border-2 border-white flex-row items-center">
                      <Ionicons name="calculator" size={12} color="white" style={{ marginRight: 6 }} />
                      <Text className="text-[10px] font-black text-white tracking-widest uppercase">
                        Monthly Overhead: {formatMoney(item.monthlySharedCost, currencyCode)}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            );
          } else {
            const p = item.product;
            const isSelected = selectedProductIds.includes(p.id);
            const hasOverhead = (p.monthlyOverhead || 0) > 0;

            return (
              <View className="px-6 mb-6">
                <View style={{ zIndex: 10, elevation: 2 }}>
                  <ProductCard
                    product={p}
                    isGroupingMode={isGroupingMode}
                    isSelected={isSelected}
                    isGrouped={isGroupingMode && p.costGroupId != null && p.costGroupId !== updateGroupId}
                    onPress={() => {
                      if (isGroupingMode) {
                        if (p.costGroupId != null && p.costGroupId !== updateGroupId) return;
                        toggleSelection(p.id);
                      } else {
                        navigation.navigate('ProductDetail', { productId: p.id });
                      }
                    }}
                    onLongPress={(pr) => !isGroupingMode && setSelectedProductId(pr.id)}
                    onChevronPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                    earned={getProductEarned(p.id)}
                    currencyCode={currencyCode}
                    isTrashView={viewMode === 'trash'}
                  />
                </View>

                <View className="flex-row justify-center -mt-3" style={{ zIndex: 30, elevation: 8 }}>
                  <Pressable
                    onPress={() => setOverheadModal({
                      visible: true,
                      type: 'product',
                      id: p.id,
                      currentValue: p.monthlyOverhead ? p.monthlyOverhead.toString() : ''
                    })}
                  >
                    <View className="bg-brand-900 rounded-full px-4 py-1.5 shadow-md border-2 border-white flex-row items-center">
                      <Ionicons name="calculator" size={10} color="white" style={{ marginRight: 4 }} />
                      <Text className="text-[9px] font-black text-white tracking-widest uppercase">
                        Monthly Overhead: {formatMoney(p.monthlyOverhead || 0, currencyCode)}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            );
          }
        }}
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
        onTrash={(id) => confirmAction('Move to Trash', 'Are you sure you want to move this product to the trash?', 'Move', () => trashProduct(id), true)}
        onRestore={(id) => confirmAction('Restore Product', 'Are you sure you want to restore this product?', 'Restore', () => restoreProduct(id), false)}
        onDeletePermanent={(id) => confirmAction('Delete Forever', 'Permanently delete this product? This action cannot be undone.', 'Delete Forever', () => removeProduct(id), true)}
        navigation={navigation}
      />

      {/* Group Modal */}
      <Modal visible={isGroupModalVisible} transparent animationType="fade" onRequestClose={() => setIsGroupModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-[32px] w-full p-6 shadow-xl">
            <Text className="text-xl font-black text-brand-900 text-center mb-2">
              {updateGroupId ? 'Update Group' : 'Name Your Group'}
            </Text>
            <Text className="text-sm font-medium text-slate-500 text-center mb-6">
              {updateGroupId
                ? `Saving selection of ${selectedProductIds.length} product(s).`
                : `Create a shared category for ${selectedProductIds.length} product(s).`}
            </Text>

            <TextInput
              value={groupNameInput}
              onChangeText={setGroupNameInput}
              placeholder="e.g. Summer Collection"
              placeholderTextColor="#adb5bd"
              autoFocus
              className="rounded-3xl bg-brand-50/50 border border-brand-100 px-5 py-4 text-base font-bold text-brand-900 mb-6"
            />

            <View className="flex-row gap-3">
              <Pressable className="flex-1" onPress={() => { setIsGroupModalVisible(false); }}>
                <View className="h-14 items-center justify-center rounded-3xl bg-slate-100">
                  <Text className="font-bold text-slate-600">Back</Text>
                </View>
              </Pressable>
              <Pressable 
                className="flex-1" 
                onPress={() => void handleCreateGroup()} 
                disabled={isCreatingGroup || !groupNameInput.trim()}
              >
                <View className={`h-14 items-center justify-center rounded-3xl overflow-hidden ${isCreatingGroup || !groupNameInput.trim() ? 'bg-slate-200' : 'bg-brand-900'}`}>
                  <Text className={`font-bold ${isCreatingGroup || !groupNameInput.trim() ? 'text-slate-400' : 'text-white'}`}>
                    {isCreatingGroup ? 'Saving...' : 'Confirm'}
                  </Text>
                </View>
              </Pressable>
            </View>


          </View>
        </View>
      </Modal>

      {/* Floating Action Buttons */}
      {viewMode === 'active' && !isGroupModalVisible && (
        <>
          {/* Animated Background Overlay */}
          {isFABExpanded && !isGroupingMode && (
            <Pressable
              style={[StyleSheet.absoluteFill, { zIndex: 40 }]}
              onPress={() => setIsFABExpanded(false)}
            >
              <Animated.View
                style={[
                  { flex: 1, backgroundColor: '#0f172a' },
                  backdropStyle
                ]}
              />
            </Pressable>
          )}

          <View style={{
            position: 'absolute',
            bottom: Math.max(insets.bottom, 24) + 16,
            right: 24,
            alignItems: 'flex-end',
            gap: 12,
            zIndex: 50,
          }}>
            {isGroupingMode ? (
              <View style={{ alignItems: 'flex-end', gap: 10 }}>
                {/* 4. Top - Shortest: Delete */}
                {updateGroupId != null && (
                  <Pressable
                    onPress={() => {
                      confirmAction(
                        'Delete Group',
                        'Are you sure you want to delete this group? Products will be ungrouped.',
                        'Delete',
                        async () => {
                          if (!updateGroupId) return;
                          await deleteCostGroup(updateGroupId);
                          setIsGroupingMode(false);
                          setSelectedProductIds([]);
                          setUpdateGroupId(null);
                        },
                        true
                      );
                    }}
                  >
                    <View className="w-28 h-14 rounded-full bg-red-50 border border-red-100 shadow-sm flex-row items-center justify-center gap-1.5">
                      <Ionicons name="trash-outline" size={13} color="#dc2626" />
                      <Text className="font-bold text-red-600 text-[10px] uppercase tracking-widest text-center">Delete</Text>
                    </View>
                  </Pressable>
                )}

                {/* 3. Small: Cancel */}
                <Pressable onPress={() => { setIsGroupingMode(false); setSelectedProductIds([]); setUpdateGroupId(null); }}>
                  <View className="w-40 h-14 rounded-full bg-white border border-slate-200 shadow-sm flex-row items-center justify-center">
                    <Text className="font-bold text-slate-500 text-[11px] uppercase tracking-widest text-center">Cancel</Text>
                  </View>
                </Pressable>

                {/* 2. Medium: Edit Name */}
                {updateGroupId != null && (
                  <Pressable onPress={() => setIsGroupModalVisible(true)}>
                    <View className="w-52 h-14 rounded-full bg-white border border-brand-100 shadow-md flex-row items-center justify-center gap-2">
                      <Ionicons name="create-outline" size={14} color="#14532d" />
                      <Text className="font-bold text-brand-900 text-[12px] uppercase tracking-widest text-center">Edit Name</Text>
                    </View>
                  </Pressable>
                )}

                {/* 1. Bottom - Longest: Save Selection / Create Group */}
                <Pressable
                  onPress={() => {
                    if (selectedProductIds.length < 2 && !updateGroupId) {
                      setModalState({
                        visible: true,
                        title: 'Selection Required',
                        message: 'Select at least 2 products to form a group.',
                        confirmText: 'OK',
                        isAlert: true,
                      });
                      return;
                    }
                    if (updateGroupId) void handleCreateGroup();
                    else setIsGroupModalVisible(true);
                  }}
                >
                  <View className="w-64 h-14 flex-row items-center justify-center rounded-full shadow-xl bg-brand-900 border-2 border-white">
                    <Ionicons name="layers" size={18} color="white" style={{ marginRight: 6 }} />
                    <Text className="font-black text-white text-[14px] uppercase tracking-widest text-center">
                      {updateGroupId ? 'Save Selection' : 'Create Group'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Animated Expandable Sub-Buttons */}
                <Animated.View style={[menuStyle, { alignItems: 'flex-end', gap: 12, marginBottom: 4 }]}>
                  {/* AI Chat Button */}
                  <Pressable
                    onPress={() => {
                      setIsFABExpanded(false);
                      setModalState({
                        visible: true,
                        title: 'Coming Soon 🤖',
                        message: 'AI Chat and smart analysis features are currently under construction. Stay tuned!',
                        confirmText: 'Got it',
                        isAlert: true,
                      });
                    }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                        <Text className="text-[10px] font-black text-brand-900 uppercase tracking-widest">AI Analyst</Text>
                      </View>
                      <View className="h-12 w-12 rounded-full bg-brand-200 items-center justify-center border-2 border-white shadow-md">
                        <Ionicons name="sparkles" size={20} color="#166534" />
                      </View>
                    </View>
                  </Pressable>

                  {/* Create Group Button */}
                  <Pressable
                    onPress={() => {
                      setIsFABExpanded(false);
                      setIsGroupingMode(true);
                    }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                        <Text className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Create Group</Text>
                      </View>
                      <View className="h-12 w-12 rounded-full bg-white items-center justify-center border-2 border-brand-900 shadow-md">
                        <Ionicons name="layers" size={20} color="#166534" />
                      </View>
                    </View>
                  </Pressable>

                  {/* Add Product Button */}
                  <Pressable
                    onPress={() => {
                      setIsFABExpanded(false);
                      navigation.navigate('ProductForm');
                    }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                        <Text className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Add Product</Text>
                      </View>
                      <View className="h-12 w-12 rounded-full bg-brand-900 items-center justify-center border-2 border-white shadow-md">
                        <Ionicons name="cube" size={20} color="white" />
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>

                {/* Main Action FAB */}
                <Pressable
                  onPress={() => setIsFABExpanded(!isFABExpanded)}
                  style={{
                    height: 64,
                    width: 64,
                    borderRadius: 32,
                    backgroundColor: isFABExpanded ? '#0f172a' : '#14532d',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 12,
                    borderWidth: 4,
                    borderColor: '#ffffff',
                  }}
                >
                  <Animated.View style={rotationStyle}>
                    <Ionicons
                      name="add"
                      size={32}
                      color="white"
                    />
                  </Animated.View>
                </Pressable>
              </>
            )}
          </View>
        </>
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

      {/* Overhead Modal */}
      <Modal visible={overheadModal.visible} transparent animationType="fade" onRequestClose={() => setOverheadModal(s => ({ ...s, visible: false }))}>
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-[32px] w-full p-6 shadow-xl">
            <Text className="text-xl font-black text-brand-900 text-center mb-2">Monthly Overhead</Text>
            <Text className="text-sm font-medium text-slate-500 text-center mb-6">
              Enter the total recurring cost for this {overheadModal.type}.
            </Text>

            <TextInput
              value={overheadModal.currentValue}
              onChangeText={(val) => setOverheadModal(s => ({ ...s, currentValue: val }))}
              placeholder="0.00"
              placeholderTextColor="#adb5bd"
              keyboardType="numeric"
              autoFocus
              className="rounded-[24px] bg-brand-50/50 border border-brand-100 px-5 py-4 text-base font-bold text-center text-brand-900 mb-6"
            />

            <View className="flex-row gap-3">
              <Pressable className="flex-1" onPress={() => setOverheadModal(s => ({ ...s, visible: false }))}>
                <View className="h-14 items-center justify-center rounded-[24px] bg-slate-100">
                  <Text className="font-bold text-slate-600">Cancel</Text>
                </View>
              </Pressable>
              <Pressable
                className="flex-1"
                onPress={async () => {
                  const val = parseFloat(overheadModal.currentValue) || 0;
                  try {
                    if (overheadModal.type === 'group') {
                      await editCostGroup(overheadModal.id, { monthlySharedCost: val });
                    } else {
                      await editProduct(overheadModal.id, { monthlyOverhead: val });
                    }
                    setOverheadModal(s => ({ ...s, visible: false }));
                  } catch {
                    setModalState({
                      visible: true,
                      title: 'Error',
                      message: 'Unable to save overhead.',
                      confirmText: 'OK',
                      isAlert: true,
                    });
                  }
                }}
              >
                <View className="h-14 items-center justify-center rounded-[24px] bg-brand-900">
                  <Text className="font-bold text-white">Save</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
