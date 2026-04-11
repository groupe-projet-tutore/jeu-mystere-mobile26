// src/screens/SplashScreen.tsx
// ⚠️  Si expo-splash-screen est installé dans ton projet, renomme ce fichier
//     en IntroScreen.tsx et adapte l'import dans App.tsx en conséquence.
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';

const { width: W } = Dimensions.get('window');

type Props = { onFinish: () => void };

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const logoScale    = useRef(new Animated.Value(0)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const ringRotate   = useRef(new Animated.Value(0)).current;
  const ringScale    = useRef(new Animated.Value(0.6)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide   = useRef(new Animated.Value(20)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0.3)).current;
  const barWidth     = useRef(new Animated.Value(0)).current;
  const barOpacity   = useRef(new Animated.Value(0)).current;
  const exitOpacity  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // ── Séquence totale ≈ 3 secondes ──
    Animated.sequence([
      // 1. Logo + ring bounce (0–600ms)
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(ringScale,   { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
      // 2. Titre slide-in (600–950ms)
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleSlide,   { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      // 3. Tagline + barre fade-in (950–1200ms)
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(barOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
      // 4. Barre se remplit (1200–4800ms)
      Animated.timing(barWidth, {
        toValue: 1, duration: 3600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,   // ← obligatoire pour les layouts
      }),
      // 5. Pause 200ms
      Animated.delay(200),
      // 6. Fade-out global (400ms) → total ≈ 5 000ms
      Animated.timing(exitOpacity, {
        toValue: 0, duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());   // ← déclenche la suite dans App.tsx

    // Ring tourne en continu (indépendant de la séquence)
    Animated.loop(
      Animated.timing(ringRotate, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  const spin = ringRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    // ✅ flex:1 + backgroundColor garantissent le plein écran
    <Animated.View style={[S.root, { opacity: exitOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={[C.bgDeep, C.bg, '#0d1628']} style={StyleSheet.absoluteFill} />

      {/* Halo de fond */}
      <Animated.View style={[S.bgGlow, { opacity: glowAnim }]} />

      {/* ── Contenu centré ── */}
      <View style={S.center}>

        {/* Logo */}
        <Animated.View style={[S.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Animated.View style={[S.ringOuter, { transform: [{ rotate: spin }, { scale: ringScale }] }]} />
          <Animated.View style={[S.ringInner, { transform: [{ rotate: spin }] }]} />
          <Animated.View style={[S.logoHalo, { opacity: glowAnim }]} />
          <LinearGradient
            colors={[C.goldDark, C.gold, C.goldLight]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={S.logoCircle}
          >
            <LinearGradient colors={[C.bgDeep, '#0d1628']} style={S.logoInner}>
              <Text style={S.logoEmoji}>🎯</Text>
            </LinearGradient>
          </LinearGradient>
        </Animated.View>

        {/* Titre */}
        <Animated.View style={[S.titleWrap, { opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
          <Text style={S.titleEye}>LE JEU DE MYSTÈRE</Text>
          <View style={S.titleRow}>
            <View style={S.titleLine} />
            <Text style={S.titleGold}>NOMBRE MYSTÈRE</Text>
            <View style={S.titleLine} />
          </View>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[S.tagline, { opacity: tagOpacity }]}>
          Devine · Défie · Domine
        </Animated.Text>

        {/* Barre de chargement */}
        <Animated.View style={[S.barWrap, { opacity: barOpacity }]}>
          <View style={S.barTrack}>
            <Animated.View style={[S.barFill, {
              width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>
          <Text style={S.barLabel}>Chargement en cours...</Text>
        </Animated.View>

      </View>

      {/* Version */}
      <Animated.Text style={[S.version, { opacity: tagOpacity }]}>v1.0.0</Animated.Text>
    </Animated.View>
  );
};

const S = StyleSheet.create({
  // ✅ flex:1 + backgroundColor pour couvrir tout l'écran sans SafeAreaView
  root: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgGlow: {
    position: 'absolute',
    width: W * 1.3, height: W * 1.3, borderRadius: W * 0.65,
    backgroundColor: C.gold, opacity: 0.05,
    top: -W * 0.25, alignSelf: 'center',
  },
  center: { alignItems: 'center', paddingHorizontal: 40 },

  // Logo
  logoWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  ringOuter: {
    position: 'absolute', width: 168, height: 168, borderRadius: 84,
    borderWidth: 1.5, borderColor: C.gold, borderStyle: 'dashed', opacity: 0.4,
  },
  ringInner: {
    position: 'absolute', width: 134, height: 134, borderRadius: 67,
    borderWidth: 1, borderColor: C.goldLight, opacity: 0.2,
  },
  logoHalo: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: C.gold, opacity: 0.1,
  },
  logoCircle: {
    width: 112, height: 112, borderRadius: 56, padding: 4,
    shadowColor: C.gold, shadowOpacity: 0.75, shadowRadius: 30, elevation: 22,
  },
  logoInner: { flex: 1, borderRadius: 53, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 54 },

  // Titre
  titleWrap: { alignItems: 'center', marginBottom: 14 },
  titleEye: {
    fontSize: 12, fontWeight: '700', letterSpacing: 5,
    color: C.textSecond, marginBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleLine: { flex: 1, height: 2, backgroundColor: C.gold, opacity: 0.55, borderRadius: 1 },
  titleGold: {
    fontSize: 26, fontWeight: '900', letterSpacing: 3, color: C.gold,
    textShadowColor: C.gold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },

  // Tagline
  tagline: {
    fontSize: 16, color: C.textBody, letterSpacing: 3,
    fontWeight: '500', marginBottom: 56,
  },

  // Barre progression
  barWrap: { width: W * 0.62, alignItems: 'center', gap: 10 },
  barTrack: {
    width: '100%', height: 5, backgroundColor: C.border,
    borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3, backgroundColor: C.gold },
  barLabel: { fontSize: 13, color: C.textSecond, letterSpacing: 1.5, fontWeight: '600' },

  // Version
  version: {
    position: 'absolute', bottom: 40,
    fontSize: 12, color: C.textHint, letterSpacing: 2, fontWeight: '600',
  },
});

export default SplashScreen;