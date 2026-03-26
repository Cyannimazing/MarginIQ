import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProductAddIngredientScreen } from '../screens/ProductAddIngredientScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { TrashScreen } from '../screens/TrashScreen';
import { ProductFormScreen } from '../screens/ProductFormScreen';
import { IngredientFormScreen } from '../screens/IngredientFormScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SalesLoggerScreen } from '../screens/SalesLoggerScreen';
import DashboardScreen from '../screens/DashboardScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MonthlyOverheadBreakdownScreen } from '../screens/MonthlyOverheadBreakdownScreen';
import { ResourcesLibraryScreen } from '../screens/ResourcesLibraryScreen';
import { useUIStore } from '../stores/uiStore';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function CustomHeader({ title, back, navigation, options, route }: any) {
  const HeaderRight = options.headerRight;
  const HeaderLeft = options.headerLeft;

  const PRIMARY_SCREENS = ['Dashboard', 'Analytics', 'Settings', 'Reports', 'Trash'];
  const isPrimary = PRIMARY_SCREENS.includes(route.name);

  return (
    <SafeAreaView edges={['top']} className="bg-white border-b border-slate-100">
      <View className="px-6 h-14 flex-row items-center justify-center relative">
        <View className="absolute left-6 z-10">
          {HeaderLeft ? (
            <HeaderLeft canGoBack={!!back} />
          ) : !isPrimary && back ? (
            <Pressable
              onPress={() => navigation.goBack()}
              className="h-10 w-10 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={24} color="#166534" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => useUIStore.getState().setSidebarOpen(true)}
              className="h-10 w-10 items-center justify-center"
            >
              <Ionicons name="menu" size={28} color="#166534" />
            </Pressable>
          )}
        </View>
        
        <Text className="text-[11px] font-black text-brand-900 uppercase tracking-[3px] text-center">
          {title}
        </Text>

        <View className="absolute right-6 z-10">
          {HeaderRight && <HeaderRight />}
        </View>
      </View>
    </SafeAreaView>
  );
}



type RootNavigatorProps = {
  onboardingCompleted: boolean;
};

export function RootNavigator({ onboardingCompleted }: RootNavigatorProps) {
  return (
    <Stack.Navigator
      key={onboardingCompleted ? 'app' : 'onboarding'}
      initialRouteName={onboardingCompleted ? 'Dashboard' : 'Onboarding'}
      screenOptions={{
        animation: 'fade',
        freezeOnBlur: true,
        header: ({ navigation, route, options, back }) => (
          <CustomHeader title={options.title !== undefined ? options.title : route.name} back={back} navigation={navigation} options={options} route={route} />
        )
      }}
    >
      {/* Onboarding — first-time only */}
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />

      {/* Main dashboard with sidebar */}
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Products' }}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Business Profile' }}
      />
      <Stack.Screen
        name="MonthlyOverheadBreakdown"
        component={MonthlyOverheadBreakdownScreen}
        options={{ title: 'Monthly overhead' }}
      />
      <Stack.Screen
        name="ResourcesLibrary"
        component={ResourcesLibraryScreen}
        options={{ title: 'Resources Library' }}
      />

      {/* Stack screens on top of tabs */}
      <Stack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={{ title: 'Product Setup' }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Product Detail' }}
      />
      <Stack.Screen
        name="Trash"
        component={TrashScreen}
        options={{ title: 'Trash' }}
      />
      <Stack.Screen
        name="ProductAddIngredient"
        component={ProductAddIngredientScreen}
        options={{ title: 'Compose Resources' }}
      />
      <Stack.Screen
        name="IngredientForm"
        component={IngredientFormScreen}
        options={({ route }) => ({
          title: route.params?.ingredientId ? 'Edit Resource' : 'Setup Resource',
          animation: 'none',
        })}
      />
      <Stack.Screen
        name="SalesLogger"
        component={SalesLoggerScreen}
        options={{ title: 'Log Sales' }}
      />
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reports & Export' }}
      />
    </Stack.Navigator>
  );
}
