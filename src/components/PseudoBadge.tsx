// src/components/PseudoBadge.tsx
// ═══════════════════════════════════════════════════════════════
//  Badge pseudo cliquable — modale de modification inline
//  Utilisable dans TOUS les écrans sans changer de page
// ═══════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Modal, Animated, Easing, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';

type Props = {
  pseudo:          string;
  onPseudoChange?:  (nouveauPseudo: string) => void;
  /** Style compact pour les headers avec peu d'espace */
  compact?:        boolean;
};

export const PseudoBadge: React.FC<Props> = ({ pseudo, onPseudoChange, compact = false }) => {
  const [modaleVisible, setModaleVisible] = useState(false);
  const [saisie,        setSaisie]        = useState('');
  const [erreur,        setErreur]        = useState('');
  const [focused,       setFocused]       = useState(false);

  // Animations modale
  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const btnScale    = useRef(new Animated.Value(1)).current;

  // Animation badge au tap
  const badgeScale  = useRef(new Animated.Value(1)).current;

  const ouvrirModale = () => {
    setSaisie(pseudo);
    setErreur('');
    setModaleVisible(true);
  };

  const fermerModale = () => {
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 0.88, duration: 160, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,    duration: 160, useNativeDriver: true }),
    ]).start(() => setModaleVisible(false));
  };

  useEffect(() => {
    if (modaleVisible) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [modaleVisible]);

  const shake = () => Animated.sequence([
    Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 6,   duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
  ]).start();

  const onBadgePressIn  = () => Animated.spring(badgeScale, { toValue: 0.93, friction: 8, useNativeDriver: true }).start();
  const onBadgePressOut = () => Animated.spring(badgeScale, { toValue: 1,    friction: 6, useNativeDriver: true }).start();

  const handleConfirmer = () => {
    const t = saisie.trim();
    if (!t)           { setErreur('Le pseudo est requis');   shake(); return; }
    if (t.length < 3) { setErreur('Minimum 3 caractères');  shake(); return; }
    if (t.length > 15){ setErreur('Maximum 15 caractères'); shake(); return; }
    if (t === pseudo) { fermerModale(); return; } // Rien changé

    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start(() => {
      onPseudoChange?.(t);
      fermerModale();
    });
  };

  const charPct      = Math.min(saisie.length / 15, 1);
  const validLength  = saisie.trim().length >= 3;
  const aChange      = saisie.trim() !== pseudo;

  return (
    <>
      {/* ── Badge cliquable ── */}
      <TouchableOpacity
        onPress={ouvrirModale}
        onPressIn={onBadgePressIn}
        onPressOut={onBadgePressOut}
        activeOpacity={1}
      >
        <Animated.View style={{ transform: [{ scale: badgeScale }] }}>
          <LinearGradient
            colors={[C.goldBg, '#221500']}
            style={[S.badge, compact && S.badgeCompact]}
          >
            <Text style={[S.badgeIcon, compact && S.badgeIconCompact]}>👤</Text>
            <Text style={[S.badgePseudo, compact && S.badgePseudoCompact]} numberOfLines={1}>
              {pseudo}
            </Text>
            <Text style={S.badgeEdit}>✎</Text>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>

      {/* ── Modale de modification ── */}
      <Modal
        transparent
        animationType="none"
        visible={modaleVisible}
        onRequestClose={fermerModale}
        statusBarTranslucent
      >
        <Animated.View style={[S.overlay, { opacity: opacityAnim }]}>
          <Animated.View style={[S.modaleWrap, { transform: [{ scale: scaleAnim }] }]}>

            {/* Barre accent dorée */}
            <LinearGradient
              colors={[C.goldDark, C.gold]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={S.accentBar}
            />

            <View style={S.modaleBody}>
              {/* Icône */}
              <View style={S.iconCircle}>
                <Text style={S.iconEmoji}>👤</Text>
              </View>

              <Text style={S.modaleTitre}>Modifier le pseudo</Text>
              <Text style={S.modaleSub}>Nouveau nom visible par tous les joueurs</Text>

              {/* Champ de saisie */}
              <View style={S.inputSection}>
                <View style={S.inputLabelRow}>
                  <Text style={S.inputLabel}>NOUVEAU PSEUDO</Text>
                  <Text style={[S.charCount, {
                    color: charPct >= 1 ? C.amber : charPct >= 0.2 ? C.textBody : C.textHint,
                  }]}>
                    {saisie.length} / 15
                  </Text>
                </View>

                <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                  <View style={[S.inputWrapper, focused && S.inputFocused, !!erreur && S.inputError]}>
                    <Text style={S.inputIcon}>✎</Text>
                    <TextInput
                      style={S.input}
                      value={saisie}
                      onChangeText={t => { setSaisie(t); setErreur(''); }}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder={pseudo}
                      placeholderTextColor={C.textHint}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={15}
                      returnKeyType="done"
                      onSubmitEditing={handleConfirmer}
                      autoFocus
                    />
                  </View>
                </Animated.View>

                {/* Barre de progression */}
                <View style={S.progressTrack}>
                  <View style={[S.progressFill, {
                    width: `${charPct * 100}%` as any,
                    backgroundColor: charPct < 0.2 ? C.red : charPct < 0.55 ? C.amber : C.green,
                  }]} />
                </View>

                {/* Feedback */}
                {erreur ? (
                  <View style={S.feedbackRow}>
                    <View style={S.dotError} />
                    <Text style={S.erreurText}>{erreur}</Text>
                  </View>
                ) : aChange && validLength ? (
                  <View style={S.feedbackRow}>
                    <View style={S.dotOk} />
                    <Text style={S.okText}>
                      {pseudo} → <Text style={{ color: C.gold, fontWeight: '800' }}>{saisie.trim()}</Text>
                    </Text>
                  </View>
                ) : (
                  <View style={S.feedbackRow}>
                    <View style={S.dotInfo} />
                    <Text style={S.infoText}>Entre 3 et 15 caractères</Text>
                  </View>
                )}
              </View>

              {/* Boutons */}
              <View style={S.btnsRow}>
                {/* Annuler */}
                <TouchableOpacity onPress={fermerModale} style={S.btnAnnuler} activeOpacity={0.75}>
                  <Text style={S.btnAnnulerText}>Annuler</Text>
                </TouchableOpacity>

                {/* Confirmer */}
                <Animated.View style={[{ flex: 1 }, { transform: [{ scale: btnScale }] }]}>
                  <TouchableOpacity
                    onPress={handleConfirmer}
                    activeOpacity={0.85}
                    disabled={!validLength}
                  >
                    <LinearGradient
                      colors={validLength && aChange
                        ? [C.goldDark, C.gold]
                        : [C.bgCardLit, C.bgCard]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={S.btnConfirmer}
                    >
                      <Text style={[S.btnConfirmerText,
                        !(validLength && aChange) && { color: C.textHint }
                      ]}>
                        {aChange ? 'Confirmer ✓' : 'Inchangé'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

const S = StyleSheet.create({
  // Badge
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 22, borderWidth: 1, borderColor: C.goldDark,
  },
  badgeCompact: { paddingHorizontal: 10, paddingVertical: 6 },
  badgeIcon:    { fontSize: 14 },
  badgeIconCompact: { fontSize: 12 },
  badgePseudo:  { color: C.gold, fontSize: 13, fontWeight: '800', maxWidth: 90 },
  badgePseudoCompact: { fontSize: 12, maxWidth: 72 },
  badgeEdit:    { color: C.goldDark, fontSize: 12, opacity: 0.8 },

  // Overlay
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center', alignItems: 'center',
    padding: 22,
    paddingTop: Platform.OS === 'ios' ? 60 : 22,
  },
  modaleWrap: {
    width: '100%', borderRadius: 26, overflow: 'hidden',
    borderWidth: 1, borderColor: C.borderLit,
    shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 28, elevation: 24,
  },
  accentBar: { height: 4 },
  modaleBody: { backgroundColor: C.bgCard, padding: 26 },

  // Icône
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, borderWidth: 1, borderColor: C.goldDark, alignSelf: 'center',
  },
  iconEmoji: { fontSize: 28 },

  modaleTitre: {
    color: C.textPrimary, fontSize: 22, fontWeight: '900',
    letterSpacing: 0.5, marginBottom: 6, textAlign: 'center',
  },
  modaleSub: {
    color: C.textBody, fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },

  // Input
  inputSection: { marginBottom: 20 },
  inputLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  inputLabel: { color: C.textSecond, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  charCount:  { fontSize: 12, fontWeight: '700' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bgCardLit, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 16, marginBottom: 10,
  },
  inputFocused: { borderColor: C.gold },
  inputError:   { borderColor: C.red },
  inputIcon:    { fontSize: 16, color: C.textSecond, marginRight: 10 },
  input: {
    flex: 1, paddingVertical: 16,
    color: C.textPrimary, fontSize: 18, fontWeight: '800',
  },
  progressTrack: {
    height: 3, backgroundColor: C.border,
    borderRadius: 2, overflow: 'hidden', marginBottom: 10,
  },
  progressFill: { height: 3, borderRadius: 2 },
  feedbackRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dotError: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red },
  dotOk:    { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  dotInfo:  { width: 7, height: 7, borderRadius: 4, backgroundColor: C.textHint },
  erreurText: { color: C.red,      fontSize: 13, fontWeight: '700' },
  okText:     { color: C.textBody, fontSize: 13, fontWeight: '500' },
  infoText:   { color: C.textHint, fontSize: 13 },

  // Boutons
  btnsRow: { flexDirection: 'row', gap: 10 },
  btnAnnuler: {
    flex: 1, backgroundColor: C.bgCardLit, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  btnAnnulerText: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  btnConfirmer:   { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnConfirmerText: { color: C.bgDeep, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
});

export default PseudoBadge;