import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
          style={{ transform: [{ translateY: slideAnim }] }}
          className="mt-auto bg-white rounded-t-[40px] pb-10 pt-6 shadow-2xl"
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
                  <View className="bg-brand-900 h-16 rounded-[28px] flex-row items-center justify-center gap-3 shadow-lg">
                    <Ionicons name="layers" size={20} color="white" />
                    <Text className="text-[13px] font-black text-white uppercase tracking-widest">Compose Resources</Text>
                  </View>
                </Pressable>

                {/* ── Secondary: View Analysis ── */}
                <Pressable
                  className="mb-3"
                  onPress={() => { navigation.navigate('ProductDetail', { productId: product.id }); onClose(); }}
                >
                  <View className="bg-brand-50 h-14 rounded-[28px] flex-row items-center justify-center gap-3 border border-brand-100">
                    <Ionicons name="analytics-outline" size={18} color="#14532d" />
                    <Text className="text-[12px] font-black text-brand-900 uppercase tracking-widest">View Analysis</Text>
                  </View>
                </Pressable>

                {/* ── Secondary: Log Sales ── */}
                <Pressable
                  className="mb-6"
                  onPress={() => { navigation.navigate('SalesLogger', { productId: product.id }); onClose(); }}
                >
                  <View className="bg-brand-50 h-14 rounded-[28px] flex-row items-center justify-center gap-3 border border-brand-100">
                    <Ionicons name="stats-chart-outline" size={18} color="#14532d" />
                    <Text className="text-[12px] font-black text-brand-900 uppercase tracking-widest">Log Sales</Text>
                  </View>
                </Pressable>

                {/* ── Quick actions row ── */}
                <View className="mb-6">
                  <Text className="text-[9px] font-black text-brand-400 uppercase tracking-[3px] mb-4">Quick Actions</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'center', paddingVertical: 6, gap: 12 }}
                  >
                    {/* Edit */}
                    <ActionChip
                      icon="create-outline"
                      label="Edit"
                      onPress={() => { navigation.navigate('ProductForm', { productId: product.id }); onClose(); }}
                    />

                    {/* Pin */}
                    <ActionChip
                      icon={product.isPinned ? 'pin' : 'pin-outline'}
                      label={product.isPinned ? 'Unpin' : 'Pin'}
                      active={product.isPinned}
                      activeColor="#d97706"
                      onPress={() => { onPin(product.id); onClose(); }}
                    />

                    {/* Archive */}
                    <ActionChip
                      icon={product.isArchived ? 'archive' : 'archive-outline'}
                      label={product.isArchived ? 'Unarchive' : 'Archive'}
                      active={product.isArchived}
                      activeColor="#d97706"
                      onPress={() => { onArchive(product.id); onClose(); }}
                    />

                    {/* Divider */}
                    <View className="w-px h-8 bg-brand-100 mx-1" />

                    {/* Color swatches */}
                    {COLORS.map((color) => {
                      const isSelected = selectedColor === color;
                      return (
                        <Pressable 
                          key={color} 
                          onPress={() => {
                            setSelectedColor(color);
                            onColorChange(product.id, color);
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: color,
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              borderWidth: isSelected ? 2.5 : 1.5,
                              borderColor: isSelected ? '#14532d' : '#e2e8f0',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isSelected && <Ionicons name="checkmark" size={16} color="#14532d" />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* ── Destructive: Trash ── */}
                <Pressable onPress={() => { onTrash(product.id); onClose(); }}>
                  <View className="h-12 rounded-[28px] flex-row items-center justify-center gap-2 bg-red-50 border border-red-100">
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    <Text className="text-[11px] font-black text-red-600 uppercase tracking-widest">Move to Trash</Text>
                  </View>
                </Pressable>
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
  label,
  onPress,
  active,
  activeColor = '#14532d',
}: {
  icon: any;
  label: string;
  onPress: () => void;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        className={`items-center gap-1.5 px-4 py-3 rounded-[20px] border ${
          active ? 'bg-amber-50 border-amber-200' : 'bg-brand-50 border-brand-100'
        }`}
      >
        <Ionicons name={icon} size={18} color={active ? activeColor : '#14532d'} />
        <Text className={`text-[9px] font-black uppercase tracking-widest ${active ? 'text-amber-700' : 'text-brand-700'}`}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
