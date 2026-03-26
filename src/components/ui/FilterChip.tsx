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
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 32,
          marginRight: 8,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: active ? '#064e1c' : '#f1f5f9',
          backgroundColor: active ? '#064e1c' : '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: active ? '#ffffff' : '#14532d', // brand-600 approx
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
