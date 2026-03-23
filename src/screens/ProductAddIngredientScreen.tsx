import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { COST_TYPES } from '../constants/productCategories';
import { RootStackParamList } from '../navigation/types';
import { useIngredientStore } from '../stores/ingredientStore';
import { useProductStore } from '../stores/productStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';
import { ActionModal } from '../components/ui/ActionModal';

const addIngredientSchema = z.object({
  items: z.array(
    z.object({
      ingredientId: z.number().positive(),
      quantityUsed: z.string().trim().min(1, 'Required').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
    })
  ).min(1, 'Select at least one resource'),
  costType: z.enum(COST_TYPES),
});

type AddIngredientValues = z.infer<typeof addIngredientSchema>;
type Props = NativeStackScreenProps<RootStackParamList, 'ProductAddIngredient'>;

export function ProductAddIngredientScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { productId, editLinkId, initialIngredientId, initialQuantity, initialCostType, initialItems } = route.params;
  const pId = Number(productId);

  const ingredients = useIngredientStore((state) => state.ingredients);
  const loadIngredients = useIngredientStore((state) => state.loadIngredients);
  const addIngredientToProduct = useProductStore((state) => state.addIngredientToProduct);
  const bulkAddIngredientsToProduct = useProductStore((state) => state.bulkAddIngredientsToProduct);
  const editProductIngredient = useProductStore((state) => state.editProductIngredient);
  const removeIngredientFromProduct = useProductStore((state) => state.removeIngredientFromProduct);
  const getProductIngredients = useProductStore((state) => state.getProductIngredients);
  const productIngredients = getProductIngredients(pId);
  const loadProductIngredients = useProductStore((state) => state.loadProductIngredients);
  const product = useProductStore((state) => state.products.find(p => p.id === pId));
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  const getTrueUnitCost = (pi: any) => {
    const qty = Math.max(Number(pi.ingredientQuantity) || 1, 0.00000001);
    const yieldFactor = Math.max(Number(pi.ingredientYieldFactor) || 1, 0.00000001);
    const price = Number(pi.ingredientPricePerUnit) || 0;
    const cost = (price / qty) / yieldFactor;
    return isFinite(cost) ? cost : 0;
  };

  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    primaryText?: string;
    secondaryText?: string;
    isDestructive?: boolean;
    onPrimary?: () => void;
    onSecondary?: () => void;
  }>({ visible: false, title: '', message: '' });

  const showAlert = useCallback((title: string, message: string) => {
    setModalState({
      visible: true,
      title,
      message,
      primaryText: 'OK',
      onPrimary: () => setModalState(prev => ({ ...prev, visible: false })),
    });
  }, []);

  const showConfirm = useCallback((title: string, message: string, confirmText: string, onConfirm: () => void, isDestructive = false) => {
    setModalState({
      visible: true,
      title,
      message,
      primaryText: confirmText,
      secondaryText: 'Cancel',
      isDestructive,
      onPrimary: () => {
        setModalState(prev => ({ ...prev, visible: false }));
        onConfirm();
      },
      onSecondary: () => setModalState(prev => ({ ...prev, visible: false })),
    });
  }, []);

  // Local edit group: set when user taps pencil on a linked resource (in-place editing)
  const [localEditGroup, setLocalEditGroup] = useState<{
    editLinkId: number;
    items: { linkId: number; ingredientId: number; quantityUsed: string }[];
  } | null>(null);

  const activeEditLinkId = localEditGroup?.editLinkId ?? editLinkId;
  const activeInitialItems = localEditGroup?.items ?? initialItems;

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (type: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // IDs of ingredients already linked to this product in OTHER compositions
  const alreadyUsedIds = useMemo(() => {
    if (activeEditLinkId && activeInitialItems) {
      // In edit mode: exclude ingredients from OTHER categories (allow ones already in THIS category)
      const editGroupIds = new Set(activeInitialItems.map(i => i.ingredientId));
      return new Set(
        productIngredients
          .filter(pi => !editGroupIds.has(pi.ingredientId))
          .map(pi => pi.ingredientId)
      );
    }
    // Fresh compose: exclude ALL already-linked ingredients
    return new Set(productIngredients.map(pi => pi.ingredientId));
  }, [productIngredients, activeEditLinkId, activeInitialItems]);

  // Available ingredients for this session (not already used elsewhere)
  const availableIngredients = useMemo(
    () => ingredients.filter(i => !alreadyUsedIds.has(i.id)),
    [ingredients, alreadyUsedIds]
  );

  const buildInitialItems = () => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map(i => ({ ingredientId: i.ingredientId, quantityUsed: String(i.quantityUsed) }));
    }
    if (editLinkId && initialIngredientId) {
      return [{ ingredientId: initialIngredientId, quantityUsed: String(initialQuantity || '1') }];
    }
    return [];
  };

  const {
    control,
    setValue,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddIngredientValues>({
    resolver: zodResolver(addIngredientSchema),
    defaultValues: {
      items: buildInitialItems(),
      costType: (initialCostType as any) ?? 'ingredients',
    },
  });

  // Force reset whenever params change
  useEffect(() => {
    reset({
      items: buildInitialItems(),
      costType: (initialCostType as any) ?? 'ingredients',
    });
  }, [productId, editLinkId, initialIngredientId, initialQuantity, initialCostType, initialItems, reset]);

  useEffect(() => {
    void loadIngredients(productId);
    void loadProductIngredients(productId);
  }, [loadIngredients, loadProductIngredients, productId]);

  const selectedItems = watch('items') || [];
  const selectedCostType = watch('costType');

  const handleToggleIngredient = (id: number) => {
    const index = selectedItems.findIndex(i => i.ingredientId === id);
    if (index > -1) {
      if (editLinkId && selectedItems.length === 1) {
        // Warning: if we deselect the last item in edit mode, it's invalid
        showAlert('Selection Required', 'You must have at least one resource selected.');
        return;
      }
      setValue('items', selectedItems.filter((_, idx) => idx !== index), { shouldValidate: true });
    } else {
      const ingredient = ingredients.find(i => i.id === id);
      setValue('items', [...selectedItems, { 
        ingredientId: id,
        quantityUsed: String(ingredient?.quantity ?? (ingredient?.classification === 'fixed' ? '1' : '')),
      }], { shouldValidate: true });
    }
  };

  const onSubmit = async (values: AddIngredientValues, stay: boolean = false) => {
    try {
      if (activeEditLinkId && activeInitialItems && activeInitialItems.length > 0) {
        // Bulk Edit Mode
        const submittedIds = new Set(values.items.map(i => i.ingredientId));

        // 1. Delete items that were in the original group but deselected
        for (const original of activeInitialItems) {
          if (!submittedIds.has(original.ingredientId)) {
            await removeIngredientFromProduct(pId, original.linkId);
          }
        }

        // 2. Prepare Updates and New Items
        const newItems: any[] = [];
        for (const item of values.items) {
          const originalLink = activeInitialItems.find(i => i.ingredientId === item.ingredientId); 
          const ingredient = ingredients.find(i => i.id === item.ingredientId);
          const finalQty = Number(ingredient?.quantity || 1);
          
          if (originalLink) {
            await editProductIngredient(pId, originalLink.linkId, {
              ingredientId: item.ingredientId,
              quantityUsed: finalQty,
              costType: values.costType,
            });
          } else {
            newItems.push({
              productId: pId,
              ingredientId: item.ingredientId,
              quantityUsed: finalQty,
              costType: values.costType,
            });
          }
        }
        if (newItems.length > 0) await bulkAddIngredientsToProduct(newItems);

      } else if (activeEditLinkId) {
        // Legacy single-edit mode
        const primaryIdx = values.items.findIndex(i => i.ingredientId === initialIngredientId);
        const updateIdx = primaryIdx > -1 ? primaryIdx : 0;
        const updateItem = values.items[updateIdx];
        const ingredient = ingredients.find(i => i.id === updateItem.ingredientId);
        const finalQty = Number(ingredient?.quantity || 1);
        
        await editProductIngredient(pId, activeEditLinkId!, {
          ingredientId: updateItem.ingredientId,
          quantityUsed: finalQty,
          costType: values.costType,
        });

        const extraItems: any[] = [];
        for (let i = 0; i < values.items.length; i++) {
          if (i === updateIdx) continue;
          const extra = values.items[i];
          const extraIngredient = ingredients.find(ing => ing.id === extra.ingredientId);
          extraItems.push({
            productId: pId,
            ingredientId: extra.ingredientId,
            quantityUsed: Number(extraIngredient?.quantity || 1),
            costType: values.costType,
          });
        }
        if (extraItems.length > 0) await bulkAddIngredientsToProduct(extraItems);

      } else {
        // Pure Batch Add mode
        const toAdd = values.items.map(item => {
          const ingredient = ingredients.find(i => i.id === item.ingredientId);
          return {
            productId: pId,
            ingredientId: item.ingredientId,
            quantityUsed: Number(ingredient?.quantity || 1),
            costType: values.costType,
          };
        });
        await bulkAddIngredientsToProduct(toAdd);
      }
      
      setLocalEditGroup(null);
      reset({ items: [], costType: 'ingredients' });
      if (!stay) navigation.goBack();
    } catch (err: any) {
      console.error(err);
      showAlert('Error', `Unable to process resource links: ${err?.message || 'Unknown error'}`);
    }
  };

  if (!ingredients.length && !productIngredients.length) {
    return (
      <View className="flex-1 items-center bg-brand-50/20 px-8 pt-24">
        <View className="h-20 w-20 rounded-full bg-brand-50 items-center justify-center mb-6">
           <Ionicons name="cube-outline" size={40} color="#bbf7d0" />
        </View>
        <Text className="text-center text-lg font-black text-brand-900 mb-2">Resource Library Empty</Text>
        <Text className="text-center text-xs text-brand-400 font-medium leading-5 mb-8">
          You need to add resources to your library before you can link them to business compositions.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('IngredientForm', { productId })}
        >
          <View className="rounded-[32px] bg-brand-900 px-8 py-4 shadow-lg shadow-brand-900/20">
            <Text className="font-black text-white text-xs tracking-widest uppercase">Create Resource</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">
          <View className="py-8">
            <Text className="text-[10px] font-black text-brand-400 uppercase tracking-[4px] mb-2 px-1">Linking Resources To</Text>
            <Text className="text-3xl font-black text-brand-900 leading-tight px-1">{product?.name || 'Product'}</Text>
            <View className="flex-row items-center mt-2 px-1">
              <View className="bg-brand-900 px-3 py-1 rounded-full">
                <Text className="text-[10px] font-black text-white uppercase tracking-widest">{product?.category || 'General'}</Text>
              </View>
            </View>
          </View>
          <FormSection title="Composition" icon="layers">
            <View className="flex-row flex-wrap gap-2">
              {availableIngredients.map((ingredient) => (
                <OptionChip
                  key={ingredient.id}
                  label={ingredient.name}
                  selected={selectedItems.some(i => i.ingredientId === ingredient.id)}
                  onPress={() => handleToggleIngredient(ingredient.id)}
                />
              ))}
              
              <Pressable 
                onPress={() => navigation.navigate('IngredientForm', { productId })}
                className="active:opacity-70"
              >
                <View className="flex-row items-center px-4 py-2 rounded-full bg-brand-50 border border-dashed border-brand-200">
                  <Ionicons name="add-circle" size={14} color="#166534" />
                  <Text className="ml-1 text-[10px] font-black text-brand-900 uppercase tracking-widest">New Resource</Text>
                </View>
              </Pressable>
            </View>
            {errors.items && !selectedItems.length && <Text className="mt-2 text-[10px] text-red-500 font-bold px-1">{errors.items.message}</Text>}
          </FormSection>

          {selectedItems.length > 0 && (
            <FormSection title="Configuration" icon="options">
              <View className="bg-brand-50/40 rounded-[24px] border border-brand-100/50 overflow-hidden">
                {selectedItems.map((item, index) => {
                  const ingredient = ingredients.find(i => i.id === item.ingredientId);
                  const piInfo = productIngredients.find(pi => pi.ingredientId === item.ingredientId);
                  const displayName = ingredient?.name ?? piInfo?.ingredientName ?? 'Resource';
                  const displayUnit = ingredient?.unit ?? piInfo?.ingredientUnit ?? '';
                  const price = ingredient?.pricePerUnit ?? piInfo?.ingredientPricePerUnit ?? 0;
                  const purchasedQty = Math.max(Number(ingredient?.quantity ?? piInfo?.ingredientQuantity ?? 1), 0.00000001);
                  const yieldFactor = Math.max(Number(ingredient?.yieldFactor ?? piInfo?.ingredientYieldFactor ?? 1), 0.00000001);
                  const unitCost = (price / purchasedQty) / yieldFactor;

                  if (!displayName) return null;

                  return (
                    <View key={item.ingredientId} className={`flex-row items-center p-4 ${index > 0 ? 'border-t border-brand-100/30' : ''}`}>
                      <View className="flex-1 mr-3">
                        <Text className="text-[11px] font-black text-brand-900 uppercase tracking-widest mb-1" numberOfLines={1}>
                          {displayName}
                        </Text>
                        <Text className="text-[10px] font-black text-brand-400 uppercase tracking-[1px]">
                          {purchasedQty}{displayUnit} × {formatMoney(unitCost, currencyCode, 3)}
                        </Text>
                      </View>
                      
                      <View className="items-end mr-4">
                        <Text className="text-[9px] font-black text-brand-300 uppercase tracking-widest mb-1">TOTAL</Text>
                        <Text className="text-base font-black text-emerald-700">
                           {formatMoney(unitCost * purchasedQty, currencyCode)}
                        </Text>
                      </View>

                      <Pressable onPress={() => handleToggleIngredient(item.ingredientId)} hitSlop={12}>
                         <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </Pressable>
                    </View>
                  );
                })}

                {/* Batch Total Footer */}
                <View className="bg-brand-100/30 px-4 py-3 border-t border-brand-100/50 flex-row justify-between items-center">
                   <Text className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Total Selection Cost</Text>
                   <Text className="text-lg font-black text-brand-900">
                      {formatMoney(selectedItems.reduce((sum, item) => {
                        const ing = ingredients.find(i => i.id === item.ingredientId) as any;
                        const pi = productIngredients.find(p => p.ingredientId === item.ingredientId) as any;
                        
                        const p = ing?.pricePerUnit ?? pi?.ingredientPricePerUnit ?? 0;
                        const q = Math.max(Number(ing?.quantity ?? pi?.ingredientQuantity ?? 1), 0.00000001);
                        const y = Math.max(Number(ing?.yieldFactor ?? pi?.ingredientYieldFactor ?? 1), 0.00000001);
                        
                        const u = (p / q) / y;
                        return sum + (u * q);
                      }, 0), currencyCode)}
                   </Text>
                </View>
              </View>

              <Text className="text-[10px] font-black text-brand-800 uppercase mt-4 mb-3 tracking-widest px-1">Grouping / Cost Type</Text>
              <View className="flex-row flex-wrap gap-2">
                {COST_TYPES.map((costType) => (
                  <OptionChip
                    key={costType}
                    label={costType}
                    selected={selectedCostType === costType}
                    onPress={() => setValue('costType', costType, { shouldValidate: true })}
                  />
                ))}
              </View>
            </FormSection>
          )}

          {/* Resource selection and configuration already handled above */}
          
          {/* Composition Summary */}
          {productIngredients.length > 0 && (
            <FormSection title="Composition (Already Linked)" icon="checkmark-circle-outline">
              <View className="gap-6">
                {['ingredients', 'material', 'packaging', 'overhead', 'labor', 'utilities', 'other'].map((costType) => {
                  const groupItems = productIngredients.filter(pi => pi.costType === costType);
                  if (groupItems.length === 0) return null;

                  const groupTotal = groupItems.reduce((sum, pi) => sum + (getTrueUnitCost(pi) * pi.quantityUsed), 0);

                  const isExpanded = expandedCategories.has(costType);

                  return (
                    <View key={costType} className="mb-4">
                      <Pressable 
                        onPress={() => toggleCategory(costType)}
                        className="active:opacity-70"
                      >
                        <View className="flex-row items-center justify-between mb-3 px-1">
                          <View className="flex-row items-center">
                            <Ionicons 
                              name={isExpanded ? "chevron-down" : "chevron-forward"} 
                              size={12} 
                              color="#166534" 
                              style={{ marginRight: 6 }}
                            />
                            <Text className="text-[11px] font-black text-brand-900 uppercase tracking-[2px]">{costType}</Text>
                          </View>
                          
                          {!isExpanded && (
                            <View className="bg-brand-900 px-2 py-0.5 rounded-full">
                               <Text className="text-[9px] font-black text-white uppercase">{formatMoney(groupTotal, currencyCode)}</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>

                      <View className="bg-brand-50/40 border border-brand-100/50 rounded-[24px] overflow-hidden">
                        {isExpanded && (
                          <View>
                            {groupItems.map((pi, idx) => (
                              <View 
                                key={pi.id} 
                                className={`flex-row items-center p-4 ${idx > 0 ? 'border-t border-brand-100/30' : ''}`}
                              >
                                <View className="flex-1 mr-3">
                                  <Text className="text-[11px] font-black text-brand-900 mb-1" numberOfLines={1}>{pi.ingredientName}</Text>
                                  <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">
                                     {pi.quantityUsed}{pi.ingredientUnit} × {formatMoney(getTrueUnitCost(pi), currencyCode, 3)}
                                  </Text>
                                </View>

                                <View className="items-end mr-4">
                                   <Text className="text-[9px] font-black text-brand-300 uppercase tracking-widest mb-1">COST</Text>
                                   <Text className="text-base font-black text-emerald-700">
                                      {formatMoney(getTrueUnitCost(pi) * pi.quantityUsed, currencyCode)}
                                   </Text>
                                </View>

                                <Pressable 
                                  onPress={() => {
                                    showConfirm(
                                      'Unlink Resource',
                                      `Remove "${pi.ingredientName}"?`,
                                      'Unlink',
                                      () => { void removeIngredientFromProduct(pId, pi.id); },
                                      true
                                    );
                                  }}
                                  hitSlop={8}
                                >
                                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                                </Pressable>
                              </View>
                            ))}
                            
                            {/* Group Summary Footer */}
                            <View className="bg-brand-100/30 px-4 py-3 border-t border-brand-100/50 flex-row justify-between items-center">
                              <Text className="text-[10px] font-black text-brand-900 uppercase tracking-widest">{costType} Total</Text>
                              <Text className="text-lg font-black text-brand-900">{formatMoney(groupTotal, currencyCode)}</Text>
                            </View>
                          </View>
                        )}
                        
                        {!isExpanded && (
                          <Pressable onPress={() => toggleCategory(costType)}>
                             <View className="px-4 py-3 flex-row justify-between items-center">
                                <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Tap to view breakdown</Text>
                                <Text className="text-[10px] font-black text-brand-300 uppercase tracking-widest">{groupItems.length} Items</Text>
                             </View>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </FormSection>
          )}

          <View className="mt-4 gap-4 pb-20">
            <Pressable
              onPress={handleSubmit((v) => onSubmit(v, false))}
              disabled={isSubmitting}
            >
              <View className={`h-16 items-center justify-center rounded-[32px] bg-brand-900 shadow-lg ${isSubmitting ? 'opacity-70' : ''}`}>
                <Text className="font-black text-white text-sm tracking-widest uppercase">
                  {isSubmitting ? 'Processing...' : activeEditLinkId ? 'Update Resource Link' : 'Link to Composition'}
                </Text>
              </View>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <ActionModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        primaryActionText={modalState.primaryText}
        secondaryActionText={modalState.secondaryText}
        isDestructive={modalState.isDestructive}
        onPrimaryAction={modalState.onPrimary}
        onSecondaryAction={modalState.onSecondary}
      />
    </View>
  );
}
