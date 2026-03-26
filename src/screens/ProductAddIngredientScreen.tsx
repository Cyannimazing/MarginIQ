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
import { ProductIngredientInput } from '../features/products/types';
import { normalizeUnitsPerSale } from '../utils/productEconomics';
import { OptionChip } from '../components/ui/OptionChip';
import { FormSection } from '../components/ui/FormSection';
import { ActionModal } from '../components/ui/ActionModal';
import { safeGoBack, safeNavigate } from '../navigation/navigationService';

const addIngredientSchema = z.object({
  items: z.array(
    z.object({
      ingredientId: z.number().positive(),
      quantityUsed: z.string().trim().min(1, 'Required').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
      usageMode: z.enum(['per_piece', 'pieces_per_unit', 'per_batch']),
      usageRatio: z.string().trim().min(1, 'Required').refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Must be 0 or more'),
      costType: z.enum(COST_TYPES),
    })
  ).min(1, 'Select at least one resource'),
  unitsPerSale: z.string().trim().min(1, 'Required').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  saleUnitLabel: z.string().trim(),
});

type AddIngredientValues = z.infer<typeof addIngredientSchema>;
type Props = NativeStackScreenProps<RootStackParamList, 'ProductAddIngredient'>;
const COST_TYPE_LABELS: Record<string, string> = {
  ingredients: 'Raw Materials',
  material: 'Material',
  packaging: 'Packaging',
  labor: 'Labor',
  utilities: 'Utilities (batch-variable)',
  overhead: 'Overhead (batch-variable)',
  other: 'Other',
};

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
  const editProduct = useProductStore((state) => state.editProduct);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);


  const getTrueUnitCost = (pi: any) => {
    const qty = Math.max(Number(pi.ingredientQuantity) || 1, 0.00000001);
    const yieldFactor = Math.max(Number(pi.ingredientYieldFactor) || 1, 0.00000001);
    const price = Number(pi.ingredientPricePerUnit) || 0;
    const cost = (price / qty) / yieldFactor;
    return isFinite(cost) ? cost : 0;
  };

  // Local state for batch size to avoid expensive store refreshes on every keystroke
  const [localBatchSize, setLocalBatchSize] = useState(Number(product?.batchSize || 1));
  const batchSizeNumber = useMemo(() => Math.max(localBatchSize, 1), [localBatchSize]);

  // Cost per 1 piece based on current linked resources (does not include monthly overhead).
  const perPieceTotalCost = useMemo(() => {
    if (!product) return 0;
    const baseCost = isFinite(Number(product.baseCost)) ? Number(product.baseCost) : 0;

    const ingredientsTotal = productIngredients
      .filter((pi) => pi.costType === 'ingredients')
      .reduce((sum, pi) => sum + getTrueUnitCost(pi) * (Number(pi.quantityUsed) || 0), 0);

    const otherTotal = productIngredients
      .filter((pi) => pi.costType !== 'ingredients')
      .reduce((sum, pi) => sum + getTrueUnitCost(pi) * (Number(pi.quantityUsed) || 0), 0);

    const bTotalCost = ingredientsTotal + otherTotal + baseCost;
    return isFinite(bTotalCost) ? bTotalCost / batchSizeNumber : 0;
  }, [product, productIngredients, batchSizeNumber]);



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

  const [searchQuery, setSearchQuery] = useState('');

  const [visibleResourceCount, setVisibleResourceCount] = useState(5);
  const [libraryTab, setLibraryTab] = useState<'raw' | 'packaging'>('raw');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

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

  // Filtered by search + classification + TAG
  const rawMaterials = useMemo(() => {
    return availableIngredients.filter(i => {
      const matchesSearch = !searchQuery.trim() || i.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const isRaw = i.tag !== 'Packaging';
      return matchesSearch && isRaw;
    });
  }, [availableIngredients, searchQuery]);

  const packagingMaterials = useMemo(() => {
    return availableIngredients.filter(i => {
      const matchesSearch = !searchQuery.trim() || i.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const isPkg = i.tag === 'Packaging';
      return matchesSearch && isPkg;
    });
  }, [availableIngredients, searchQuery]);



  useEffect(() => {
    setVisibleResourceCount(5);
  }, [searchQuery]);

  const resourcePageSize = 5;
  const visibleRawMaterials = useMemo(
    () => rawMaterials.slice(0, visibleResourceCount),
    [rawMaterials, visibleResourceCount]
  );
  const hiddenRawCount = Math.max(rawMaterials.length - visibleRawMaterials.length, 0);
  const nextShowCount = Math.min(resourcePageSize, hiddenRawCount);

  const buildInitialItems = () => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((i: any) => ({ 
        ingredientId: i.ingredientId, 
        quantityUsed: String(i.quantityUsed),
        usageMode: i.usageMode || 'per_batch',
        usageRatio: String(i.usageRatio || i.quantityUsed || '0'),
        costType: i.costType || 'ingredients'
      }));
    }
    if (editLinkId && initialIngredientId) {
      return [{ 
        ingredientId: initialIngredientId, 
        quantityUsed: String(initialQuantity || '0'),
        usageMode: 'per_batch',
        usageRatio: String(initialQuantity || '0'),
        costType: initialCostType || 'ingredients'
      }];
    }
    return [];
  };

  const {
    control,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddIngredientValues>({
    resolver: zodResolver(addIngredientSchema),
    defaultValues: {
      items: buildInitialItems(),
      unitsPerSale: String(product?.unitsPerSale || 1),
      saleUnitLabel: product?.saleUnitLabel || '',
    },
  });

  // Force reset whenever params/product change
  useEffect(() => {
    reset({
      items: buildInitialItems(),
      unitsPerSale: String(product?.unitsPerSale || 1),
      saleUnitLabel: product?.saleUnitLabel || '',
    });
  }, [productId, editLinkId, initialIngredientId, initialQuantity, initialCostType, initialItems, product, reset]);

  // Initial load
  React.useEffect(() => {
    void loadIngredients();
    void loadProductIngredients(productId);
  }, [loadIngredients, loadProductIngredients, productId]);

  // Reload after returning from IngredientFormScreen
  React.useEffect(() => {
    const unsub = navigation.addListener('transitionEnd', () => {
      void loadIngredients();
      void loadProductIngredients(productId);
    });
    return unsub;
  }, [navigation, loadIngredients, loadProductIngredients, productId]);

  const selectedItems = watch('items') || [];
  const tabSelectedCount = libraryTab === 'packaging'
    ? selectedItems.filter(i => i.costType === 'packaging').length
    : selectedItems.filter(i => i.costType !== 'packaging').length;
  const packagingSelected = useMemo(() => selectedItems.filter(i => i.costType === 'packaging'), [selectedItems]);
  const hasMultiplePackaging = packagingSelected.length >= 2;

  const [unifiedPkgValue, setUnifiedPkgValue] = useState(String(product?.unitsPerSale || 1));
  

  // Batch Helper States
  const [helperShow, setHelperShow] = useState(false);
  const [helperUnits, setHelperUnits] = useState(String(product?.unitsPerSale || 1));
  const [helperBatches, setHelperBatches] = useState(String(Math.round(batchSizeNumber / (Number(product?.unitsPerSale) || 1))));

  const linkedPackagingCount = useMemo(() => 
    productIngredients.filter(pi => pi.costType === 'packaging').length, 
  [productIngredients]);

  // Auto-sync unifiedPkgValue and helper states if all selected packaging have the same deduced pieces
  useEffect(() => {
    if (packagingSelected.length > 0 && batchSizeNumber > 0) {
      const pieces = packagingSelected
        .filter(item => item.usageMode === 'pieces_per_unit')
        .map(item => {
          const qty = Number(item.quantityUsed) || 0;
          return qty > 0 ? Math.round((batchSizeNumber / qty) * 1000) / 1000 : 0;
        });
      
      if (pieces.length > 0) {
        const allSame = pieces.every(p => p > 0 && p === pieces[0]);
        if (allSame) {
          setUnifiedPkgValue(String(pieces[0]));
          setHelperUnits(String(pieces[0]));
          setHelperBatches(String(Math.round(batchSizeNumber / pieces[0])));
        }
      }
    } else if (batchSizeNumber > 0) {
       // Also sync if no packaging selected
       const currentUps = Number(watch('unitsPerSale')) || 1;
       
       // CRITICAL: If zero packaging is selected AND zero packaging is linked, reset UPS to 1
       if (packagingSelected.length === 0 && linkedPackagingCount === 0 && currentUps !== 1) {
         setValue('unitsPerSale', '1');
         setUnifiedPkgValue('1');
       }
       
       setHelperUnits(String(watch('unitsPerSale') || 1));
       setHelperBatches(String(Math.round(batchSizeNumber / (Number(watch('unitsPerSale')) || 1))));
    }
  }, [packagingSelected.length, linkedPackagingCount, batchSizeNumber, product?.unitsPerSale, watch('unitsPerSale')]);

  const currentPackagingCost = useMemo(() => {
    return selectedItems
      .filter(item => item.costType === 'packaging')
      .reduce((sum, item) => {
        const ing = ingredients.find(i => i.id === item.ingredientId);
        if (!ing) return sum;
        // Adapted getTrueUnitCost for library ingredient
        const refQty = Math.max(Number(ing.quantity) || 1, 0.00000001);
        const yf = Math.max(Number(ing.yieldFactor) || 1, 0.00000001);
        const price = Number(ing.pricePerUnit) || 0;
        const uCost = (price / refQty) / yf;
        
        const qtyUsed = Number(item.quantityUsed) || 0;
        return sum + (qtyUsed * uCost);
      }, 0);
  }, [selectedItems, ingredients]);

  const handleToggleIngredient = (id: number, costType: "ingredients" | "packaging" = 'ingredients') => {
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
      let initialQty = String(ingredient?.quantity ?? (ingredient?.classification === 'fixed' ? '1' : '0'));
      let initialRatio = initialQty;
      let initialMode: 'per_piece' | 'pieces_per_unit' | 'per_batch' = 'per_batch';
      
      if (costType === 'packaging' && unifiedPkgValue && Number(unifiedPkgValue) > 0) {
        initialMode = 'pieces_per_unit';
        initialRatio = unifiedPkgValue;
        initialQty = String(batchSizeNumber / Number(unifiedPkgValue));
      }

      setValue('items', [...selectedItems, { 
        ingredientId: id,
        quantityUsed: initialQty,
        usageMode: initialMode,
        usageRatio: initialRatio,
        costType,
      }], { shouldValidate: true });
    }
  };

  const getCalculatedQuantity = (batchSize: number, mode: 'per_piece' | 'pieces_per_unit' | 'per_batch', ratio: number) => {
    if (mode === 'per_piece') return String(batchSize * ratio);
    if (mode === 'pieces_per_unit') return ratio > 0 ? String(batchSize / ratio) : '0';
    return String(ratio);
  };

  const onSubmit = async (values: AddIngredientValues, stay: boolean = false) => {
    try {
      // Only process items for the active tab; preserve the other tab's selections
      const isPackagingTab = libraryTab === 'packaging';
      const tabItems = values.items.filter(i =>
        isPackagingTab ? i.costType === 'packaging' : i.costType !== 'packaging'
      );
      const otherTabItems = values.items.filter(i =>
        isPackagingTab ? i.costType !== 'packaging' : i.costType === 'packaging'
      );
      values = { ...values, items: tabItems };

      // Save product-level packaging details first
      if (product) {
        await editProduct(pId, {
          ...product,
          unitsPerSale: Number(values.unitsPerSale),
          saleUnitLabel: values.saleUnitLabel.trim(),
          batchSize: localBatchSize
        } as any);
      }
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
        // Update logic: we now use item-level costTypes
        for (const item of values.items) {
          const originalLink = activeInitialItems.find(i => i.ingredientId === item.ingredientId);
          const finalQty = Math.max(Number(item.quantityUsed) || 1, 0.00001);

          if (originalLink) {
            await editProductIngredient(pId, originalLink.linkId, {
              ingredientId: item.ingredientId,
              quantityUsed: finalQty,
              usageMode: item.usageMode,
              usageRatio: Number(item.usageRatio) || 0,
              costType: item.costType,
            });
          } else {
            newItems.push({
              productId: pId,
              ingredientId: item.ingredientId,
              quantityUsed: finalQty,
              usageMode: item.usageMode,
              usageRatio: Number(item.usageRatio) || 0,
              costType: item.costType,
            });
          }
        }
        if (newItems.length > 0) await bulkAddIngredientsToProduct(newItems);

      } else if (activeEditLinkId) {
        // Legacy single-edit mode
        const primaryIdx = values.items.findIndex(i => i.ingredientId === initialIngredientId);
        const updateIdx = primaryIdx > -1 ? primaryIdx : 0;
        const updateItem = values.items[updateIdx];
        const finalQty = Math.max(Number(updateItem.quantityUsed) || 1, 0.00001);

        await editProductIngredient(pId, activeEditLinkId!, {
          ingredientId: updateItem.ingredientId,
          quantityUsed: finalQty,
          usageMode: updateItem.usageMode,
          usageRatio: Number(updateItem.usageRatio) || 0,
          costType: updateItem.costType,
        });

        const extraItems: any[] = [];
        for (let i = 0; i < values.items.length; i++) {
          if (i === updateIdx) continue;
          const extra = values.items[i];
          extraItems.push({
            productId: pId,
            ingredientId: extra.ingredientId,
            quantityUsed: Math.max(Number(extra.quantityUsed) || 1, 0.00001),
            costType: extra.costType,
          });
        }
        if (extraItems.length > 0) await bulkAddIngredientsToProduct(extraItems);

      } else {
        // Pure Batch Add mode
        const toAdd: ProductIngredientInput[] = values.items.map(item => ({
          productId: pId,
          ingredientId: item.ingredientId,
          quantityUsed: Math.max(Number(item.quantityUsed) || 0, 0),
          usageMode: item.usageMode,
          usageRatio: Number(item.usageRatio) || 0,
          costType: item.costType,
        }));
        await bulkAddIngredientsToProduct(toAdd);
      }
      
      setLocalEditGroup(null);
      reset({
        items: otherTabItems,
        unitsPerSale: String(Number(values.unitsPerSale) || product?.unitsPerSale || 1),
        saleUnitLabel: values.saleUnitLabel ?? product?.saleUnitLabel ?? '',
      });
      setSearchQuery('');
      if (libraryTab === 'raw') {
        setLibraryTab('packaging');
      } else {
        safeGoBack();
      }
    } catch (err: any) {
      console.error(err);
      showAlert('Error', `Unable to process resource links: ${err?.message || 'Unknown error'}`);
    }
  };

  if (!ingredients.length && !productIngredients.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(20, 83, 45, 0.01)', paddingHorizontal: 32, paddingTop: 96 }}>
        <View style={{ height: 80, width: 80, borderRadius: 40, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
           <Ionicons name="cube-outline" size={40} color="#86efac" />
        </View>
        <Text style={{ textAlign: 'center', fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 8 }}>Resource Library Empty</Text>
        <Text style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', fontWeight: '500', lineHeight: 20, marginBottom: 32 }}>
          You need to add resources to your library before you can link them to business compositions.
        </Text>
        <Pressable
          onPress={() => safeNavigate('IngredientForm', { productId })}
          style={{ marginTop: 20 }}
        >
          <View style={{
            borderRadius: 32,
            backgroundColor: '#14532d',
            paddingHorizontal: 32,
            paddingVertical: 16,
            shadowColor: '#14532d',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          }}>
            <Text style={{
              fontWeight: '900',
              color: '#ffffff',
              fontSize: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}>Create Resource</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={{ flex: 1, paddingHorizontal: 24 }} 
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: selectedItems.length > 0 ? Math.max(insets.bottom, 120) : Math.max(insets.bottom, 40) }}
        >
          {/* ── Product Context Header ── */}
          <View style={{ marginTop: 24, marginBottom: 20, borderRadius: 24, backgroundColor: '#14532d', paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#4ade80', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 4 }}>Composing Resources For</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff', letterSpacing: -1 }}>{product?.name || 'Product'}</Text>
            <View style={{ marginTop: 8 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
              }}>
                <Ionicons name="layers" size={12} color="#4ade80" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>Total: {batchSizeNumber} Pieces</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>{product?.category || 'General'}</Text>
              </View>
              {tabSelectedCount > 0 && (
                <View style={{ marginLeft: 8, backgroundColor: 'rgba(74, 222, 128, 0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.3)' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#4ade80', textTransform: 'uppercase', letterSpacing: 1 }}>{tabSelectedCount} selected</Text>
                </View>
              )}
            </View>
          </View>


          <FormSection title="Library Selection" icon="layers">
            {/* View Switcher Tabs */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: '#f8fafc',
              borderRadius: 16,
              padding: 4,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#f1f5f9',
            }}>
              <Pressable
                onPress={() => setLibraryTab('raw')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: libraryTab === 'raw' ? '#14532d' : 'transparent',
                }}
              >
                <Ionicons name="leaf" size={14} color={libraryTab === 'raw' ? 'white' : '#1e293b'} />
                <Text style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: libraryTab === 'raw' ? 'white' : '#1e293b',
                }}>Raw Materials</Text>
              </Pressable>
              <Pressable
                onPress={() => setLibraryTab('packaging')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: libraryTab === 'packaging' ? '#14532d' : 'transparent',
                }}
              >
                <Ionicons name="cube" size={14} color={libraryTab === 'packaging' ? 'white' : '#1e293b'} />
                <Text style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: libraryTab === 'packaging' ? 'white' : '#1e293b',
                }}>Packaging</Text>
              </Pressable>
            </View>

            {/* Search bar */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(240, 253, 244, 0.5)',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#f1f5f9',
              paddingHorizontal: 16,
              marginBottom: 12,
              height: 44,
            }}>
              <Ionicons name="search" size={16} color="#9ca3af" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search resources..."
                placeholderTextColor="#9ca3af"
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 14,
                  color: '#1e293b',
                  fontWeight: '600',
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </Pressable>
              )}
            </View>

            {libraryTab === 'raw' ? (
              /* ── Section A: Raw Materials ── */
              <View style={{ marginBottom: 8 }}>
                <View style={{ gap: 8 }}>
                  {rawMaterials.length === 0 && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#94a3b8', paddingHorizontal: 8, paddingVertical: 8 }}>
                      {searchQuery ? 'No materials match filter.' : 'No materials found.'}
                    </Text>
                  )}

                  {visibleRawMaterials.map((ingredient) => {
                    const isSelected = selectedItems.some(i => i.ingredientId === ingredient.id && i.costType !== 'packaging');
                    const refQty = Math.max(Number((ingredient as any).quantity ?? 1), 0.00000001);
                    const yieldFactor = Math.max(Number((ingredient as any).yieldFactor ?? 1), 0.00000001);
                    const unitCost = ((Number((ingredient as any).pricePerUnit) || 0) / refQty) / yieldFactor;

                    return (
                      <Pressable
                        key={ingredient.id}
                        onPress={() => handleToggleIngredient(ingredient.id, 'ingredients')}
                      >
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderRadius: 16,
                          borderWidth: 1,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderColor: isSelected ? '#14532d' : '#f1f5f9',
                          backgroundColor: isSelected ? '#14532d' : '#ffffff',
                        }}>
                          <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '900',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                color: isSelected ? '#ffffff' : '#1e293b',
                              }}
                              numberOfLines={1}
                            >
                              {ingredient.name}
                            </Text>
                            <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: isSelected ? 'rgba(255,255,255,0.8)' : '#94a3b8' }}>
                                {formatMoney(unitCost, currencyCode, 3)} / {ingredient.unit}
                              </Text>
                            </View>
                          </View>

                          <View style={{
                            height: 24,
                            width: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isSelected ? '#4ade80' : '#e2e8f0',
                            backgroundColor: isSelected ? '#22c55e' : '#f8fafc',
                          }}>
                            {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}

                  {hiddenRawCount > 0 && (
                    <Pressable
                      onPress={() =>
                        setVisibleResourceCount((prev) => Math.min(prev + resourcePageSize, rawMaterials.length))
                      }
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    >
                      <View style={{
                        borderRadius: 100,
                        borderWidth: 1,
                        borderColor: '#f1f5f9',
                        backgroundColor: '#f8fafc',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}>
                        <Text style={{
                          fontSize: 10,
                          fontWeight: '900',
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                          color: '#1e293b',
                        }}>
                          {`Show (${nextShowCount}) more Materials`}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : (
              /* ── Section B: Consumables & Packaging ── */
              <View style={{ marginBottom: 8 }}>
                <View style={{ gap: 8 }}>
                  {packagingMaterials.length === 0 && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#94a3b8', paddingHorizontal: 8, paddingVertical: 8 }}>
                      {searchQuery ? 'No packaging match search.' : 'No packaging resources available.'}
                    </Text>
                  )}

                  {packagingMaterials.slice(0, 8).map((ingredient) => {
                    const isSelected = selectedItems.some(i => i.ingredientId === ingredient.id && i.costType === 'packaging');
                    const uCost = ((Number(ingredient.pricePerUnit) || 0) / Math.max(Number(ingredient.quantity || 1), 0.0000001));

                    return (
                      <Pressable
                        key={ingredient.id}
                        onPress={() => handleToggleIngredient(ingredient.id, 'packaging')}
                      >
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderRadius: 16,
                          borderWidth: 1,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderColor: isSelected ? '#14532d' : '#f1f5f9',
                          backgroundColor: isSelected ? '#14532d' : '#ffffff',
                        }}>
                          <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '900',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                color: isSelected ? '#ffffff' : '#1e293b',
                              }}
                              numberOfLines={1}
                            >
                              {ingredient.name}
                            </Text>
                            <Text style={{
                              fontSize: 10,
                              fontWeight: '600',
                              marginTop: 4,
                              color: isSelected ? 'rgba(255,255,255,0.8)' : '#94a3b8',
                            }}>
                               {formatMoney(uCost, currencyCode, 3)} / {ingredient.unit}
                            </Text>
                          </View>

                          <View style={{
                            height: 24,
                            width: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isSelected ? '#4ade80' : '#e2e8f0',
                            backgroundColor: isSelected ? '#22c55e' : '#f8fafc',
                          }}>
                            {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Add New Quick Shortcut */}
            <Pressable
                onPress={() => safeNavigate('IngredientForm', { 
                  productId, 
                  prefillTag: libraryTab === 'packaging' ? 'Packaging' : 'Raw Material' 
                })}
                style={{ marginTop: 4, alignSelf: 'flex-start' }}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 100,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#e2e8f0',
                  backgroundColor: '#f8fafc',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}>
                  <Ionicons name="add-circle" size={14} color="#166534" />
                  <Text style={{
                    marginLeft: 4,
                    fontSize: 10,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: '#14532d',
                  }}>New Resource</Text>
                </View>
              </Pressable>

            {errors.items && !selectedItems.length && (
              <Text style={{
                marginTop: 16,
                fontSize: 10,
                color: '#ef4444',
                fontWeight: '700',
                paddingHorizontal: 4,
              }}>
                {errors.items.message}
              </Text>
            )}
          </FormSection>

          {tabSelectedCount > 0 && (
            <FormSection title="Configuration" icon="options">
              <View style={{
                backgroundColor: 'rgba(248, 250, 252, 0.4)',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: '#f1f5f9',
                overflow: 'hidden',
              }}>

                {selectedItems.map((item, index) => {
                  if (item.costType === 'packaging') return null; // Handled separately below
                  const ingredient = ingredients.find(i => i.id === item.ingredientId);
                  const piInfo = productIngredients.find(pi => pi.ingredientId === item.ingredientId);
                  const displayName = ingredient?.name ?? piInfo?.ingredientName ?? 'Resource';
                  const displayUnit = ingredient?.unit ?? piInfo?.ingredientUnit ?? '';
                  const price = ingredient?.pricePerUnit ?? piInfo?.ingredientPricePerUnit ?? 0;
                  const refQty = Math.max(Number(ingredient?.quantity ?? piInfo?.ingredientQuantity ?? 1), 0.00000001);
                  const yieldFactor = Math.max(Number(ingredient?.yieldFactor ?? piInfo?.ingredientYieldFactor ?? 1), 0.00000001);
                  const unitCost = (price / refQty) / yieldFactor;
                  const usedQty = Math.max(Number(item.quantityUsed) || 0, 0);
                  const lineCost = unitCost * usedQty;

                  if (!displayName) return null;


                  return (
                    <View key={item.ingredientId} style={{ 
                      padding: 16, 
                      borderTopWidth: index > 0 ? 1 : 0, 
                      borderTopColor: 'rgba(20, 83, 45, 0.1)' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{
                              fontSize: 11,
                              fontWeight: '900',
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              color: '#1e293b',
                            }} numberOfLines={1}>
                              {displayName}
                            </Text>
                          </View>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: '600',
                            color: '#94a3b8',
                            marginTop: 2,
                          }}>
                            {formatMoney(unitCost, currencyCode, 3)} / {displayUnit}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
                          <Text style={{
                            fontSize: 9,
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            color: '#cbd5e1',
                            marginBottom: 2,
                          }}>Cost</Text>
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '900',
                            color: lineCost > 0 ? '#15803d' : '#94a3b8',
                          }}>
                            {formatMoney(lineCost, currencyCode)}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleToggleIngredient(item.ingredientId)} hitSlop={12}>
                          <Ionicons name="close-circle" size={20} color="#ef4444" />
                        </Pressable>
                      </View>

                      <View style={{ marginTop: 8 }}>
                          {/* Usage Mode Selection - Hide for Raw Materials */}
                          {(item.costType as string) === 'packaging' && (
                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                              {[
                                { id: 'per_piece', label: 'Per Piece', icon: 'person-outline' },
                                { id: 'pieces_per_unit', label: 'Shared (CPC)', icon: 'grid-outline' },
                                { id: 'per_batch', label: 'Bulk', icon: 'layers-outline' },
                              ].map((mode) => (
                                <Pressable
                                  key={mode.id}
                                  onPress={() => {
                                    const updated = [...selectedItems];
                                    const m = mode.id as any;
                                    const rRaw = Number(item.usageRatio);
                                    // Prevent "0" quantities when the user has an empty/invalid usage ratio.
                                    const r = isFinite(rRaw) && rRaw > 0 ? rRaw : 0.00001;
                                    updated[index] = { 
                                      ...updated[index], 
                                      usageMode: m,
                                      quantityUsed: getCalculatedQuantity(batchSizeNumber, m, r)
                                    };
                                    setValue('items', updated);
                                  }}
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    backgroundColor: item.usageMode === mode.id ? '#14532d' : '#f8fafc',
                                    borderWidth: 1,
                                    borderColor: item.usageMode === mode.id ? '#14532d' : '#f1f5f9',
                                  }}
                                >
                                  <Ionicons name={mode.icon as any} size={10} color={item.usageMode === mode.id ? '#ffffff' : '#64748b'} style={{ marginRight: 4 }} />
                                  <Text style={{ fontSize: 9, fontWeight: '900', color: item.usageMode === mode.id ? '#ffffff' : '#64748b', textTransform: 'uppercase' }}>{mode.label}</Text>
                                </Pressable>
                              ))}
                            </View>
                          )}

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ flex: 1 }}>
                               <Text style={{ fontSize: 8, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>
                                  {(item.costType as string) === 'packaging' 
                                    ? (item.usageMode === 'per_piece' ? 'Units per Piece' : item.usageMode === 'pieces_per_unit' ? 'Pieces per Unit (CPC)' : 'Total Batch Quantity')
                                    : 'Quantity Used'}
                               </Text>
                               <View style={{
                                  backgroundColor: '#ffffff',
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: '#f1f5f9',
                                  paddingHorizontal: 12,
                                  height: 36,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                               }}>
                                  <TextInput
                                    value={item.usageRatio}
                                    onChangeText={(text) => {
                                      const updated = [...selectedItems];
                                      const parsed = parseFloat(text);
                                      const valid = isFinite(parsed) && parsed > 0;
                                      updated[index] = {
                                        ...updated[index],
                                        usageRatio: text,
                                        ...(valid && {
                                          quantityUsed: getCalculatedQuantity(batchSizeNumber, item.usageMode, parsed),
                                        }),
                                      };
                                      setValue('items', updated);
                                    }}
                                    keyboardType="decimal-pad"
                                    placeholder="0"
                                    style={{ flex: 1, fontSize: 13, fontWeight: '900', color: '#1e293b' }}
                                  />
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#cbd5e1', marginLeft: 4 }}>{displayUnit}</Text>
                               </View>
                            </View>
                            
                          {(item.costType as string) === 'packaging' && item.usageMode !== 'per_batch' && (
                              <View style={{ flex: 1 }}>
                                 <Text style={{ fontSize: 8, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Resulting Batch Qty</Text>
                                 <View style={{
                                    backgroundColor: 'rgba(20, 83, 45, 0.03)',
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    height: 36,
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(20, 83, 45, 0.05)',
                                 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#14532d' }}>{Math.round(Number(item.quantityUsed) * 100) / 100} {displayUnit}</Text>
                                 </View>
                              </View>
                            )}
                          </View>
                        </View>
                    </View>
                  );
                })}

                {/* Unified Packaging Configuration Block */}
                {packagingSelected.length > 0 && libraryTab === 'packaging' && (
                  <View style={{ 
                    padding: 20, 
                    backgroundColor: 'rgba(52, 211, 153, 0.05)', 
                    borderTopWidth: 1, 
                    borderTopColor: 'rgba(52, 211, 153, 0.1)' 
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ height: 32, width: 32, borderRadius: 10, backgroundColor: 'rgba(52, 211, 153, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                        <Ionicons name="cube" size={16} color="#059669" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#059669', textTransform: 'uppercase', letterSpacing: 1 }}>Packaging Setup</Text>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: '#64748b' }}>Includes: {packagingSelected.map(p => {
                          const ing = ingredients.find(i => i.id === p.ingredientId);
                          return ing?.name ?? 'Resource';
                        }).join(', ')}</Text>
                      </View>
                    </View>

                    {/* Row 1: Inputs */}
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                      <View style={{ flex: 1.2 }}>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', marginBottom: 2 }}>Products per packaging</Text>
                        <Text style={{ fontSize: 7, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>(1 pcs for default per item)</Text>
                        <View style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#d1fae5',
                          paddingHorizontal: 12,
                          height: 44,
                          justifyContent: 'center'
                        }}>
                          <TextInput
                            value={unifiedPkgValue}
                             onChangeText={(v) => {
                               setUnifiedPkgValue(v);
                               const parsedU = Number(v);
                               if (!isFinite(parsedU) || parsedU <= 0) return;
                               const u = parsedU;
                               const currentBs = batchSizeNumber;
                               const newBoxes = currentBs / u;
                               const safeBoxes = newBoxes > 0 ? newBoxes : 0.00001;
                               const roundedBoxes = Math.round(safeBoxes * 10000) / 10000;
                               const finalBoxes = roundedBoxes > 0 ? roundedBoxes : 0.00001;

                               setHelperBatches(String(finalBoxes));
                               
                               const currentItems = watch('items') || [];
                               const updated = currentItems.map(item => {
                                 if (item.costType === 'packaging') {
                                   return {
                                     ...item,
                                     usageMode: 'pieces_per_unit' as const,
                                     usageRatio: String(u),
                                     quantityUsed: String(finalBoxes)
                                   };
                                 }
                                 return {
                                   ...item,
                                   quantityUsed: getCalculatedQuantity(currentBs, item.usageMode, Number(item.usageRatio) || 0)
                                 };
                               });
                               setValue('items', updated);
                               setValue('unitsPerSale', String(u));
                             }}
                            keyboardType="decimal-pad"
                            placeholder="1"
                            style={{ fontSize: 16, fontWeight: '900', color: '#14532d' }}
                          />
                        </View>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', marginBottom: 14 }}>Batch</Text>
                        <View style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#d1fae5',
                          paddingHorizontal: 12,
                          height: 44,
                          justifyContent: 'center'
                        }}>
                          <TextInput
                            value={helperBatches}
                            onChangeText={(v) => {
                              setHelperBatches(v);
                              const b = Number(v) || 0;
                              const u = Number(unifiedPkgValue) || 1;
                              if (b > 0) {
                                const newBs = u * b;
                                setLocalBatchSize(newBs);
                                const currentItems = watch('items') || [];
                                const updated = currentItems.map(item => {
                                  if (item.costType === 'packaging') {
                                    return {
                                      ...item,
                                      quantityUsed: String(b)
                                    };
                                  }
                                  return {
                                    ...item,
                                    quantityUsed: getCalculatedQuantity(newBs, item.usageMode, Number(item.usageRatio) || 0)
                                  };
                                });
                                setValue('items', updated);
                              }
                            }}
                            keyboardType="decimal-pad"
                            placeholder="1"
                            style={{ fontSize: 16, fontWeight: '900', color: '#14532d' }}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Row 2: Summary */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(52, 211, 153, 0.1)',
                      padding: 12,
                      borderRadius: 16
                    }}>
                      <View>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: '#059669', textTransform: 'uppercase', marginBottom: 4 }}>Total</Text>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#059669' }}>{formatMoney(currentPackagingCost, currencyCode)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: '#059669', textTransform: 'uppercase', marginBottom: 4, opacity: 0.7 }}>Breakdown</Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>
                           {Math.floor(Number(helperBatches))} units 
                           {Number(batchSizeNumber) % (Number(unifiedPkgValue) || 1) !== 0 && (
                             <Text style={{ fontSize: 9, color: '#065f46', fontWeight: '500' }}>
                               {` + ${Number(batchSizeNumber) % (Number(unifiedPkgValue) || 1)} pieces`}
                             </Text>
                           )}
                        </Text>
                        <Text style={{ fontSize: 9, color: '#059669', opacity: 0.6 }}>
                          x {formatMoney(packagingSelected.reduce((s, p) => {
                             const ing = ingredients.find(i => i.id === p.ingredientId);
                             const pi = productIngredients.find(pi => pi.ingredientId === p.ingredientId);
                             const pr = ing?.pricePerUnit ?? pi?.ingredientPricePerUnit ?? 0;
                             const q = Math.max(Number(ing?.quantity ?? pi?.ingredientQuantity ?? 1), 0.00000001);
                             const y = Math.max(Number(ing?.yieldFactor ?? pi?.ingredientYieldFactor ?? 1), 0.00000001);
                             return s + ((pr / q) / y);
                           }, 0), currencyCode)}
                        </Text>
                      </View>
                    </View>
                    {/* Row 3: Remainder Adjustment Suggestions (Optional) */}
                    {Number(batchSizeNumber) % (Number(unifiedPkgValue) || 1) !== 0 && (
                      <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(52, 211, 153, 0.1)', paddingTop: 10 }}>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: '#059669', textTransform: 'uppercase', marginBottom: 6, opacity: 0.8 }}>Snap Batch to packaging capacity?</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {[
                            Math.floor(Number(batchSizeNumber) / (Number(unifiedPkgValue) || 1)) * (Number(unifiedPkgValue) || 1),
                            Math.ceil(Number(batchSizeNumber) / (Number(unifiedPkgValue) || 1)) * (Number(unifiedPkgValue) || 1)
                          ].filter(v => v > 0).map(suggestedBs => (
                            <Pressable
                              key={suggestedBs}
                              onPress={() => {
                                const newBs = suggestedBs;
                                const u = Number(unifiedPkgValue) || 1;
                                const b = newBs / u;
                                setLocalBatchSize(newBs);
                                setHelperBatches(String(b));
                                
                                const currentItems = watch('items') || [];
                                const updated = currentItems.map(item => {
                                  if (item.costType === 'packaging') {
                                    return {
                                      ...item,
                                      quantityUsed: String(b) 
                                    };
                                  }
                                  return {
                                    ...item,
                                    quantityUsed: getCalculatedQuantity(newBs, item.usageMode, Number(item.usageRatio) || 0)
                                  };
                                });
                                setValue('items', updated);
                              }}
                              style={{
                                backgroundColor: '#059669',
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#ffffff' }}>Snap to {suggestedBs} pcs</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Batch Total Footer */}
                <View style={{
                  backgroundColor: 'rgba(20, 83, 45, 0.05)',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(20, 83, 45, 0.1)',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                   <Text style={{
                     fontSize: 10,
                     fontWeight: '900',
                     textTransform: 'uppercase',
                     letterSpacing: 1,
                     color: '#1e293b',
                   }}>Total Selection Cost</Text>
                   <Text style={{
                     fontSize: 18,
                     fontWeight: '900',
                     color: '#1e293b',
                   }}>
                      {formatMoney(selectedItems.reduce((sum, item) => {
                        const ing = ingredients.find(i => i.id === item.ingredientId) as any;
                        const pi = productIngredients.find(p => p.ingredientId === item.ingredientId) as any;
                        const p = ing?.pricePerUnit ?? pi?.ingredientPricePerUnit ?? 0;
                        const q = Math.max(Number(ing?.quantity ?? pi?.ingredientQuantity ?? 1), 0.00000001);
                        const y = Math.max(Number(ing?.yieldFactor ?? pi?.ingredientYieldFactor ?? 1), 0.00000001);
                        const u = (p / q) / y;
                        const usedQty = Math.max(Number(item.quantityUsed) || 0, 0);
                        return sum + (u * usedQty);
                      }, 0), currencyCode)}
                   </Text>
                </View>
              </View>
            </FormSection>
          )}

          {/* Resource selection and configuration already handled above */}
          

          {/* Composition Summary */}
          {productIngredients.length > 0 && (
            <FormSection title="Composition (Already Linked)" icon="checkmark-circle-outline">
              <View style={{ gap: 24 }}>
                {['ingredients', 'material', 'packaging', 'overhead', 'labor', 'utilities', 'other'].map((costType) => {
                  const groupItems = productIngredients.filter(pi => pi.costType === costType);
                  if (groupItems.length === 0) return null;
                  const costTypeLabel = COST_TYPE_LABELS[costType] ?? costType;

                  const groupTotal = groupItems.reduce((sum, pi) => sum + (getTrueUnitCost(pi) * pi.quantityUsed), 0);

                  const isExpanded = expandedCategories.has(costType);

                  return (
                    <View key={costType} style={{ marginBottom: 16 }}>
                      <Pressable 
                        onPress={() => toggleCategory(costType)}
                        style={{ paddingHorizontal: 4 }}
                      >
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                          paddingHorizontal: 4,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons 
                              name={isExpanded ? "chevron-down" : "chevron-forward"} 
                              size={12} 
                              color="#166534" 
                              style={{ marginRight: 6 }}
                            />
                            <Text style={{
                              fontSize: 11,
                              fontWeight: '900',
                              color: '#1e293b',
                              textTransform: 'uppercase',
                              letterSpacing: 2,
                            }}>{costTypeLabel}</Text>
                          </View>
                          
                          {!isExpanded && (
                            <View style={{
                              backgroundColor: '#1e293b',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 12,
                            }}>
                               <Text style={{
                                 fontSize: 9,
                                 fontWeight: '900',
                                 color: '#ffffff',
                                 textTransform: 'uppercase',
                               }}>{formatMoney(groupTotal, currencyCode)}</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>

                      <View style={{
                        backgroundColor: 'rgba(248, 250, 252, 0.4)',
                        borderWidth: 1,
                        borderColor: '#f1f5f9',
                        borderRadius: 24,
                        overflow: 'hidden',
                      }}>
                        {isExpanded && (
                          <View>
                            {groupItems.map((pi, idx) => (
                              <View 
                                key={pi.id} 
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  padding: 16,
                                  borderTopWidth: idx > 0 ? 1 : 0,
                                  borderTopColor: 'rgba(241, 245, 249, 0.5)',
                                }}
                              >
                                <View style={{ flex: 1, marginRight: 12 }}>
                                  <Text style={{
                                    fontSize: 11,
                                    fontWeight: '900',
                                    color: '#1e293b',
                                    marginBottom: 4,
                                  }} numberOfLines={1}>{pi.ingredientName}</Text>
                                  <Text style={{
                                    fontSize: 10,
                                    fontWeight: '900',
                                    color: '#94a3b8',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                  }}>
                                     {pi.quantityUsed}{pi.ingredientUnit} × {formatMoney(getTrueUnitCost(pi), currencyCode, 3)}
                                  </Text>
                                </View>

                                <View style={{ alignItems: 'flex-end', marginRight: 16 }}>
                                   <Text style={{
                                     fontSize: 9,
                                     fontWeight: '900',
                                     color: '#cbd5e1',
                                     textTransform: 'uppercase',
                                     letterSpacing: 1,
                                     marginBottom: 4,
                                   }}>COST</Text>
                                   <Text style={{
                                     fontSize: 16,
                                     fontWeight: '900',
                                     color: '#15803d',
                                   }}>
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
                            <View style={{
                              backgroundColor: 'rgba(241, 245, 249, 0.3)',
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              borderTopWidth: 1,
                              borderTopColor: 'rgba(241, 245, 249, 0.5)',
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <Text style={{
                                fontSize: 10,
                                fontWeight: '900',
                                color: '#1e293b',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                              }}>Total</Text>
                              <Text style={{
                                fontSize: 18,
                                fontWeight: '900',
                                color: '#1e293b',
                              }}>{formatMoney(groupTotal, currencyCode)}</Text>
                            </View>
                          </View>
                        )}
                        
                        {!isExpanded && (
                          <Pressable onPress={() => toggleCategory(costType)}>
                             <View style={{
                               paddingHorizontal: 16,
                               paddingVertical: 12,
                               flexDirection: 'row',
                               justifyContent: 'space-between',
                               alignItems: 'center',
                             }}>
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: '900',
                                  color: '#94a3b8',
                                  textTransform: 'uppercase',
                                  letterSpacing: 1,
                                }}>Tap to view breakdown</Text>
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: '900',
                                  color: '#cbd5e1',
                                  textTransform: 'uppercase',
                                  letterSpacing: 1,
                                }}>{groupItems.length} Items</Text>
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



        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Action Button */}
      {tabSelectedCount > 0 && (
        <View 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            paddingHorizontal: 24,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: '#f8fafc',
            paddingBottom: Math.max(insets.bottom, 24),
          }}
        >
          <Pressable
            onPress={() => {
              const values = getValues();
              const isPackagingTab = libraryTab === 'packaging';
              const tabItems = values.items.filter((i: AddIngredientValues['items'][number]) =>
                isPackagingTab ? i.costType === 'packaging' : i.costType !== 'packaging'
              );
              if (tabItems.length === 0) {
                showAlert('No items selected', 'Select at least one resource from this tab.');
                return;
              }
              const hasInvalid = tabItems.some((i: AddIngredientValues['items'][number]) => {
                const qty = parseFloat(i.quantityUsed);
                const ratio = parseFloat(i.usageRatio);
                return isNaN(qty) || qty <= 0 || isNaN(ratio) || ratio < 0;
              });
              if (hasInvalid) {
                showAlert('Invalid input', 'Check your resource quantities before composing.');
                return;
              }
              const ups = parseFloat(values.unitsPerSale);
              if (isNaN(ups) || ups <= 0) {
                showAlert('Invalid input', 'Units per sale must be a positive number.');
                return;
              }
              void onSubmit(values, false);
            }}
            disabled={isSubmitting}
          >
            <View style={{
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 32,
              backgroundColor: '#14532d',
              shadowColor: '#14532d',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 8,
              opacity: isSubmitting ? 0.7 : 1,
            }}>
              <Text style={{
                fontWeight: '900',
                color: '#ffffff',
                fontSize: 14,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}>
                {isSubmitting ? 'Processing...' : activeEditLinkId ? 'Update Composition' : 'Compose'}
              </Text>
            </View>
          </Pressable>
        </View>
      )}
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
