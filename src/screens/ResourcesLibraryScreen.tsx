import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useIngredientStore } from '../stores/ingredientStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';
import { useUIStore } from '../stores/uiStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ResourcesLibrary'>;

export function ResourcesLibraryScreen({ navigation }: Props) {
  const ingredients = useIngredientStore((state) => state.ingredients);
  const isLoading = useIngredientStore((state) => state.isLoading);
  const loadIngredients = useIngredientStore((state) => state.loadIngredients);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);
  const setSidebarOpen = (open: boolean) => useUIStore.getState().setSidebarOpen(open);

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    void loadIngredients(0); // 0 or undefined loads all ingredients globally
  }, [loadIngredients]);

  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return ingredients;
    const lowerQuery = searchQuery.toLowerCase();
    return ingredients.filter(i => i.name.toLowerCase().includes(lowerQuery));
  }, [ingredients, searchQuery]);

  const displayedIngredients = useMemo(() => {
    return filteredIngredients.slice(0, page * ITEMS_PER_PAGE);
  }, [filteredIngredients, page]);

  const handleLoadMore = () => {
    if (displayedIngredients.length < filteredIngredients.length) {
      setPage(prev => prev + 1);
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Resources Library',
    });
  }, [navigation]);

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 px-5">
        <View style={{ height: 20 }} />
        {/* Header / Search */}
        <View className="mb-6 mt-2">
          <View className="flex-row items-center bg-white rounded-[24px] px-4 py-3 border border-brand-100 shadow-sm">
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              className="flex-1 ml-3 text-base text-brand-950 font-bold"
              placeholder="Search resources..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={(txt) => {
                setSearchQuery(txt);
                setPage(1); // Reset pagination on search
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => { setSearchQuery(''); setPage(1); }}>
                <Ionicons name="close-circle" size={20} color="#cbd5e1" />
              </Pressable>
            )}
          </View>
        </View>

        {/* List */}
        <FlatList
          data={displayedIngredients}
          keyExtractor={(item) => String(item.id)}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerClassName="gap-3 pb-24"
          keyboardShouldPersistTaps="always"
          refreshing={isLoading}
          onRefresh={() => {
            setPage(1);
            void loadIngredients(0);
          }}
          ListEmptyComponent={
            <View className="items-center py-10">
              <View className="w-16 h-16 rounded-full bg-brand-100/50 items-center justify-center mb-4">
                <Ionicons name="leaf-outline" size={32} color="#14532d" />
              </View>
              <Text className="text-sm font-bold text-brand-500">
                {isLoading ? 'Loading resources...' : 'No resources found.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => {
                navigation.navigate('IngredientForm', { 
                  ingredientId: item.id, 
                  productId: item.productId ?? 0 
                });
              }}
              className="mb-3"
              style={{ backgroundColor: 'white', borderRadius: 24 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View className="flex-row items-center justify-between rounded-[24px] border border-brand-100 bg-white p-5 shadow-sm">
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Text className="text-[9px] font-black text-brand-400 uppercase tracking-[2px]">
                      {item.classification === 'fixed' ? 'FIXED COST' : 'MEASURABLE'}
                    </Text>
                  </View>
                  <Text className="text-lg font-black text-brand-900" numberOfLines={1}>{item.name}</Text>
                  
                  <View className="mt-3 flex-row items-center gap-2">
                    <View className="bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-100">
                      <Text className="text-xs font-black text-brand-700">
                        {formatMoney(item.pricePerUnit, currencyCode)}
                      </Text>
                    </View>
                    <Text className="text-[11px] font-bold text-brand-400 uppercase tracking-widest">
                      per {item.quantity} {item.classification === 'fixed' ? 'unit' : item.unit}
                    </Text>
                  </View>
                </View>
                <View className="w-10 h-10 rounded-full bg-brand-100/50 items-center justify-center">
                  <Ionicons name="create" size={18} color="#14532d" />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}
