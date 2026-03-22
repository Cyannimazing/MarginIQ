import React from 'react';
import { Pressable, Text, View } from 'react-native';

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <Pressable onPress={onPress}>
      <View
        className={`px-4 py-2 rounded-[32px] mr-2 mb-2 border ${
          active 
            ? 'bg-brand-900 border-brand-900 shadow-sm' 
            : 'bg-white border-brand-100'
        }`}
      >
        <Text className={`text-xs font-black uppercase tracking-widest ${
          active ? 'text-white' : 'text-brand-600'
        }`}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
