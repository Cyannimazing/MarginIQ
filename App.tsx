import React, { useEffect, useState } from 'react';
import 'react-native-gesture-handler';
import './global.css';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useSettingsStore } from './src/stores/settingsStore';
import { useUIStore } from './src/stores/uiStore';
import { Sidebar } from './src/components/Sidebar';
import { navigationRef } from './src/navigation/navigationRef';
import { ExitConfirmModal } from './src/components/ui/ExitConfirmModal';

// Hold the native splash until settings are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const isHydrated = useSettingsStore((state) => state.isHydrated);
  const onboardingCompleted = useSettingsStore(
    (state) => state.settings.onboardingCompleted,
  );
  const [showExitModal, setShowExitModal] = useState(false);

  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const viewMode = useUIStore((state) => state.viewMode);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Hide native splash as soon as settings are ready
  useEffect(() => {
    if (isHydrated) {
      void SplashScreen.hideAsync();
    }
  }, [isHydrated]);

  useEffect(() => {
    const onBackPress = () => {
      if (navigationRef.isReady()) {
        if (!navigationRef.canGoBack()) {
          setShowExitModal(true);
          return true;
        }
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  if (!isHydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          onStateChange={() => {
            const name = navigationRef.getCurrentRoute()?.name;
            if (name) useUIStore.getState().setCurrentRoute(name);
          }}
          onReady={() => {
            const name = navigationRef.getCurrentRoute()?.name;
            if (name) useUIStore.getState().setCurrentRoute(name);
          }}
        >
          <>
            <RootNavigator onboardingCompleted={onboardingCompleted} />
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={() => useUIStore.getState().setSidebarOpen(false)}
              currentView={viewMode}
              onSelectView={(v) => {
                useUIStore.getState().setViewMode(v);
                useUIStore.getState().setActiveFilter('All');
                useUIStore.getState().setSidebarOpen(false);
              }}
            />
            <StatusBar style="dark" />
            <ExitConfirmModal
              visible={showExitModal}
              onClose={() => setShowExitModal(false)}
              onConfirm={() => BackHandler.exitApp()}
            />
          </>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
