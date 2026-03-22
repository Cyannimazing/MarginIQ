import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { INGREDIENT_UNITS } from '../constants/units';
import {
  IngredientInput,
  IngredientUnit,
} from '../features/ingredients/types';
import { RootStackParamList } from '../navigation/types';
import { useIngredientStore } from '../stores/ingredientStore';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';

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
});

type IngredientFormValues = z.infer<typeof ingredientSchema>;
type Props = NativeStackScreenProps<RootStackParamList, 'IngredientForm'>;

export function IngredientFormScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ingredientId = route.params?.ingredientId;
  const productId = route.params?.productId ?? 0;
  const addIngredient = useIngredientStore((state) => state.addIngredient);
  const editIngredient = useIngredientStore((state) => state.editIngredient);
  const getIngredientById = useIngredientStore((state) => state.getIngredientById);

  const existingIngredient = ingredientId ? getIngredientById(ingredientId) : undefined;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: existingIngredient?.name ?? '',
      classification: existingIngredient?.classification ?? 'measurable',
      unit: (existingIngredient?.unit as IngredientUnit) ?? 'pcs',
      quantity: String(existingIngredient?.quantity ?? '1'),
      pricePerUnit: String(existingIngredient?.pricePerUnit ?? ''),
      yieldFactor: String(existingIngredient?.yieldFactor ?? '1'),
    },
  });

  const selectedUnit = watch('unit');
  const selectedClassification = watch('classification');

  const onSubmit = async (values: IngredientFormValues) => {
    const payload: IngredientInput = {
      productId: Number(productId),
      name: values.name.trim(),
      classification: values.classification,
      unit: values.classification === 'fixed' ? 'batch' : values.unit,
      quantity: Number(values.quantity),
      pricePerUnit: Number(values.pricePerUnit),
      yieldFactor: Number(values.yieldFactor),
    };

    try {
      if (ingredientId) {
        await editIngredient(productId, ingredientId, payload);
      } else {
        await addIngredient(payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Could not save resource.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Resource',
      `Delete "${existingIngredient?.name}" permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (ingredientId) {
              await useIngredientStore.getState().removeIngredient(productId, ingredientId);
              navigation.goBack();
            }
          },
        },
      ],
    );
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
              <Text className="text-[10px] font-black text-brand-400 uppercase mb-2 tracking-[2px] px-1">Identity Name</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Organic Milk or Gas Delivery"
                    className="rounded-[24px] border border-brand-100 bg-white px-6 py-5 text-lg text-brand-950 font-black shadow-sm"
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
                    Qty in {selectedClassification === 'fixed' ? 'Batch' : selectedUnit}
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
                        className="rounded-[24px] border border-brand-100 bg-white px-6 py-5 text-xl text-brand-950 font-black shadow-sm"
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
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="decimal-pad"
                        placeholder="1.0"
                        className="rounded-[32px] border border-brand-100 bg-brand-50/50 px-6 py-5 text-lg text-brand-950 font-black"
                      />
                    )}
                  />
               </View>
            </View>
            
            {selectedClassification === 'measurable' && (
              <>
                <Text className="text-[10px] font-black text-brand-800 uppercase mb-3 tracking-widest px-1">Unit of Measure</Text>
                <View className="flex-row flex-wrap gap-2">
                  {INGREDIENT_UNITS.map((u) => (
                    <OptionChip
                      key={u}
                      label={u}
                      selected={selectedUnit === u}
                      onPress={() => setValue('unit', u, { shouldValidate: true })}
                    />
                  ))}
                </View>
              </>
            )}
          </FormSection>

          <View className="mt-8 gap-4 pb-20">
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              <View className={`h-16 items-center justify-center rounded-[24px] bg-brand-900 shadow-xl shadow-brand-900/40 ${isSubmitting ? 'opacity-70' : ''}`}>
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
    </View>
  );
}
