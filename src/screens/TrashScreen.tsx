import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { ActionModal } from '../components/ui/ActionModal';
import { useProductStore } from '../stores/productStore';
import { useSettingsStore } from '../stores/settingsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Trash'>;

export function TrashScreen({ navigation }: Props) {
  const trashProducts = useProductStore((state) => state.trashProducts);
  const loadTrashProducts = useProductStore((state) => state.loadTrashProducts);
  const restoreProduct = useProductStore((state) => state.restoreProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const currencyCode = useSettingsStore((state) => state.settings.currencyCode);

  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm?: () => void;
  }>({ visible: false, title: '', message: '', confirmText: 'Confirm' });

  useEffect(() => {
    void loadTrashProducts();
  }, [loadTrashProducts]);

  const handleRestore = (product: any) => {
    setModalState({
      visible: true,
      title: 'Restore Product',
      message: `Do you want to restore ${product.name}?`,
      confirmText: 'Restore',
      isDestructive: false,
      onConfirm: () => restoreProduct(product.id),
    });
  };

  const handlePermanentDelete = (product: any) => {
    setModalState({
      visible: true,
      title: 'Delete Forever',
      message: `Permanently delete ${product.name}? This action cannot be undone.`,
      confirmText: 'Delete Forever',
      isDestructive: true,
      onConfirm: () => removeProduct(product.id),
    });
  };

  return (
    <View className="flex-1 bg-white">
      {/* Informational Banner */}

      {/* Info Banner */}
      <View className="bg-amber-50 px-4 py-3">
        <Text className="text-xs text-amber-800">
          Items in the trash will be permanently deleted after 30 days.
        </Text>
      </View>

      {trashProducts.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="trash-outline" size={64} color="#cbd5e1" />
          <Text className="mt-4 text-center text-lg font-semibold text-slate-400">
            Trash is empty
          </Text>
        </View>
      ) : (
        <FlatList
          data={trashProducts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerClassName="p-4 gap-3"
          renderItem={({ item }) => (
            <View className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-bold text-slate-900">{item.name}</Text>
                  <Text className="text-xs text-slate-500">
                    Deleted on {new Date(item.deletedAt || '').toLocaleDateString()}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleRestore(item)}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-slate-200">
                      <Ionicons name="refresh" size={18} color="#475569" />
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => handlePermanentDelete(item)}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-red-100">
                      <Ionicons name="trash" size={18} color="#ef4444" />
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <ActionModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        primaryActionText={modalState.confirmText}
        secondaryActionText="Cancel"
        isDestructive={modalState.isDestructive}
        onPrimaryAction={() => {
          setModalState((s: any) => ({ ...s, visible: false }));
          modalState.onConfirm?.();
        }}
        onSecondaryAction={() => setModalState((s: any) => ({ ...s, visible: false }))}
      />
    </View>
  );
}
