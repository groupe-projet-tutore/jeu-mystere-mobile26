// src/screens/PseudoScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, Dimensions, StatusBar, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';

const { width: W } = Dimensions.get('window');

type Props = { onValidPseudo: (pseudo: string) => void };

export const PseudoScreen: React.FC<Props> = ({ onValidPseudo }) => {
  const [pseudo,  setPseudo]  = useState('');
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(32)).current;
  const logoScale  = useRef(new Animated.Value(0.8)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0.4)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.timing(logoRotate, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true })).start();

    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  const shakeInput = () => Animated.sequence([
    Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 6,   duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
  ]).start();

  const handleSubmit = () => {
    const t = pseudo.trim();
    if (!t)           { setError('Le pseudo est requis');   shakeInput(); return; }
    if (t.length < 3) { setError('Minimum 3 caractères');  shakeInput(); return; }
    if (t.length > 15){ setError('Maximum 15 caractères'); shakeInput(); return; }
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start(() => onValidPseudo(t));
  };

  const spin        = logoRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const validLength = pseudo.trim().length >= 3;
  const charPct     = Math.min(pseudo.length / 15, 1);
  const charColor   = charPct >= 1 ? C.amber : charPct >= 0.2 ? C.textBody : C.textHint;

  return (
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={[C.bgDeep, C.bg, '#0d1628']} style={StyleSheet.absoluteFill} />

      {/* Déco fond */}
      <Animated.View style={[S.bgGlow, { opacity: glowAnim }]} />

      <Animated.View style={[S.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Logo ── */}
        <View style={S.logoSection}>
          <Animated.View style={[S.logoRing, { transform: [{ rotate: spin }] }]} />
          <Animated.View style={[S.logoGlow, { opacity: glowAnim }]} />
          <Animated.View style={{ transform: [{ scale: logoScale }] }}>
            <LinearGradient colors={[C.goldDark, C.gold, C.goldLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.logoCircle}>
              <LinearGradient colors={[C.bgDeep, C.bgCard]} style={S.logoInner}>
                <Text style={S.logoEmoji}>🎯</Text>
              </LinearGradient>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* ── Titre ── */}
        <View style={S.titleSection}>
          <Text style={S.titleEye}>LE JEU DE DÉDUCTION</Text>
          <Text style={S.titleMain}>Nombre Mystère</Text>
          <Text style={S.titleSub}>Devine le nombre caché avant la fin du chrono</Text>
        </View>

        {/* ── Card input ── */}
        <View style={S.card}>
          {/* Label */}
          <View style={S.inputLabelRow}>
            <Text style={S.inputLabel}>TON PSEUDO</Text>
            <Text style={[S.charCount, { color: charColor }]}>{pseudo.length} / 15</Text>
          </View>

          {/* Champ */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <View style={[S.inputWrapper, focused && S.inputFocused, !!error && S.inputError]}>
              <Text style={S.inputIcon}>👤</Text>
              <TextInput
                style={S.input}
                placeholder="Entrez votre pseudo"
                placeholderTextColor={C.textHint}
                value={pseudo}
                onChangeText={t => { setPseudo(t); setError(''); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={15}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                autoFocus
              />
            </View>
          </Animated.View>

          {/* Barre progression */}
          <View style={S.progressTrack}>
            <View style={[S.progressFill, {
              width: `${charPct * 100}%` as any,
              backgroundColor: charPct < 0.2 ? C.red : charPct < 0.55 ? C.amber : C.green,
            }]} />
          </View>

          {/* Feedback */}
          {error ? (
            <View style={S.feedbackRow}>
              <View style={S.feedbackDot_error} />
              <Text style={S.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={S.feedbackRow}>
              <View style={[S.feedbackDot_info, validLength && S.feedbackDot_ok]} />
              <Text style={S.infoText}>
                {validLength ? 'Pseudo valide ✓' : 'Entre 3 et 15 caractères'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Bouton ── */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity onPress={handleSubmit} activeOpacity={0.85} disabled={!validLength}>
            <LinearGradient
              colors={validLength ? [C.goldDark, C.gold] : [C.bgCardLit, C.bgCard]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={S.btn}
            >
              <Text style={[S.btnText, !validLength && S.btnTextDisabled]}>
                {validLength ? '▶  COMMENCER L\'AVENTURE' : 'COMMENCER L\'AVENTURE'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Modes disponibles ── */}
        <View style={S.modesRow}>
          {[{ icon: '🎯', label: 'Solo' }, { icon: '⚔️', label: 'Duel' }, { icon: '🏆', label: 'Scores' }, { icon: '👤', label: 'Profil' }].map((m, i) => (
            <View key={i} style={S.modeChip}>
              <Text style={S.modeIcon}>{m.icon}</Text>
              <Text style={S.modeLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bgGlow: {
    position: 'absolute', width: W * 1.1, height: W * 1.1,
    borderRadius: W * 0.55, backgroundColor: C.gold, opacity: 0.04,
    top: -W * 0.15, alignSelf: 'center',
  },
  content: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 32,
  },

  // Logo
  logoSection: { alignItems: 'center', marginBottom: 28 },
  logoRing: {
    position: 'absolute', width: 118, height: 118, borderRadius: 59,
    borderWidth: 1.5, borderColor: C.gold, borderStyle: 'dashed', opacity: 0.4,
  },
  logoGlow: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: C.gold, opacity: 0.08,
  },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48, padding: 3,
    shadowColor: C.gold, shadowOpacity: 0.6, shadowRadius: 22, elevation: 18,
  },
  logoInner: { flex: 1, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 44 },

  // Titre
  titleSection: { alignItems: 'center', marginBottom: 30 },
  titleEye: {
    fontSize: 11, fontWeight: '800', letterSpacing: 4,
    color: C.textSecond, marginBottom: 6,
  },
  titleMain: {
    fontSize: 30, fontWeight: '900', color: C.textPrimary,
    letterSpacing: 1, marginBottom: 10,
  },
  titleSub: {
    fontSize: 15, color: C.textBody, textAlign: 'center', lineHeight: 22,
  },

  // Card
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 20,
  },
  inputLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  inputLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 2, color: C.textSecond },
  charCount: { fontSize: 13, fontWeight: '700' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bgCardLit, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 16, marginBottom: 12,
  },
  inputFocused: { borderColor: C.gold },
  inputError:   { borderColor: C.red },
  inputIcon:    { fontSize: 18, marginRight: 12, opacity: 0.7 },
  input: {
    flex: 1, paddingVertical: 16,
    color: C.textPrimary, fontSize: 18, fontWeight: '700',
  },
  progressTrack: {
    height: 4, backgroundColor: C.border,
    borderRadius: 2, overflow: 'hidden', marginBottom: 12,
  },
  progressFill: { height: 4, borderRadius: 2 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackDot_error: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  feedbackDot_info:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.textHint },
  feedbackDot_ok:    { backgroundColor: C.green },
  errorText: { fontSize: 14, fontWeight: '700', color: C.red },
  infoText:  { fontSize: 14, fontWeight: '500', color: C.textBody },

  // Bouton
  btn: {
    borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', marginBottom: 24,
    shadowColor: C.gold, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  btnText: { fontSize: 16, fontWeight: '900', color: C.bgDeep, letterSpacing: 1.5 },
  btnTextDisabled: { color: C.textHint },

  // Modes
  modesRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.bgCard, borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: C.border,
  },
  modeIcon:  { fontSize: 14 },
  modeLabel: { fontSize: 13, color: C.textBody, fontWeight: '600' },
});

export default PseudoScreen;