import React, { useEffect, useRef } from 'react';
import { View, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
} from 'react-native-reanimated';

const MIN_DISPLAY_MS = 2500; // minimum time the splash stays visible

type Props = {
  isReady: boolean;
  onDone: () => void;
};

export function LoadingScreen({ isReady, onDone }: Props) {
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const dot0Opacity = useSharedValue(0.3);
  const dot1Opacity = useSharedValue(0.3);
  const dot2Opacity = useSharedValue(0.3);
  const screenOpacity = useSharedValue(1);

  const startedAt = useRef(Date.now());
  const isReadyRef = useRef(false);

  const beginFadeOut = () => {
    screenOpacity.value = withDelay(200, withTiming(0, { duration: 700 }, () => {
      runOnJS(onDone)();
    }));
  };

  useEffect(() => {
    // Logo entrance — slower spring + fade
    logoScale.value = withSpring(1.0, { damping: 14, stiffness: 70 });
    logoOpacity.value = withTiming(1, { duration: 700 });

    // Title slides up — delayed, slower
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    titleY.value = withDelay(300, withTiming(0, { duration: 600 }));

    // Subtitle fades in
    subtitleOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));

    // Pulsing dots (staggered, slower pulse)
    dot0Opacity.value = withDelay(900, withRepeat(withSequence(
      withTiming(1, { duration: 550 }),
      withTiming(0.3, { duration: 550 }),
    ), -1, true));
    dot1Opacity.value = withDelay(1060, withRepeat(withSequence(
      withTiming(1, { duration: 550 }),
      withTiming(0.3, { duration: 550 }),
    ), -1, true));
    dot2Opacity.value = withDelay(1220, withRepeat(withSequence(
      withTiming(1, { duration: 550 }),
      withTiming(0.3, { duration: 550 }),
    ), -1, true));
  }, []);

  useEffect(() => {
    if (isReady) {
      isReadyRef.current = true;
      const elapsed = Date.now() - startedAt.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      const timer = setTimeout(() => {
        beginFadeOut();
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const dot0Style = useAnimatedStyle(() => ({ opacity: dot0Opacity.value }));
  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1Opacity.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2Opacity.value }));

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }, screenStyle]}>

      {/* Logo */}
      <Animated.Image
        source={require('../../../assets/ICON-MARGINIQ.png')}
        style={[{ width: 100, height: 100 }, logoStyle]}
        resizeMode="contain"
      />

      {/* Title */}
      <Animated.Text style={[{
        fontSize: 28,
        fontWeight: '900',
        color: '#14532d',
        marginTop: 20,
        letterSpacing: -0.5,
      }, titleStyle]}>
        MarginIQ
      </Animated.Text>

      {/* Subtitle */}
      <Animated.Text style={[{
        fontSize: 11,
        fontWeight: '700',
        color: '#16a34a',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginTop: 6,
      }, subtitleStyle]}>
        Product Profit Optimizer
      </Animated.Text>

      {/* Pulsing dots */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 52 }}>
        <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#14532d' }, dot0Style]} />
        <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#14532d' }, dot1Style]} />
        <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#14532d' }, dot2Style]} />
      </View>

    </Animated.View>
  );
}
