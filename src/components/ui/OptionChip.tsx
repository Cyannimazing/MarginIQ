import React from 'react';
import { Pressable, Text, View } from 'react-native';

type OptionChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: 'sm' | 'md';
};

export function OptionChip({ label, selected, onPress, size = 'md' }: OptionChipProps) {
  const isSm = size === 'sm';
  
  return (
    <Pressable 
      onPress={onPress}
    >
      <View style={{
        marginRight: 6,
        marginBottom: 6,
        borderRadius: 32,
        borderWidth: 1.5,
        paddingHorizontal: isSm ? 12 : 16,
        paddingVertical: isSm ? 6 : 8,
        borderColor: selected ? '#064e3b' : '#f1f5f9',
        backgroundColor: selected ? '#064e3b' : '#ffffff',
      }}>
        <Text style={{
          fontSize: isSm ? 10 : 11,
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: selected ? '#ffffff' : '#64748b',
        }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
