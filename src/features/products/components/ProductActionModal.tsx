import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type ProductActionModalProps = {
  visible: boolean;
  onClose: () => void;
  product: any;
  onPin: (id: number) => void;
  onArchive: (id: number) => void;
  onColorChange: (id: number, color: string) => void;
  onTrash: (id: number) => void;
  onRestore: (id: number) => void;
  onDeletePermanent: (id: number) => void;
  navigation: any;
};

const COLORS = [
  '#ffffff',
  '#fecaca',
  '#fed7aa',
  '#fef08a',
  '#dcfce7',
  '#bfdbfe',
  '#e9d5ff',
  '#f5d0fe',
];

export function ProductActionModal({
  visible,
  onClose,
  product,
  onPin,
  onArchive,
  onColorChange,
  onTrash,
  onRestore,
  onDeletePermanent,
  navigation,
}: ProductActionModalProps) {
  const insets = useSafeAreaInsets();
  const [internalVisible, setInternalVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [selectedColor, setSelectedColor] = useState(product?.color || '#ffffff');

  useEffect(() => {
    if (visible && product) {
      setInternalVisible(true);
      setSelectedColor(product.color || '#ffffff');
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 120,
          mass: 0.8,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
      ]).start(() => setInternalVisible(false));
    }
  }, [visible, fadeAnim, slideAnim, product?.color]);

  if (!product) return null;

  const isTrash = !!product.deletedAt;

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1">
        {/* Backdrop */}
        <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Animated.View style={{ flex: 1, backgroundColor: 'rgba(10,24,16,0.72)', opacity: fadeAnim }} />
        </Pressable>

        {/* Sheet */}
        <Animated.View
          style={{ 
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 24) + 16
          }}
          className="mt-auto bg-white rounded-t-[40px] pt-6 shadow-2xl"
        >
          {/* Handle */}
          <View className="w-10 h-1 bg-brand-100 rounded-full self-center mb-6" />

          {/* Header */}
          <View className="px-6 mb-6">
            <Text className="text-[9px] font-black text-brand-400 uppercase tracking-[3px] mb-1">Product Actions</Text>
            <Text className="text-2xl font-black text-brand-900 tracking-tight" numberOfLines={1}>
              {product.name}
            </Text>
          </View>

          <View className="px-6">
            {isTrash ? (
              /* ── Trash Mode ── */
              <View className="flex-row gap-3">
                <Pressable className="flex-1" onPress={() => { onRestore(product.id); onClose(); }}>
                  <View className="bg-brand-900 p-5 rounded-[28px] items-center gap-2">
                    <Ionicons name="refresh" size={22} color="white" />
                    <Text className="text-[11px] font-black text-white uppercase tracking-widest">Restore</Text>
                  </View>
                </Pressable>
                <Pressable className="flex-1" onPress={() => { onDeletePermanent(product.id); onClose(); }}>
                  <View className="bg-red-50 p-5 rounded-[28px] items-center gap-2 border border-red-100">
                    <Ionicons name="trash" size={22} color="#dc2626" />
                    <Text className="text-[11px] font-black text-red-600 uppercase tracking-widest">Delete Forever</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <>
                {/* ── Primary: Compose Resources ── */}
                <Pressable
                  className="mb-3"
                  onPress={() => { navigation.navigate('ProductAddIngredient', { productId: product.id }); onClose(); }}
                >
                  <View className="bg-brand-900 h-16 rounded-[24px] flex-row items-center justify-center gap-3 shadow-lg border-[1.5px] border-brand-900">
                    <Ionicons name="layers" size={20} color="white" />
                    <Text className="text-[13px] font-black text-white uppercase tracking-widest">Compose Resources</Text>
                  </View>
                </Pressable>

                {/* ── Secondary: Log Sales ── */}
                <Pressable
                  className="mb-8"
                  onPress={() => { navigation.navigate('SalesLogger', { productId: product.id }); onClose(); }}
                >
                  <View className="bg-brand-50 h-16 rounded-[24px] flex-row items-center justify-center gap-3 border-[1.5px] border-brand-100">
                    <Ionicons name="stats-chart-outline" size={20} color="#14532d" />
                    <Text className="text-[13px] font-black text-brand-900 uppercase tracking-widest">Log Sales</Text>
                  </View>
                </Pressable>

                {/* ── Unified Actions & Colors Row ── */}
                <View className="mb-8">
                  <Text className="text-[9px] font-black text-brand-400 uppercase tracking-[3px] mb-4">Actions & Color</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'center', gap: 12, paddingHorizontal: 4 }}
                  >
                    {/* Quick Actions */}
                    <ActionChip
                      icon="create-outline"
                      onPress={() => { navigation.navigate('ProductForm', { productId: product.id }); onClose(); }}
                    />
                    <ActionChip
                      icon={product.isPinned ? 'pin' : 'pin-outline'}
                      active={product.isPinned}
                      activeColor="#d97706"
                      onPress={() => { onPin(product.id); onClose(); }}
                    />
                    <ActionChip
                      icon={product.isArchived ? 'archive' : 'archive-outline'}
                      active={product.isArchived}
                      activeColor="#d97706"
                      onPress={() => { onArchive(product.id); onClose(); }}
                    />
                    <ActionChip
                      icon="trash-outline"
                      isDestructive
                      onPress={() => { onTrash(product.id); onClose(); }}
                    />

                    {/* Separator */}
                    <View className="w-[1px] h-8 bg-brand-100 mx-1" />

                    {/* Colors */}
                    {COLORS.map((color) => {
                      const isSelected = selectedColor === color;
                      return (
                        <ActionChip
                          key={color}
                          colorBg={color}
                          active={isSelected}
                          onPress={() => {
                            setSelectedColor(color);
                            onColorChange(product.id, color);
                          }}
                        />
                      );
                    })}
                  </ScrollView>
                </View>

              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ActionChip({
  icon,
  colorBg,
  onPress,
  active,
  activeColor = '#14532d',
  isDestructive,
}: {
  icon?: any;
  colorBg?: string;
  onPress: () => void;
  active?: boolean;
  activeColor?: string;
  isDestructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={colorBg ? { backgroundColor: colorBg } : undefined}
        className={`items-center justify-center h-14 w-14 rounded-full border-[1.5px] ${
          active 
            ? colorBg ? 'border-brand-900 shadow-md' : 'bg-amber-50 border-amber-200 shadow-sm' 
            : isDestructive
              ? 'bg-red-50 border-red-100'
              : colorBg ? 'border-slate-100' : 'bg-brand-50 border-brand-100'
        }`}
      >
        {icon && <Ionicons name={icon} size={22} color={active ? activeColor : isDestructive ? '#dc2626' : '#14532d'} />}
        {colorBg && active && <Ionicons name="checkmark" size={22} color="#14532d" />}
      </View>
    </Pressable>
  );
}
