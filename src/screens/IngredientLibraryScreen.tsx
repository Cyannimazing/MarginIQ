import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useIngredientStore } from '../stores/ingredientStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';

type Props = NativeStackScreenProps<RootStackParamList, 'IngredientLibrary'>;

export function ResourceLibraryScreen({ navigation }: Props) {
  const ingredients = useIngredientStore((state) => state.ingredients);
  const isLoading = useIngredientStore((state) => state.isLoading);
  const error = useIngredientStore((state) => state.error);
  const loadIngredients = useIngredientStore((state) => state.loadIngredients);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void loadIngredients();
  }, [loadIngredients]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase());
      return matchesSearch;
    });
  }, [ingredients, searchQuery]);

  return (
    <View className="flex-1 bg-white px-6 pt-6">
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search resource"
        className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900"
        placeholderTextColor="#94a3b8"
      />



      {!!error && <Text className="mt-3 text-sm text-red-600">{error}</Text>}

      <FlatList
        data={filteredIngredients}
        keyExtractor={(item) => String(item.id)}
        refreshing={isLoading}
        onRefresh={() => void loadIngredients()}
        className="mt-3"
        contentContainerClassName="gap-2.5 pb-24"
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-sm text-slate-500">
              {isLoading ? 'Loading resources...' : 'No resources found.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('IngredientForm', { ingredientId: item.id, productId: 0 })}
          >
            <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-slate-900">{item.name}</Text>
                <Text className="mt-0.5 text-sm text-slate-500">
                  {item.unit}
                </Text>
                <View className="mt-3 flex-row items-center justify-between pr-4">
                   <View>
                      <Text className="text-xs font-semibold text-slate-700">
                        {formatMoney(item.pricePerUnit, currencyCode)}
                      </Text>
                      <Text className="text-[10px] text-slate-500">Price per {item.unit}</Text>
                   </View>
                   <View className="items-end">
                      <Text className="text-xs font-semibold text-slate-700">{item.yieldFactor}</Text>
                      <Text className="text-[10px] text-slate-500">Yield Factor</Text>
                   </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => navigation.navigate('IngredientForm', { productId: 0 })}
      >
        <View className="bg-brand-900 absolute bottom-6 right-6 flex-row items-center gap-2 rounded-full px-6 py-4 shadow-xl active:opacity-90">
          <Ionicons name="add" size={24} color="white" />
          <Text className="font-bold text-white uppercase tracking-wider text-sm">Add Resource</Text>
        </View>
      </Pressable>
    </View>
  );
}


