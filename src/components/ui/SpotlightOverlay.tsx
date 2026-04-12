import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';

const CHARACTER = require('../../../assets/tutorial_character.png');

export type SpotlightHole = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  hole?: SpotlightHole | null;
  message: string;
  onSkip: () => void;
  autoExit?: boolean;
  textHideDelayMs?: number;
  avatarFadeDelayMs?: number;
  avatarFadeDurationMs?: number;
  onAutoExitComplete?: () => void;
};

const TYPEWRITER_SPEED = 30;
const AVATAR_SIZE = 68;
const MARGIN = 8;


export function SpotlightOverlay({
  message,
  onSkip,
  autoExit = false,
  textHideDelayMs = 2500,
  avatarFadeDelayMs = 1000,
  avatarFadeDurationMs = 900,
  onAutoExitComplete,
}: Props) {
  const { width: sw, height: sh } = Dimensions.get('window');

  const [displayed, setDisplayed] = useState('');
  const [canType, setCanType] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [bubblePointerEvents, setBubblePointerEvents] = useState<'auto' | 'none'>('auto');

  const avatarScale = useSharedValue(0);
  const avatarOpacity = useSharedValue(0);
  const bubbleOpacity = useSharedValue(0);
  const posX = useSharedValue(MARGIN);
  const posY = useSharedValue(4);
  const sideVal = useSharedValue(0);

  const startX = useRef(MARGIN);
  const startY = useRef(4);
  const bubbleOpenRef = useRef(true);

  // ── Bubble show / hide ──────────────────────────────────────────────
  const showBubble = () => {
    bubbleOpenRef.current = true;
    setBubblePointerEvents('auto');
    bubbleOpacity.value = withTiming(1, { duration: 250 });
  };

  const hideBubble = () => {
    bubbleOpenRef.current = false;
    bubbleOpacity.value = withTiming(0, { duration: 200 }, (done) => {
      'worklet';
      if (done) runOnJS(setBubblePointerEvents)('none');
    });
  };

  const toggleBubble = () => {
    if (bubbleOpenRef.current) hideBubble();
    else showBubble();
  };

  // ── PanResponder ────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        cancelAnimation(posX);
        cancelAnimation(posY);
        startX.current = posX.value;
        startY.current = posY.value;
      },
      onPanResponderMove: (_, gs) => {
        posX.value = Math.max(MARGIN, Math.min(startX.current + gs.dx, sw - AVATAR_SIZE - MARGIN));
        posY.value = Math.max(MARGIN, Math.min(startY.current + gs.dy, sh - AVATAR_SIZE - MARGIN));
      },
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
          toggleBubble();
          return;
        }
        const goRight = posX.value > sw / 2;
        const snapX = goRight ? sw - AVATAR_SIZE - MARGIN : MARGIN;
        posX.value = withSpring(snapX, { damping: 18, stiffness: 200 });
        sideVal.value = goRight ? 1 : 0;
        runOnJS(setSide)(goRight ? 'right' : 'left');
      },
    }),
  ).current;

  // ── Animated styles ─────────────────────────────────────────────────

  // Container spans from avatar to opposite screen edge
  const containerStyle = useAnimatedStyle(() => {
    if (sideVal.value === 0) {
      // avatar on left → row extends to right screen edge
      return { left: posX.value, right: MARGIN, top: posY.value };
    }
    // avatar on right → row extends to left screen edge
    return { left: MARGIN, right: sw - posX.value - AVATAR_SIZE, top: posY.value };
  });

  const avatarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
    opacity: avatarOpacity.value,
  }));

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
  }));

  // ── Intro animation on new message ──────────────────────────────────
  // Reset position only on mount
  useEffect(() => {
    posX.value = MARGIN;
    posY.value = 4;
    sideVal.value = 0;
    startX.current = MARGIN;
    startY.current = 4;
    setSide('left');
  }, []);

  // Restart text + animation on every new message
  useEffect(() => {
    setDisplayed('');
    setCanType(false);
    setBubblePointerEvents('auto');
    bubbleOpenRef.current = true;

    avatarScale.value = 0;
    avatarOpacity.value = 0;
    bubbleOpacity.value = 0;

    avatarScale.value = withSpring(1, { damping: 10, stiffness: 160 });
    avatarOpacity.value = withTiming(1, { duration: 450 }, (finished) => {
      'worklet';
      if (finished) {
        bubbleOpacity.value = withTiming(1, { duration: 250 });
        runOnJS(setCanType)(true);
      }
    });
  }, [message]);

  // ── Typewriter + auto-hide ──────────────────────────────────────────
  useEffect(() => {
    if (!canType) return;
    let i = 0;
    let hideTimer: ReturnType<typeof setTimeout>;
    let avatarDelayTimer: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      i++;
      setDisplayed(message.slice(0, i));
      if (i >= message.length) {
        clearInterval(interval);
        hideTimer = setTimeout(() => {
          hideBubble();
          if (autoExit) {
            avatarDelayTimer = setTimeout(() => {
              avatarOpacity.value = withTiming(0, { duration: avatarFadeDurationMs }, (done) => {
                'worklet';
                if (done && onAutoExitComplete) {
                  runOnJS(onAutoExitComplete)();
                }
              });
              avatarScale.value = withTiming(0.9, { duration: avatarFadeDurationMs });
            }, avatarFadeDelayMs);
          }
        }, textHideDelayMs);
      }
    }, TYPEWRITER_SPEED);
    return () => {
      clearInterval(interval);
      clearTimeout(hideTimer);
      clearTimeout(avatarDelayTimer);
    };
  }, [
    canType,
    message,
    autoExit,
    textHideDelayMs,
    avatarFadeDelayMs,
    avatarFadeDurationMs,
  ]);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.container,
          containerStyle,
          { flexDirection: side === 'left' ? 'row' : 'row-reverse' },
        ]}
        pointerEvents="box-none"
      >
        {/* Avatar — drag handle */}
        <Animated.View
          style={[styles.avatarWrapper, avatarAnimStyle]}
          {...panResponder.panHandlers}
        >
          <Image source={CHARACTER} style={styles.avatar} resizeMode="cover" />
        </Animated.View>

        <View style={{ width: 10 }} />

        {/* Bubble — always mounted, fills remaining space */}
        <Animated.View
          style={[styles.bubble, bubbleAnimStyle]}
          pointerEvents={bubblePointerEvents}
        >
          {side === 'left'
            ? <View style={styles.tailLeft} />
            : <View style={styles.tailRight} />
          }
          <Text style={styles.bubbleText}>{displayed}</Text>
          <Pressable onPress={onSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#dcfce7',
    borderWidth: 3,
    borderColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    flexShrink: 0,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  bubble: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  tailLeft: {
    position: 'absolute',
    left: -9,
    top: 20,
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#ffffff',
  },
  tailRight: {
    position: 'absolute',
    right: -9,
    top: 20,
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#ffffff',
  },
  bubbleText: {
    color: '#14532d',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    minHeight: 40,
  },
  skipBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#14532d',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  skipText: {
    color: '#14532d',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
