import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useProductStore } from '../stores/productStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ProductCard } from '../features/products/components/ProductCard';
import { ActionModal } from '../components/ui/ActionModal';
import { formatMoney } from '../utils/currency';
import { normalizeUnitsPerSale, saleUnitDisplayName } from '../utils/productEconomics';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductList'>;

export function ProductListScreen({ navigation }: Props) {
  const products = useProductStore((state) => state.products);
  const costGroups = useProductStore((state) => state.costGroups);
  const isLoading = useProductStore((state) => state.isLoading);
  const error = useProductStore((state) => state.error);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  const [isGroupingMode, setIsGroupingMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const addCostGroup = useProductStore((state) => state.addCostGroup);
  const editProduct = useProductStore((state) => state.editProduct);

  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isError?: boolean;
    onConfirm?: () => void;
  }>({ visible: false, title: '', message: '' });

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleDelete = (id: number, name: string) => {
    setModalState({
      visible: true,
      title: 'Delete Product',
      message: `Remove "${name}" and all linked ingredient rows?`,
      onConfirm: () => {
        void removeProduct(id);
      },
    });
  };

  const getGroupName = (costGroupId: number | null | undefined) => {
    if (!costGroupId) return null;
    return costGroups.find((group) => group.id === costGroupId)?.name ?? null;
  };

  const toggleSelection = (id: number) => {
    setSelectedProductIds((prev: number[]) => 
      prev.includes(id) ? prev.filter((pid: number) => pid !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupNameInput.trim()) return;
    setIsCreatingGroup(true);
    try {
      // 1. Create the new cost group (which acts as our visual group)
      const groupId = await addCostGroup({
        name: groupNameInput.trim(),
        monthlySharedCost: 0,
      });
      // 2. Update all selected products to belong to this new group
      for (const pid of selectedProductIds) {
        await editProduct(pid, { costGroupId: groupId });
      }

      setIsGroupModalVisible(false);
      setGroupNameInput('');
      setIsGroupingMode(false);
      setSelectedProductIds([]);
    } catch {
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Unable to create product group.',
        isError: true,
      });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    // Priority 1: Grouped items to the top
    const aHasGroup = a.costGroupId != null;
    const bHasGroup = b.costGroupId != null;
    
    if (aHasGroup && !bHasGroup) return -1;
    if (!aHasGroup && bHasGroup) return 1;

    // Priority 2: Sort by Group ID so items in the same group stay visually unified
    if (aHasGroup && bHasGroup) {
      if (a.costGroupId !== b.costGroupId) {
        return (a.costGroupId || 0) - (b.costGroupId || 0);
      }
    }

    // Priority 3: Fallback to newest items
    return b.id - a.id;
  });

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
          data={sortedProducts}
          keyExtractor={(item) => String(item.id)}
          refreshing={isLoading}
          onRefresh={() => void loadProducts()}
          contentContainerClassName="gap-2.5 pb-4"
          ListEmptyComponent={
            <View className="items-center py-10">
              <Text className="text-sm text-slate-500">
                {isLoading ? 'Loading products...' : 'No products yet. Add one to start.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isSelected = selectedProductIds.includes(item.id);
            const prevItem = index > 0 ? sortedProducts[index - 1] : null;
            const isNewGroup = item.costGroupId != null && (!prevItem || prevItem.costGroupId !== item.costGroupId);
            const groupName = getGroupName((item as any).costGroupId);

            return (
              <View>
                {/* Visual Group Separator */}
                {isNewGroup && groupName && (
                  <View className="mt-4 mb-2 ml-1">
                    <Text className="text-sm font-black text-brand-700 tracking-widest uppercase">{groupName}</Text>
                  </View>
                )}

                <Pressable
                  onPress={() => {
                    if (isGroupingMode) {
                      toggleSelection(item.id);
                    } else {
                      navigation.navigate('ProductDetail', { productId: item.id });
                    }
                  }}
                  className={isNewGroup ? "" : "mt-1"}
                >
                  <View className={`flex-row items-center justify-between rounded-2xl border p-4 active:bg-slate-50 ${isSelected ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 bg-white'}`}>
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-slate-900">{item.name}</Text>
                      <Text className="mt-0.5 text-sm text-slate-500">
                        {item.category} • Batch: {item.batchSize}
                        {(() => {
                          const ups = normalizeUnitsPerSale((item as any).unitsPerSale, item.batchSize);
                          if (ups <= 1) return '';
                          const lbl = saleUnitDisplayName((item as any).saleUnitLabel, ups);
                          return ` • ${ups} pcs / ${lbl}`;
                        })()}
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

                    {isGroupingMode ? (
                      <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${isSelected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                    )}
                  </View>
                </Pressable>
              </View>
            );
          }}
        />

        {/* Group Name Modal */}
        <Modal visible={isGroupModalVisible} transparent animationType="fade" onRequestClose={() => setIsGroupModalVisible(false)}>
          <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="flex-1 bg-black/50 justify-center items-center px-6">
              <View className="bg-white rounded-[32px] w-full p-6 shadow-xl">
                <Text className="text-xl font-black text-brand-900 text-center mb-2">Name Your Group</Text>
                <Text className="text-sm font-medium text-slate-500 text-center mb-6">Create a shared category for {selectedProductIds.length} product(s).</Text>

                <TextInput
                  value={groupNameInput}
                  onChangeText={setGroupNameInput}
                  placeholder="e.g. Summer Collection"
                  placeholderTextColor="#adb5bd"
                  autoFocus
                  className="rounded-3xl bg-brand-50/50 border border-brand-100 px-5 py-4 text-base font-bold text-brand-900 mb-6"
                />

                <View className="flex-row gap-3">
                  <Pressable className="flex-1" onPress={() => { setIsGroupModalVisible(false); setGroupNameInput(''); }}>
                    <View className="h-14 items-center justify-center rounded-3xl bg-slate-100">
                      <Text className="font-bold text-slate-600">Cancel</Text>
                    </View>
                  </Pressable>
                  <Pressable className="flex-1" onPress={() => void handleCreateGroup()} disabled={isCreatingGroup || !groupNameInput.trim()}>
                    <View className={`h-14 items-center justify-center rounded-3xl ${isCreatingGroup || !groupNameInput.trim() ? 'bg-brand-400' : 'bg-brand-900'}`}>
                      <Text className="font-bold text-white">{isCreatingGroup ? 'Saving...' : 'Confirm'}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>

      {/* Bottom action bar — sits below the list, never overlaps it */}
      <View className="flex-row items-center justify-end gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100">
        {isGroupingMode ? (
          <>
            <Pressable onPress={() => { setIsGroupingMode(false); setSelectedProductIds([]); }}>
              <View className="rounded-full bg-white border border-slate-200 px-5 py-3">
                <Text className="font-bold text-slate-700 tracking-wide">Cancel</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => selectedProductIds.length > 0 && setIsGroupModalVisible(true)}
              disabled={selectedProductIds.length === 0}
            >
              <View className={`flex-row items-center rounded-[24px] px-6 py-3 ${selectedProductIds.length > 0 ? 'bg-brand-900' : 'bg-slate-300'}`}>
                <Ionicons name="layers" size={18} color="white" style={{ marginRight: 6 }} />
                <Text className="font-bold text-white tracking-wide">
                  Create Group {selectedProductIds.length > 0 ? `(${selectedProductIds.length})` : ''}
                </Text>
              </View>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => setIsGroupingMode(true)}>
              <View className="flex-row items-center rounded-full bg-brand-50 border border-brand-200 px-5 py-3">
                <Ionicons name="layers-outline" size={18} color="#14532d" style={{ marginRight: 6 }} />
                <Text className="font-bold text-brand-800 tracking-wide">Group</Text>
              </View>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('ProductForm', { productId: undefined })}>
              <View className="flex-row items-center rounded-[24px] bg-brand-900 px-6 py-3">
                <Ionicons name="add" size={20} color="white" style={{ marginRight: 4, marginLeft: -4 }} />
                <Text className="font-bold text-white tracking-wide">Add Product</Text>
              </View>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
