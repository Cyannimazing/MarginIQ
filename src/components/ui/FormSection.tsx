import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FormSectionProps = {
  title: string;
  icon: any;
  children: React.ReactNode;
};

export function FormSection({ title, icon, children }: FormSectionProps) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center mb-3 px-1">
        <View className="h-8 w-8 rounded-full bg-brand-100 items-center justify-center">
          <Ionicons name={icon} size={16} color="#166534" />
        </View>
        <Text className="ml-3 text-[10px] font-black text-brand-900 uppercase tracking-widest">{title}</Text>
      </View>
      <View className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm">
        {children}
      </View>
    </View>
  );
}
