import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ExitConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ExitConfirmModal({ visible, onClose, onConfirm }: ExitConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable style={s.dismiss} onPress={onClose} />
        
        <View style={s.card}>
          <Text style={s.title}>Exit MarginIQ?</Text>
          <Text style={s.subtitle}>
            Are you sure you want to close the application? Your progress is saved.
          </Text>

          <View style={s.buttonContainer}>
            <Pressable 
              onPress={onClose}
              style={[s.button, s.buttonSecondary]}
            >
              <Text style={s.buttonTextSecondary}>Stay</Text>
            </Pressable>

            <Pressable 
              onPress={onConfirm}
              style={[s.button, s.buttonPrimary]}
            >
              <Text style={s.buttonTextPrimary}>Exit App</Text>
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
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 40,
    height: 40,
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
    backgroundColor: '#ef4444', // Red-500
  },
  buttonSecondary: {
    backgroundColor: '#f1f5f9', // Slate-100
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
