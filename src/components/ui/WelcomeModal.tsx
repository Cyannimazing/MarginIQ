import React from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  businessName: string;
  onGuide: () => void;
  onSkip: () => void;
};

export function WelcomeModal({ visible, businessName, onGuide, onSkip }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 32,
            marginHorizontal: 16,
            marginBottom: 24,
            paddingHorizontal: 24,
            paddingTop: 0,
            paddingBottom: 28,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 24,
            elevation: 16,
            alignItems: 'center',
          }}
        >
          {/* Character image */}
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 34,
              overflow: 'hidden',
              marginTop: -34,
              borderWidth: 3,
              borderColor: '#ffffff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 8,
              backgroundColor: '#f0fdf4',
            }}
          >
            <Image
              source={require('../../../assets/tutorial_character.png')}
              style={{ width: 68, height: 68 }}
              resizeMode="cover"
            />
          </View>

          {/* Heading */}
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: '#14532d',
              textAlign: 'center',
              marginTop: 16,
              letterSpacing: -0.5,
            }}
          >
            Welcome to MarginIQ!
          </Text>

          {/* Subtext */}
          <Text
            style={{
              fontSize: 14,
              color: '#475569',
              fontWeight: '500',
              textAlign: 'center',
              marginTop: 8,
              marginBottom: 24,
              lineHeight: 21,
            }}
          >
            I'm here to help you get started with {businessName}.{'\n'}Are you new to MarginIQ?
          </Text>

          {/* Option cards */}
          <Pressable onPress={onGuide} style={{ width: '100%', marginBottom: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: '#bbf7d0',
                backgroundColor: '#f0fdf4',
                paddingHorizontal: 20,
                paddingVertical: 18,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#14532d',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ionicons name="school" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#14532d', marginBottom: 2 }}>
                  Yes, guide me through!
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500' }}>
                  I'll walk you through the app step by step
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable onPress={onSkip} style={{ width: '100%' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: '#e2e8f0',
                backgroundColor: '#f8fafc',
                paddingHorizontal: 20,
                paddingVertical: 18,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#64748b',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ionicons name="rocket" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#334155', marginBottom: 2 }}>
                  No, I know the app
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500' }}>
                  Jump straight to the dashboard
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
