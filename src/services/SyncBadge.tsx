// src/components/SyncBadge.tsx
// ═══════════════════════════════════════════════════════
//  Indicateur visuel du statut de synchronisation
//  À placer dans le header de MondeSolo ou MenuPrincipal
// ═══════════════════════════════════════════════════════
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { C } from '../styles/theme';
import type { StatutConnexion } from '../services/syncService';

type Props = {
  statut:          StatutConnexion;
  scoresEnAttente: number;
  onReessayer?:    () => void;
};

export const SyncBadge: React.FC<Props> = ({ statut, scoresEnAttente, onReessayer }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;

  // Pulse quand hors ligne avec scores en attente
  useEffect(() => {
    if (statut === 'hors_ligne' && scoresEnAttente > 0) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [statut, scoresEnAttente]);

  // Rotation quand sync en cours
  useEffect(() => {
    if (statut === 'sync_en_cours') {
      const loop = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      );
      loop.start();
      return () => { loop.stop(); spinAnim.setValue(0); };
    }
  }, [statut]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Connecté sans attente → rien à afficher
  if (statut === 'connecte' && scoresEnAttente === 0) return null;

  const config = {
    connecte:       { bg: C.greenBg,  border: C.green,   dot: C.green,  label: 'Synchronisé' },
    hors_ligne:     { bg: C.redBg,    border: C.redDark, dot: C.red,    label: scoresEnAttente > 0 ? `${scoresEnAttente} en attente` : 'Hors ligne' },
    sync_en_cours:  { bg: C.blueBg,   border: C.blue,    dot: C.blue,   label: 'Sync...' },
  }[statut];

  return (
    <TouchableOpacity
      onPress={statut === 'hors_ligne' ? onReessayer : undefined}
      activeOpacity={statut === 'hors_ligne' ? 0.75 : 1}
      disabled={statut !== 'hors_ligne'}
    >
      <Animated.View style={[S.badge, { backgroundColor: config.bg, borderColor: config.border, opacity: pulseAnim }]}>

        {/* Indicateur / spinner */}
        {statut === 'sync_en_cours' ? (
          <Animated.Text style={[S.spinner, { transform: [{ rotate: spin }] }]}>⟳</Animated.Text>
        ) : (
          <View style={[S.dot, { backgroundColor: config.dot }]} />
        )}

        {/* Label */}
        <Text style={[S.label, { color: config.dot }]}>{config.label}</Text>

        {/* Bouton retry si hors ligne */}
        {statut === 'hors_ligne' && onReessayer && (
          <Text style={S.retry}>↺</Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const S = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  dot: {
    width: 7, height: 7, borderRadius: 4,
  },
  spinner: {
    fontSize: 14, color: C.blue, fontWeight: '900',
  },
  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
  },
  retry: {
    fontSize: 13, color: C.red, fontWeight: '900', marginLeft: 2,
  },
});

export default SyncBadge;