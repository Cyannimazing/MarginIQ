import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackActions } from '@react-navigation/native';
import { useUIStore } from '../stores/uiStore';
import { navigationRef, safeNavigate } from '../navigation/navigationService';

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  activeIcon?: string;
  route?: string;
};

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  currentView: 'active' | 'archived' | 'trash';
  onSelectView: (view: 'active' | 'archived' | 'trash') => void;
};

export function Sidebar({ isOpen, onClose, currentView, onSelectView }: SidebarProps) {
  const currentRouteName = useUIStore((state) => state.currentRoute);

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen]);

  const menuItems: MenuItem[] = [
    { id: 'active', label: 'Products', icon: 'cube-outline', activeIcon: 'cube' },
    { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
    { id: 'settings', label: 'Business Profile', icon: 'business-outline', activeIcon: 'business' },
    { id: 'resources', label: 'Resources Library', icon: 'library-outline', activeIcon: 'library', route: 'ResourcesLibrary' },
    { id: 'archived', label: 'Archive', icon: 'archive-outline', activeIcon: 'archive' },
    { id: 'trash', label: 'Trash', icon: 'trash-outline', activeIcon: 'trash' },
  ];

  const secondaryItems: MenuItem[] = [
    { id: 'help', label: 'Help & Support', icon: 'help-circle-outline' },
    { id: 'feedback', label: 'Send Feedback', icon: 'chatbox-ellipses-outline' },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View
        style={[s.backdrop, { opacity: opacityAnim }]}
      >
        <Pressable onPress={onClose} style={s.flex1} />
      </Animated.View>

      {/* Sidebar Content */}
      <Animated.View
        style={[
          s.sidebarContent,
          {
            width: SIDEBAR_WIDTH,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        <View style={s.header}>
          <Image
            source={require('../../assets/BLACK-LOGO.png')}
            style={s.logoImage}
            resizeMode="contain"
          />
          <Text style={s.logoName}>MarginIQ</Text>
        </View>

        <ScrollView style={s.menuContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <Text style={s.sectionLabel}>Collection</Text>
          {menuItems.map((item) => {
            const isActive = 
              (item.id.toLowerCase() === 'analytics' && currentRouteName.toLowerCase() === 'analytics') ||
              (item.id.toLowerCase() === 'settings' && currentRouteName.toLowerCase() === 'settings') ||
              (item.id.toLowerCase() === 'resources' && currentRouteName === 'ResourcesLibrary') ||
              (item.id.toLowerCase() === 'trash' && currentRouteName.toLowerCase() === 'trash') ||
              (currentRouteName === 'Dashboard' && currentView === item.id);

            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.id === 'settings') {
                    safeNavigate('Settings');
                    onClose();
                  } else if (item.id === 'analytics') {
                    safeNavigate('Analytics');
                    onClose();
                  } else if (item.route === 'ResourcesLibrary') {
                    safeNavigate('ResourcesLibrary');
                    onClose();
                  } else {
                    onSelectView(item.id as any);
                    if (navigationRef.getCurrentRoute()?.name !== 'Dashboard') {
                      safeNavigate('Dashboard');
                    }
                    onClose();
                  }
                }}
              >
                <View style={[s.menuItem, isActive && s.menuItemActive]}>
                  <Ionicons
                    name={(isActive ? item.activeIcon : item.icon) as any}
                    size={22}
                    color={isActive ? 'white' : '#166534'}
                  />
                  <Text style={[s.menuItemText, isActive && s.menuItemTextActive]}>
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <View style={s.divider} />

          <Text style={s.sectionLabel}>System</Text>
          {secondaryItems.map((item) => {
            const isActive = item.route ? currentRouteName === item.route : false;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.route) {
                    safeNavigate(item.route);
                    onClose();
                  }
                }}
              >
                <View style={[s.menuItem, isActive && s.menuItemActive]}>
                  <Ionicons
                    name={item.icon as any}
                    size={22}
                    color={isActive ? 'white' : '#166534'}
                  />
                  <Text style={[s.menuItemText, isActive && s.menuItemTextActive]}>
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.versionText}>v1.0.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}
const s = StyleSheet.create({
  flex1: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sidebarContent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 24,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  logoName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#14532d',
    letterSpacing: -1,
  },
  logoSubtitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8', // slate-400
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 2,
  },
  menuContainer: {
    padding: 16,
    flex: 1,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    fontSize: 10,
    fontWeight: '900',
    color: '#166534', // brand-800
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 32,
    marginBottom: 4,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  menuItemActive: {
    backgroundColor: '#14532d', // brand-900
    borderRadius: 32,
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItemText: {
    marginLeft: 16,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#166534', // brand-800
  },
  menuItemTextActive: {
    fontWeight: '900',
    color: '#ffffff',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 24,
    marginHorizontal: 16,
  },
  footer: {
    marginTop: 'auto',
    padding: 32,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
