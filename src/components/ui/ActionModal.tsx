import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';

type ActionModalProps = {
  visible: boolean;
  title: string;
  message: string;
  primaryActionText?: string;
  secondaryActionText?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  isDestructive?: boolean;
};

export function ActionModal({
  visible,
  title,
  message,
  primaryActionText = 'OK',
  secondaryActionText,
  onPrimaryAction,
  onSecondaryAction,
  isDestructive = false,
}: ActionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSecondaryAction || onPrimaryAction}
    >
      <View style={s.overlay}>
        <Pressable style={s.dismiss} onPress={onSecondaryAction || onPrimaryAction} />
        
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{message}</Text>

          <View style={s.buttonContainer}>
            {secondaryActionText && (
              <Pressable 
                onPress={onSecondaryAction}
                style={[s.button, s.buttonSecondary]}
              >
                <Text style={s.buttonTextSecondary}>{secondaryActionText}</Text>
              </Pressable>
            )}

            <Pressable 
              onPress={onPrimaryAction}
              style={[
                s.button, 
                s.buttonPrimary, 
                isDestructive ? s.buttonDestructive : null
              ]}
            >
              <Text style={s.buttonTextPrimary}>{primaryActionText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#166534', // brand-800
  },
  buttonDestructive: {
    backgroundColor: '#ef4444', // red-500
  },
  buttonSecondary: {
    backgroundColor: '#f1f5f9', // slate-100
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  buttonTextPrimary: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  buttonTextSecondary: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
