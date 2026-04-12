import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../stores/settingsStore';

type ArrowDirection = 'up' | 'down' | 'left' | 'right';

const ARROW_ICONS: Record<ArrowDirection, keyof typeof Ionicons.glyphMap> = {
  up: 'arrow-up',
  down: 'arrow-down',
  left: 'arrow-back',
  right: 'arrow-forward',
};

type Props = {
  message: string;
  arrowDirection?: ArrowDirection;
};

export function TutorialBanner({ message, arrowDirection = 'up' }: Props) {
  const insets = useSafeAreaInsets();
  const saveSettings = useSettingsStore((state) => state.saveSettings);

  const handleSkip = () => {
    void saveSettings({ tutorialStep: 0 });
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: insets.bottom + 12,
        left: 16,
        right: 16,
        backgroundColor: '#14532d',
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 100,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          flexShrink: 0,
        }}
      >
        <Ionicons name={ARROW_ICONS[arrowDirection]} size={16} color="#ffffff" />
      </View>
      <Text
        style={{
          flex: 1,
          color: '#ffffff',
          fontSize: 13,
          fontWeight: '700',
          lineHeight: 18,
        }}
      >
        {message}
      </Text>
      <Pressable onPress={handleSkip} style={{ marginLeft: 12, flexShrink: 0 }}>
        <Text
          style={{
            color: '#86efac',
            fontSize: 11,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Skip
        </Text>
      </Pressable>
    </View>
  );
}
