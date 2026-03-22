import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { COST_TYPES } from '../constants/productCategories';
import { RootStackParamList } from '../navigation/types';
import { useIngredientStore } from '../stores/ingredientStore';
import { useProductStore } from '../stores/productStore';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';

const addIngredientSchema = z.object({
  items: z.array(
    z.object({
      ingredientId: z.number().positive(),
    })
  ).min(1, 'Select at least one resource'),
  costType: z.enum(COST_TYPES),
});

type AddIngredientValues = z.infer<typeof addIngredientSchema>;
type Props = NativeStackScreenProps<RootStackParamList, 'ProductAddIngredient'>;

export function ProductAddIngredientScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { productId, editLinkId, initialIngredientId, initialQuantity, initialCostType, initialItems } = route.params;

  const ingredients = useIngredientStore((state) => state.ingredients);
  const loadIngredients = useIngredientStore((state) => state.loadIngredients);
  const addIngredientToProduct = useProductStore((state) => state.addIngredientToProduct);
  const editProductIngredient = useProductStore((state) => state.editProductIngredient);
  const removeIngredientFromProduct = useProductStore((state) => state.removeIngredientFromProduct);
  const productIngredients = useProductStore((state) => state.productIngredients);
  const loadProductIngredients = useProductStore((state) => state.loadProductIngredients);

  // IDs of ingredients already linked to this product in OTHER compositions
  const alreadyUsedIds = useMemo(() => {
    if (editLinkId && initialItems) {
      // In edit mode: exclude ingredients from OTHER categories (allow ones already in THIS category)
      const editGroupIds = new Set(initialItems.map(i => i.ingredientId));
      return new Set(
        productIngredients
          .filter(pi => !editGroupIds.has(pi.ingredientId))
          .map(pi => pi.ingredientId)
      );
    }
    // Fresh compose: exclude ALL already-linked ingredients
    return new Set(productIngredients.map(pi => pi.ingredientId));
  }, [productIngredients, editLinkId, initialItems]);

  // Available ingredients for this session (not already used elsewhere)
  const availableIngredients = useMemo(
    () => ingredients.filter(i => !alreadyUsedIds.has(i.id)),
    [ingredients, alreadyUsedIds]
  );

  const buildInitialItems = () => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map(i => ({ ingredientId: i.ingredientId, quantityUsed: i.quantityUsed }));
    }
    if (editLinkId && initialIngredientId) {
      return [{ ingredientId: initialIngredientId }];
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
      costType: (initialCostType as any) ?? 'material',
    },
  });

  // Force reset whenever params change
  useEffect(() => {
    reset({
      items: buildInitialItems(),
      costType: (initialCostType as any) ?? 'material',
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
        Alert.alert('Selection Required', 'You must have at least one resource selected.');
        return;
      }
      setValue('items', selectedItems.filter((_, idx) => idx !== index), { shouldValidate: true });
    } else {
      setValue('items', [...selectedItems, { 
        ingredientId: id
      }], { shouldValidate: true });
    }
  };

  const onSubmit = async (values: AddIngredientValues, stay: boolean = false) => {
    try {
      if (editLinkId && initialItems && initialItems.length > 0) {
        // Bulk Edit Mode
        const submittedIds = new Set(values.items.map(i => i.ingredientId));

        // 1. Delete items that were in the original group but deselected
        for (const original of initialItems) {
          if (!submittedIds.has(original.ingredientId)) {
            await removeIngredientFromProduct(productId, original.linkId);
          }
        }

        // 2. Update existing + add new
        for (const item of values.items) {
          const originalLink = initialItems.find(i => i.ingredientId === item.ingredientId);
          if (originalLink) {
            await editProductIngredient(productId, originalLink.linkId, {
              ingredientId: item.ingredientId,
              quantityUsed: 1, // Treat as a "pick-and-use" link
              costType: values.costType,
            });
          } else {
            await addIngredientToProduct({
              productId,
              ingredientId: item.ingredientId,
              quantityUsed: 1, 
              costType: values.costType,
            });
          }
        }
      } else if (editLinkId) {
        // Legacy single-edit mode (e.g. direct edit from elsewhere)
        const primaryIdx = values.items.findIndex(i => i.ingredientId === initialIngredientId);
        const updateIdx = primaryIdx > -1 ? primaryIdx : 0;
        const updateItem = values.items[updateIdx];
        await editProductIngredient(productId, editLinkId, {
          ingredientId: updateItem.ingredientId,
          quantityUsed: 1,
          costType: values.costType,
        });
        for (let i = 0; i < values.items.length; i++) {
          if (i === updateIdx) continue;
          const extra = values.items[i];
          await addIngredientToProduct({
            productId,
            ingredientId: extra.ingredientId,
            quantityUsed: 1,
            costType: values.costType,
          });
        }
      } else {
        // Pure Batch Add mode
        for (const item of values.items) {
          await addIngredientToProduct({
            productId,
            ingredientId: item.ingredientId,
            quantityUsed: 1,
            costType: values.costType,
          });
        }
      }
      
      if (stay) {
        Alert.alert('Success', `${values.items.length} resource(s) linked.`, [{ text: 'Add More' }]);
        reset({ items: [], costType: 'material' });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Unable to process resource links.');
    }
  };

  if (!ingredients.length) {
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
          onPress={() => navigation.navigate('IngredientForm', { productId: 0 })}
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
          <View style={{ height: 24 }} />
          
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
                onPress={() => navigation.navigate('IngredientForm', { productId: 0 })}
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
              <View className="gap-4">
                {selectedItems.map((item, index) => {
                  const ingredient = ingredients.find(i => i.id === item.ingredientId);
                  if (!ingredient) return null;
                  
                  return (
                    <View key={item.ingredientId} className="mb-2">
                      <View className="flex-row items-center justify-between px-1">
                        <Text className="text-[10px] font-black text-brand-800 uppercase tracking-widest">
                          {ingredient.name} — {ingredient.quantity} {ingredient.unit} ({ingredient.classification === 'measurable' ? 'Measurable' : 'Fixed'})
                        </Text>
                        <Pressable onPress={() => handleToggleIngredient(item.ingredientId)}>
                          <Ionicons name="close-circle" size={16} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
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


          <View className="mt-4 gap-4 pb-20">
            <Pressable
              onPress={handleSubmit((v) => onSubmit(v, false))}
              disabled={isSubmitting}
            >
              <View className={`h-16 items-center justify-center rounded-[32px] bg-brand-900 shadow-lg ${isSubmitting ? 'opacity-70' : ''}`}>
                <Text className="font-black text-white text-sm tracking-widest uppercase">
                  {isSubmitting ? 'Processing...' : editLinkId ? 'Update Resource Link' : 'Link to Composition'}
                </Text>
              </View>
            </Pressable>

            {!editLinkId && (
              <Pressable
                onPress={handleSubmit((v) => onSubmit(v, true))}
                disabled={isSubmitting}
              >
                <View className="h-16 items-center justify-center rounded-[32px] bg-white border-2 border-brand-900 shadow-sm">
                  <Text className="font-black text-brand-900 text-sm tracking-widest uppercase">Link & Stay</Text>
                </View>
              </Pressable>
            )}
            
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
