import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { INGREDIENT_UNITS } from '../constants/units';

import {
  IngredientInput,
  IngredientUnit,
} from '../features/ingredients/types';
import { RESOURCE_TAGS, ResourceTag } from '../constants/productCategories';
import { RootStackParamList } from '../navigation/types';
import { useSettingsStore } from '../stores/settingsStore';
import { addIngredient as dbAddIngredient, updateIngredient as dbUpdateIngredient, deleteIngredient as dbDeleteIngredient, getIngredientById, listAllIngredients } from '../db/queries/ingredients';
import { formatMoney } from '../utils/currency';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';
import { ActionModal } from '../components/ui/ActionModal';
import { useState } from 'react';

const ingredientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  classification: z.enum(['measurable', 'fixed']),
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
  tag: z.enum(RESOURCE_TAGS),
});

type IngredientFormValues = z.infer<typeof ingredientSchema>;
type Props = NativeStackScreenProps<RootStackParamList, 'IngredientForm'>;
const QUICK_UNITS: IngredientUnit[] = ['pcs', 'g', 'kg', 'ml', 'liter', 'pack'];

export function IngredientFormScreen({ route, navigation }: Props) {
  const ingredientId = route.params?.ingredientId;
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  // Load data directly from DB — no store subscription = no concurrent re-render crash
  const [existingIngredient, setExistingIngredient] = useState<any>(null);
  const [allNames, setAllNames] = useState<string[]>([]);

  React.useEffect(() => {
    async function load() {
      const all = await listAllIngredients();
      setAllNames(all.map((i) => i.name.trim().toLowerCase()));
      if (ingredientId) {
        const found = await getIngredientById(ingredientId);
        if (found) setExistingIngredient(found);
      }
    }
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      classification: existingIngredient?.classification ?? route.params?.prefillClassification ?? 'measurable',
      unit: (existingIngredient?.unit as IngredientUnit) ?? 'pcs',
      quantity: String(existingIngredient?.quantity ?? '1'),
      pricePerUnit: String(existingIngredient?.pricePerUnit ?? ''),
      yieldFactor: String(existingIngredient?.yieldFactor ?? '1'),
      tag: (existingIngredient?.tag as ResourceTag) ?? (route.params?.prefillTag as ResourceTag) ?? 'Raw Material',
    },
  });

  // Sync form values when existingIngredient is loaded or changes
  React.useEffect(() => {
    if (existingIngredient) {
      reset({
        name: existingIngredient.name,
        classification: existingIngredient.classification as any,
        unit: existingIngredient.unit as IngredientUnit,
        quantity: String(existingIngredient.quantity),
        pricePerUnit: String(existingIngredient.pricePerUnit),
        yieldFactor: String(existingIngredient.yieldFactor),
        tag: (existingIngredient.tag as ResourceTag) ?? 'Raw Material',
      });
    }
  }, [existingIngredient, reset]);

  const selectedUnit = watch('unit');
  const selectedClassification = watch('classification');
  const additionalUnits = React.useMemo(
    () => INGREDIENT_UNITS.filter((u) => !QUICK_UNITS.includes(u as IngredientUnit) && u !== 'UNIT'),
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
    if (!ingredientId && allNames.includes(trimmedName)) {
      setModalState({
        visible: true,
        title: 'Duplicate Resource',
        message: `A resource with that name already exists. Please use a different name.`,
      });
      return;
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
        await dbUpdateIngredient(ingredientId, payload);
      } else {
        await dbAddIngredient(payload);
      }
      // Delay by two frames so Fabric finishes committing the isSubmitting
      // re-render before the unmount+navigation is queued
      requestAnimationFrame(() => requestAnimationFrame(() => navigation.goBack()));
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
          await dbDeleteIngredient(ingredientId);
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
        <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">
          <View style={{ height: 24 }} />

          <FormSection title="Resource Identity" icon="leaf">
            <View className="mb-6">
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
              <View style={{ flexDirection: 'row', gap: 12 }}>
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
              <View style={{
                height: 64,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 24,
                backgroundColor: '#14532d',
                opacity: isSubmitting ? 0.7 : 1,
              }}>
                <Text style={{
                  fontWeight: '900',
                  color: '#ffffff',
                  fontSize: 16,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}>
                  {isSubmitting ? 'Saving...' : ingredientId ? 'Update Resource' : 'Register Resource'}
                </Text>
              </View>
            </Pressable>

            {ingredientId && (
              <Pressable
                onPress={handleDelete}
              >
                <View style={{
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 24,
                  backgroundColor: '#fef2f2',
                  borderWidth: 1,
                  borderColor: '#fee2e2',
                }}>
                  <Text style={{
                    fontWeight: '900',
                    color: '#dc2626',
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}>Delete Permanently</Text>
                </View>
              </Pressable>
            )}
          </View>

        </ScrollView>

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
