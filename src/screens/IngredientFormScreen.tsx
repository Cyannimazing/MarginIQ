import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { INGREDIENT_UNITS } from '../constants/units';
import { RESOURCE_TAGS } from '../constants/productCategories';
import {
  IngredientInput,
  IngredientUnit,
} from '../features/ingredients/types';
import { RootStackParamList } from '../navigation/types';
import { useIngredientStore } from '../stores/ingredientStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';
import { ActionModal } from '../components/ui/ActionModal';
import { useState } from 'react';

const ingredientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  classification: z.enum(['measurable', 'fixed']),
  tag: z.string().min(1, 'Tag is required'),
  unit: z.enum(INGREDIENT_UNITS),
  quantity: z
    .string()
    .trim()
    .min(1, 'Quantity is required')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, {
      message: 'Quantity must be greater than 0',
    }),
  pricePerUnit: z
    .string()
    .trim()
    .min(1, 'Price is required')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, {
      message: 'Price must be a valid number (0 or greater)',
    }),
  yieldFactor: z
    .string()
    .trim()
    .min(1, 'Yield factor is required')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, {
      message: 'Yield factor must be greater than 0',
    }),
});

type IngredientFormValues = z.infer<typeof ingredientSchema>;
type Props = NativeStackScreenProps<RootStackParamList, 'IngredientForm'>;
const QUICK_UNITS: IngredientUnit[] = ['pcs', 'g', 'kg', 'ml', 'liter', 'pack'];

export function IngredientFormScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ingredientId = route.params?.ingredientId;
  const addIngredient = useIngredientStore((state) => state.addIngredient);
  const editIngredient = useIngredientStore((state) => state.editIngredient);
  const ingredients = useIngredientStore((state) => state.ingredients);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  const existingIngredient = React.useMemo(() => 
    ingredientId ? ingredients.find(i => i.id === ingredientId) : undefined,
  [ingredients, ingredientId]);

  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
    onConfirm?: () => void;
  }>({ visible: false, title: '', message: '' });
  const [showAllUnits, setShowAllUnits] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: existingIngredient?.name ?? '',
      classification: existingIngredient?.classification ?? 'measurable',
      tag: (existingIngredient as any)?.tag ?? 'Other',
      unit: (existingIngredient?.unit as IngredientUnit) ?? 'pcs',
      quantity: String(existingIngredient?.quantity ?? '1'),
      pricePerUnit: String(existingIngredient?.pricePerUnit ?? ''),
      yieldFactor: String(existingIngredient?.yieldFactor ?? '1'),
    },
  });

  // Sync form values when existingIngredient is loaded or changes
  React.useEffect(() => {
    if (existingIngredient) {
      reset({
        name: existingIngredient.name,
        classification: existingIngredient.classification as any,
        tag: (existingIngredient as any)?.tag ?? 'Other',
        unit: existingIngredient.unit as IngredientUnit,
        quantity: String(existingIngredient.quantity),
        pricePerUnit: String(existingIngredient.pricePerUnit),
        yieldFactor: String(existingIngredient.yieldFactor),
      });
    }
  }, [existingIngredient, reset]);

  const selectedUnit = watch('unit');
  const selectedClassification = watch('classification');
  const selectedTag = watch('tag');
  const additionalUnits = React.useMemo(
    () => INGREDIENT_UNITS.filter((u) => !QUICK_UNITS.includes(u as IngredientUnit)),
    []
  );

  React.useEffect(() => {
    if (selectedClassification !== 'measurable') {
      setShowAllUnits(false);
    }
  }, [selectedClassification]);

  const onSubmit = async (values: IngredientFormValues) => {
    const trimmedName = values.name.trim().toLowerCase();

    // Duplicate name guard
    if (!ingredientId) {
      const duplicate = ingredients.find(i => i.name.trim().toLowerCase() === trimmedName);
      if (duplicate) {
        setModalState({
          visible: true,
          title: 'Duplicate Resource',
          message: `A resource named "${duplicate.name}" already exists. Please use a different name.`,
        });
        return;
      }
    }

    const payload: IngredientInput = {
      productId: 0, // always global
      name: values.name.trim(),
      classification: values.classification,
      tag: values.tag,
      unit: values.classification === 'fixed' ? 'UNIT' : values.unit,
      quantity: Number(values.quantity),
      pricePerUnit: Number(values.pricePerUnit),
      yieldFactor: Number(values.yieldFactor),
    };

    try {
      if (ingredientId) {
        await editIngredient(undefined, ingredientId, payload);
      } else {
        await addIngredient(payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Could not save resource.');
    }
  };

  const handleDelete = () => {
    setModalState({
      visible: true,
      title: 'Delete Resource',
      message: `Delete "${existingIngredient?.name}" permanently? This will remove it from all product compositions.`,
      onConfirm: async () => {
        if (ingredientId) {
          await useIngredientStore.getState().removeIngredient(undefined, ingredientId);
          setModalState({
            visible: true,
            title: 'Deleted',
            message: 'Resource removed successfully.',
            isSuccess: true,
          });
        }
      },
    });
  };

  return (
    <View className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">
          <View style={{ height: 24 }} />

          <FormSection title="Resource Identity" icon="leaf">
            <View className="mb-6">
              <Text className="text-[10px] font-black text-brand-400 uppercase mb-3 tracking-[2px] px-1">Resource Tag</Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {RESOURCE_TAGS.map((t) => (
                  <OptionChip
                    key={t}
                    label={t}
                    selected={selectedTag === t}
                    onPress={() => setValue('tag', t, { shouldValidate: true })}
                  />
                ))}
              </View>
              <Text className="text-[10px] font-black text-brand-400 uppercase mb-2 tracking-[2px] px-1">Identity Name</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Milk"
                    className="rounded-[24px] border border-brand-100 bg-white px-6 py-5 text-lg text-brand-900 font-black shadow-sm"
                    placeholderTextColor="#cbd5e1"
                  />
                )}
              />
              {errors.name && <Text className="px-2 mt-1 text-[10px] text-red-500 font-bold uppercase">{errors.name.message}</Text>}
            </View>

            <View>
              <Text className="text-[10px] font-black text-brand-400 uppercase mb-3 tracking-[2px] px-1">Nature of Resource</Text>
              <View className="flex-row gap-3">
                <OptionChip
                  label="Measurable"
                  selected={selectedClassification === 'measurable'}
                  onPress={() => setValue('classification', 'measurable', { shouldValidate: true })}
                />
                <OptionChip
                  label="Fixed Cost"
                  selected={selectedClassification === 'fixed'}
                  onPress={() => setValue('classification', 'fixed', { shouldValidate: true })}
                />
              </View>
            </View>
          </FormSection>

          <FormSection title="Pricing & Reference" icon="pricetag">
            <View className="flex-row gap-4 mb-8">
              <View className="flex-1">
                <Text className="text-[10px] font-black text-brand-400 uppercase mb-2 tracking-[2px] px-1">
                  Qty in {selectedClassification === 'fixed' ? 'UNIT' : selectedUnit}
                </Text>
                <Controller
                  control={control}
                  name="quantity"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                      placeholder="1.0"
                      className="rounded-[24px] border border-brand-100 bg-white px-6 py-5 text-xl text-brand-900 font-black shadow-sm"
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-black text-brand-400 uppercase mb-2 tracking-[2px] px-1">Price</Text>
                <Controller
                  control={control}
                  name="pricePerUnit"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      className="rounded-[32px] border border-brand-100 bg-brand-50/50 px-6 py-5 text-lg text-brand-900 font-black"
                    />
                  )}
                />
              </View>
            </View>

            {/* Live Calculation Preview */}
            <View className="bg-brand-50/50 rounded-[28px] p-6 border border-brand-100 mb-2">
              <View className="flex-row items-center justify-between mb-4">
                 <Text className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Base Unit Cost</Text>
                 <View className="bg-brand-900/5 px-2 py-1 rounded-md">
                   <Text className="text-[10px] font-black text-brand-900 uppercase">CALCULATED</Text>
                 </View>
              </View>
              <View className="flex-row items-end justify-between">
                <View>
                  <Text className="text-3xl font-black text-brand-900">
                    {formatMoney(
                      (Number(watch('pricePerUnit')) || 0) / 
                      (Math.max(Number(watch('quantity')) || 1, 0.00000001)), 
                      currencyCode, 
                      3
                    )}
                  </Text>
                  <Text className="text-[10px] font-bold text-brand-400 tracking-widest uppercase mt-1">
                    / {selectedClassification === 'fixed' ? 'UNIT' : selectedUnit}
                  </Text>
                </View>
                <View className="items-end">
                   <Text className="text-[10px] font-bold text-brand-400 mb-1">REFERENCE</Text>
                   <Text className="text-[11px] font-black text-brand-800 uppercase">
                      {watch('quantity') || '1'} {selectedClassification === 'fixed' ? 'UNIT' : selectedUnit} @ {formatMoney(Number(watch('pricePerUnit')) || 0, currencyCode)}
                   </Text>
                </View>
              </View>
            </View>

            {selectedClassification === 'measurable' && (
              <>
                <Text className="text-[10px] font-black text-brand-800 uppercase mb-3 tracking-widest px-1">Unit of Measure</Text>
                <View className="mb-2 flex-row items-center justify-between px-1">
                  <Text className="text-[9px] font-black text-brand-400 uppercase tracking-[2px]">Quick Units</Text>
                  <Pressable onPress={() => setShowAllUnits((prev) => !prev)} hitSlop={8}>
                    <Text className="text-[9px] font-black text-brand-700 uppercase tracking-[2px]">
                      {showAllUnits ? 'Less Units' : 'More Units'}
                    </Text>
                  </Pressable>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {QUICK_UNITS.map((u) => (
                    <OptionChip
                      key={u}
                      label={u}
                      selected={selectedUnit === u}
                      onPress={() => setValue('unit', u, { shouldValidate: true })}
                    />
                  ))}
                </View>

                {!QUICK_UNITS.includes(selectedUnit as IngredientUnit) && (
                  <View className="mt-2">
                    <Text className="text-[9px] font-black text-brand-400 uppercase mb-2 tracking-[2px] px-1">Selected Unit</Text>
                    <View className="flex-row flex-wrap gap-2">
                      <OptionChip
                        key={selectedUnit}
                        label={selectedUnit}
                        selected
                        onPress={() => setValue('unit', selectedUnit, { shouldValidate: true })}
                      />
                    </View>
                  </View>
                )}

                {showAllUnits && (
                  <View className="mt-3">
                    <Text className="text-[9px] font-black text-brand-400 uppercase mb-2 tracking-[2px] px-1">All Units</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {additionalUnits.map((u) => (
                        <OptionChip
                          key={u}
                          label={u}
                          selected={selectedUnit === u}
                          onPress={() => setValue('unit', u, { shouldValidate: true })}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </FormSection>

          <View className="mt-8 gap-4 pb-20">
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              <View className={`h-16 items-center justify-center rounded-[24px] bg-brand-900 ${isSubmitting ? 'opacity-70' : ''}`}>
                <Text className="font-black text-white text-base tracking-[2px] uppercase">
                  {isSubmitting ? 'Saving...' : ingredientId ? 'Update Resource' : 'Register Resource'}
                </Text>
              </View>
            </Pressable>

            {ingredientId && (
              <Pressable
                onPress={handleDelete}
              >
                <View className="h-14 items-center justify-center rounded-[24px] bg-red-50 border border-red-100">
                  <Text className="font-black text-red-600 text-[10px] tracking-[2px] uppercase">Delete Permanently</Text>
                </View>
              </Pressable>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <ActionModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        primaryActionText={modalState.isSuccess ? 'OK' : 'Delete'}
        secondaryActionText={modalState.isSuccess ? undefined : 'Cancel'}
        isDestructive={!modalState.isSuccess}
        onPrimaryAction={() => {
          if (modalState.isSuccess) {
            setModalState((s) => ({ ...s, visible: false }));
            navigation.goBack();
          } else {
            setModalState((s) => ({ ...s, visible: false }));
            modalState.onConfirm?.();
          }
        }}
        onSecondaryAction={() => setModalState((s) => ({ ...s, visible: false }))}
      />
    </View>
  );
}
