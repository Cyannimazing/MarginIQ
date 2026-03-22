import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Animated, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';

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
  '#ffffff', // Default (White)
  '#fecaca', // Red
  '#fed7aa', // Orange
  '#fef08a', // Yellow
  '#dcfce7', // Green
  '#bfdbfe', // Blue
  '#e9d5ff', // Purple
  '#f5d0fe', // Pink
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

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 100,
          mass: 0.8,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => setInternalVisible(false));
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!product) return null;

  const isTrash = !!product.deletedAt;

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1">
        {/* Backdrop (Styled via View, action via Pressable) */}
        <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: fadeAnim }} />
        </Pressable>

        {/* Modal Content */}
        <Animated.View 
          style={{ transform: [{ translateY: slideAnim }] }}
          className="mt-auto bg-white rounded-t-[40px] px-6 pb-10 pt-8 shadow-2xl"
        >
          {/* Handle */}
          <View className="w-12 h-1.5 bg-brand-100 rounded-full self-center mb-8" />

          <Text className="text-center text-xs font-black text-brand-600 uppercase tracking-widest mb-2">Product Actions</Text>
          <Text className="text-center text-xl font-black text-brand-950 mb-8 px-4" numberOfLines={2}>{product.name}</Text>

          {isTrash ? (
            <View className="flex-row gap-4 mb-6">
              <Pressable 
                onPress={() => { onRestore(product.id); onClose(); }}
                className="flex-1"
              >
                <View className="bg-brand-50 p-5 rounded-[32px] items-center border border-brand-100">
                  <Ionicons name="refresh-outline" size={24} color="#166534" />
                  <Text className="mt-2 text-xs font-black text-brand-900 uppercase">Restore</Text>
                </View>
              </Pressable>
              <Pressable 
                onPress={() => { onDeletePermanent(product.id); onClose(); }}
                className="flex-1"
              >
                <View className="bg-red-50 p-5 rounded-[32px] items-center border border-red-100">
                  <Ionicons name="trash" size={24} color="#ef4444" />
                  <Text className="mt-2 text-xs font-black text-red-700 uppercase">Delete Forever</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <>
              {/* PRIMARY ACTION: Compose Resources */}
              <Pressable 
                onPress={() => { navigation.navigate('ProductAddIngredient', { productId: product.id }); onClose(); }}
                className="mb-4"
              >
                <View className="bg-brand-900 p-5 rounded-[32px] flex-row items-center justify-center shadow-lg shadow-brand-900/20">
                  <Ionicons name="layers" size={24} color="white" />
                  <Text className="ml-3 text-sm font-black text-white uppercase tracking-widest">Compose Resources</Text>
                </View>
              </Pressable>

              {/* SECONDARY ACTION: Log Sales */}
              <Pressable 
                onPress={() => { navigation.navigate('SalesLogger', { productId: product.id }); onClose(); }}
                className="mb-6"
              >
                <View className="bg-brand-50 p-4 rounded-[32px] flex-row items-center justify-center border border-brand-100">
                  <Ionicons name="stats-chart" size={20} color="#166534" />
                  <Text className="ml-3 text-xs font-black text-brand-900 uppercase tracking-widest">Log Sales</Text>
                </View>
              </Pressable>

              {/* QUICK ACTIONS & COLORS (Horizontal Scroll) */}
              <View className="mb-8">
                <Text className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4 px-2">Quick Actions & Colors</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  className="flex-row"
                  contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' }}
                >
                  {/* Edit */}
                  <Pressable onPress={() => { navigation.navigate('ProductForm', { productId: product.id }); onClose(); }}>
                    <View className="h-12 w-12 rounded-full bg-brand-50 border border-brand-100 items-center justify-center mr-4">
                      <Ionicons name="create-outline" size={20} color="#166534" />
                    </View>
                  </Pressable>

                  {/* Pin */}
                  <Pressable onPress={() => { onPin(product.id); onClose(); }}>
                    <View className={`h-12 w-12 rounded-full items-center justify-center border mr-4 ${product.isPinned ? 'bg-amber-50 border-amber-200' : 'bg-brand-50 border-brand-100'}`}>
                      <Ionicons name={product.isPinned ? "pin" : "pin-outline"} size={20} color={product.isPinned ? "#f59e0b" : "#166534"} />
                    </View>
                  </Pressable>

                  {/* Archive */}
                  <Pressable onPress={() => { onArchive(product.id); onClose(); }}>
                    <View className={`h-12 w-12 rounded-full items-center justify-center border mr-6 ${product.isArchived ? 'bg-amber-50 border-amber-200' : 'bg-brand-50 border-brand-100'}`}>
                      <Ionicons name={product.isArchived ? "archive" : "archive-outline"} size={20} color={product.isArchived ? "#f59e0b" : "#166534"} />
                    </View>
                  </Pressable>

                  {/* Divider */}
                  <View className="w-[1px] h-8 bg-brand-200 mr-6" />

                  {/* Colors */}
                  {COLORS.map((color) => {
                    const isSelected = (product.color || '#ffffff') === color;
                    return (
                      <Pressable key={color} onPress={() => onColorChange(product.id, color)}>
                        <View
                          style={{ backgroundColor: color }}
                          className={`h-12 w-12 rounded-full mr-4 border-2 items-center justify-center shadow-sm ${
                            isSelected ? 'border-brand-600 scale-110 shadow-brand-600/20' : 'border-slate-100'
                          }`}
                        >
                          {isSelected && <Ionicons name="checkmark" size={20} color={color === '#ffffff' ? '#166534' : '#166534'} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* DESTUCTIVE: Move to Trash */}
              <Pressable onPress={() => { onTrash(product.id); onClose(); }}>
                <View className="flex-row bg-red-50 p-4 rounded-[32px] items-center justify-center border border-red-100">
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text className="ml-2 text-xs font-black text-red-600 uppercase tracking-widest">Move to Trash</Text>
                </View>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
