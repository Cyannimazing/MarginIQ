import React, { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useIngredientStore } from '../stores/ingredientStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';
import { safeNavigate } from '../navigation/navigationService';
import { SpotlightOverlay } from '../components/ui/SpotlightOverlay';

type Props = NativeStackScreenProps<RootStackParamList, 'ResourcesLibrary'>;

export function ResourcesLibraryScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const ingredients = useIngredientStore((state) => state.ingredients);
  const isLoading = useIngredientStore((state) => state.isLoading);
  const loadIngredients = useIngredientStore((state) => state.loadIngredients);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);
  const tutorialStep = useSettingsStore((state) => state.settings.tutorialStep);
  const tutorialGuideTopic = useSettingsStore((state) => state.settings.tutorialGuideTopic);
  const saveSettings = useSettingsStore((state) => state.saveSettings);

  const isResourcesGuideActive = tutorialStep === 1 && tutorialGuideTopic === 't-resources';
  const isResourcesGuideDone = tutorialStep === 1 && tutorialGuideTopic === 't-resources:done';

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Initial load
  React.useEffect(() => {
    void loadIngredients();
  }, [loadIngredients]);

  // Reload after returning from IngredientFormScreen — delay 500ms so Fabric
  // finishes all unmount operations before we add new list rows
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsub = navigation.addListener('transitionEnd', () => {
      timer = setTimeout(() => void loadIngredients(), 500);
    });
    return () => { unsub(); clearTimeout(timer); };
  }, [navigation, loadIngredients]);

  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return ingredients;
    const q = searchQuery.toLowerCase();
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, searchQuery]);

  const displayedIngredients = useMemo(
    () => filteredIngredients.slice(0, page * ITEMS_PER_PAGE),
    [filteredIngredients, page],
  );

  const handleLoadMore = () => {
    if (displayedIngredients.length < filteredIngredients.length) {
      setPage((prev) => prev + 1);
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: 'Resources Library', headerRight: undefined });
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* Search */}
        <View style={{ marginBottom: 10, marginTop: 12 }}>
          <View className="flex-row items-center bg-white rounded-[24px] px-4 py-3 border border-brand-100 shadow-sm">
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              className="flex-1 ml-3 text-base text-brand-900 font-bold"
              placeholder="Search resources..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={(txt) => { setSearchQuery(txt); setPage(1); }}
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
          style={{ flex: 1 }}
          data={displayedIngredients}
          keyExtractor={(item) => String(item.id)}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ gap: 12, paddingBottom: Math.max(insets.bottom, 24) + 88 }}
          keyboardShouldPersistTaps="always"
          refreshing={isLoading}
          onRefresh={() => { setPage(1); void loadIngredients(); }}
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
                if (isResourcesGuideActive) {
                  void saveSettings({ tutorialStep: 0, tutorialGuideTopic: '' });
                }
                safeNavigate('IngredientForm', {
                  ingredientId: item.id,
                  productId: item.productId ?? 0,
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
                  <Text className="text-lg font-black text-brand-900" numberOfLines={1}>
                    {item.name}
                  </Text>
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

      <Pressable
        onPress={() => {
          safeNavigate('IngredientForm', {
            productId: route.params?.productId,
          });
        }}
        style={{
          position: 'absolute',
          right: 24,
          bottom: Math.max(insets.bottom, 24) + 16,
          height: 64,
          width: 64,
          borderRadius: 32,
          backgroundColor: '#14532d',
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
        accessibilityRole="button"
        accessibilityLabel="Add resource"
      >
        <Ionicons name="add" size={32} color="white" />
      </Pressable>

      {tutorialStep === 1 && (isResourcesGuideActive || isResourcesGuideDone) && (
        <SpotlightOverlay
          message={
            isResourcesGuideDone
              ? 'Saved. Library is ready.'
              : 'Tap the plus button to add a new resource to your library.'
          }
          autoExit={isResourcesGuideDone}
          textHideDelayMs={2000}
          avatarFadeDelayMs={1000}
          avatarFadeDurationMs={950}
          onAutoExitComplete={
            isResourcesGuideDone
              ? () => void saveSettings({ tutorialStep: 0, tutorialGuideTopic: '' })
              : undefined
          }
          onSkip={() => void saveSettings({ tutorialStep: 0, tutorialGuideTopic: '' })}
        />
      )}

    </View>
  );
}
