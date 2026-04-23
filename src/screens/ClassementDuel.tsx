// src/screens/ClassementDuel.tsx
// ═══════════════════════════════════════════════════════════════════════════════
//  CLASSEMENT DUEL — Version avec sélection par niveau (1,2,3,4)
//  - Chaque niveau a son propre classement
//  - Tri par nombre de victoires DESC, puis défaites ASC, puis pseudo ASC
//  - Design moderne et professionnel
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Easing, Platform, RefreshControl, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';
import { API_URL } from '../config/serveur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  onRetour: () => void;
  pseudo: string;
};

type JoueurClassement = {
  pseudo: string;
  victoires: number;
  defaites: number;
  ratio: number;
  duels_joues: number;
  meilleure_serie: number;
};

const NIVEAUX = [
  { id: 1, label: 'NIVEAU 1', intervalle: '1 - 100', icon: '🌱', color: '#4d8af0' },
  { id: 2, label: 'NIVEAU 2', intervalle: '1 - 200', icon: '🌿', color: '#9d5ff5' },
  { id: 3, label: 'NIVEAU 3', intervalle: '1 - 300', icon: '🔥', color: '#f472b6' },
  { id: 4, label: 'NIVEAU 4', intervalle: '1 - 500', icon: '👑', color: '#f87171' },
];

const AVATAR_COLORS = [
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f97316',
];

const avatarColor = (pseudo: string): string => {
  let h = 0;
  for (const c of pseudo) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const initials = (pseudo: string): string => pseudo.substring(0, 2).toUpperCase();

const getRatioColor = (ratio: number): string => {
  if (ratio >= 60) return '#22c55e';
  if (ratio >= 40) return '#f59e0b';
  return '#ef4444';
};

export const ClassementDuel: React.FC<Props> = ({ onRetour, pseudo }) => {
  const [niveauActif, setNiveauActif] = useState<number>(1);
  const [classement, setClassement] = useState<JoueurClassement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  const chargerClassement = useCallback(async (niveau: number, isRefresh = false) => {
    if (!isRefresh) setChargement(true);
    setErreur(null);

    try {
      // ✅ Tri par victoires DESC, puis défaites ASC, puis pseudo ASC (déjà fait côté serveur)
      const response = await fetch(`${API_URL}/api/classement/duel/niveau/${niveau}`);
      if (!response.ok) throw new Error('Erreur de chargement');
      const data = await response.json();
      setClassement(data);
    } catch (err) {
      setErreur('Impossible de charger le classement');
      setClassement([]);
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, []);

  useEffect(() => {
    chargerClassement(niveauActif);
  }, [niveauActif]);

  const onRefresh = () => {
    setRafraichissement(true);
    chargerClassement(niveauActif, true);
  };

  const getMedaille = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return null;
  };

  const getMedailleCouleur = (index: number) => {
    if (index === 0) return '#FFD700';
    if (index === 1) return '#C0C0C0';
    if (index === 2) return '#CD7F32';
    return C.textSecond;
  };

  const niveauInfo = NIVEAUX.find(n => n.id === niveauActif)!;

  if (chargement && !rafraichissement) {
    return (
      <LinearGradient colors={['#080c18', '#0d1628']} style={Styles.centreChargement}>
        <ActivityIndicator size="large" color={niveauInfo.color} />
        <Text style={Styles.texteChargement}>Chargement du classement...</Text>
      </LinearGradient>
    );
  }

  return (
    <Animated.View style={[Styles.root, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient colors={['#080c18', '#0d1628']} style={StyleSheet.absoluteFill} />

      <View style={Styles.header}>
        <TouchableOpacity onPress={onRetour} style={Styles.backBtn} activeOpacity={0.7}>
          <Text style={Styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={Styles.headerTitle}>CLASSEMENT DUEL</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={Styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={onRefresh}
            tintColor={niveauInfo.color}
            colors={[niveauInfo.color]}
          />
        }
      >
        {/* Sélecteur de niveau */}
        <View style={Styles.niveauxRow}>
          {NIVEAUX.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[
                Styles.niveauChip,
                niveauActif === n.id && Styles.niveauChipActif,
                { borderColor: n.color },
                niveauActif === n.id && { backgroundColor: `${n.color}20` },
              ]}
              onPress={() => setNiveauActif(n.id)}
              activeOpacity={0.7}
            >
              <Text style={Styles.niveauChipIcon}>{n.icon}</Text>
              <Text style={[Styles.niveauChipLabel, niveauActif === n.id && { color: n.color }]}>
                {n.label}
              </Text>
              <Text style={[Styles.niveauChipIntervalle, { color: n.color }]}>
                {n.intervalle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bannière d'erreur */}
        {erreur && (
          <View style={Styles.erreurBanner}>
            <Text style={Styles.erreurText}>{erreur}</Text>
          </View>
        )}

        {/* Statistiques du niveau */}
        <LinearGradient
          colors={[`${niveauInfo.color}20`, `${niveauInfo.color}08`]}
          style={[Styles.statsBanner, { borderColor: `${niveauInfo.color}40` }]}
        >
          <Text style={[Styles.statsIcon, { color: niveauInfo.color }]}>{niveauInfo.icon}</Text>
          <View style={Styles.statsInfo}>
            <Text style={[Styles.statsTitle, { color: niveauInfo.color }]}>{niveauInfo.label}</Text>
            <Text style={Styles.statsSub}>Intervalle {niveauInfo.intervalle}</Text>
          </View>
          <View style={Styles.statsCount}>
            <Text style={[Styles.statsCountValue, { color: niveauInfo.color }]}>{classement.length}</Text>
            <Text style={Styles.statsCountLabel}>joueurs</Text>
          </View>
        </LinearGradient>

        {/* Liste du classement */}
        {classement.length === 0 ? (
          <View style={Styles.emptyContainer}>
            <Text style={Styles.emptyEmoji}>⚔️</Text>
            <Text style={Styles.emptyTitle}>Aucun classement</Text>
            <Text style={Styles.emptySub}>Soyez le premier à jouer ce niveau en duel !</Text>
          </View>
        ) : (
          <View style={Styles.listeContainer}>
            {classement.map((joueur, index) => {
              const medaille = getMedaille(index);
              const estMoi = joueur.pseudo === pseudo;
              const medailleCouleur = getMedailleCouleur(index);
              const avatarCoul = avatarColor(joueur.pseudo);
              const ratioCoul = getRatioColor(joueur.ratio);

              return (
                <LinearGradient
                  key={joueur.pseudo}
                  colors={estMoi ? ['#150e28', '#0e0d1e'] : ['#111827', '#0f1420']}
                  style={[Styles.carte, estMoi && Styles.carteMoi, { borderColor: estMoi ? niveauInfo.color : '#1e2d45' }]}
                >
                  {/* Position / Médaille */}
                  <View style={[Styles.rangContainer, { backgroundColor: `${medailleCouleur}20` }]}>
                    {medaille ? (
                      <Text style={Styles.rangMedaille}>{medaille}</Text>
                    ) : (
                      <Text style={[Styles.rangNum, { color: medailleCouleur }]}>#{index + 1}</Text>
                    )}
                  </View>

                  {/* Avatar */}
                  <View style={[Styles.avatarContainer, { backgroundColor: `${avatarCoul}20`, borderColor: `${avatarCoul}50` }]}>
                    <Text style={[Styles.avatarTexte, { color: avatarCoul }]}>{initials(joueur.pseudo)}</Text>
                  </View>

                  {/* Informations */}
                  <View style={Styles.infoContainer}>
                    <Text style={[Styles.pseudoTexte, estMoi && { color: niveauInfo.color }]}>
                      {joueur.pseudo}{estMoi && ' ✦'}
                    </Text>
                    <View style={Styles.statsRow}>
                      <View style={Styles.statItem}>
                        <Text style={[Styles.statValue, { color: '#22c55e' }]}>{joueur.victoires}</Text>
                        <Text style={Styles.statLabel}>V</Text>
                      </View>
                      <View style={Styles.statSeparateur} />
                      <View style={Styles.statItem}>
                        <Text style={[Styles.statValue, { color: '#ef4444' }]}>{joueur.defaites}</Text>
                        <Text style={Styles.statLabel}>D</Text>
                      </View>
                      <View style={Styles.statSeparateur} />
                      <View style={Styles.statItem}>
                        <Text style={[Styles.statValue, { color: ratioCoul }]}>{joueur.ratio}%</Text>
                        <Text style={Styles.statLabel}>WR</Text>
                      </View>
                    </View>
                    {joueur.meilleure_serie > 1 && (
                      <Text style={Styles.serieBadge}>🔥 Série {joueur.meilleure_serie}</Text>
                    )}
                  </View>

                  {/* Points / WIN */}
                  <View style={Styles.pointsContainer}>
                    <Text style={[Styles.pointsValue, { color: medaille ? medailleCouleur : ratioCoul }]}>
                      {joueur.victoires}
                    </Text>
                    <Text style={Styles.pointsLabel}>VICTOIRES</Text>
                  </View>
                </LinearGradient>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </Animated.View>
  );
};

const Styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080c18' },
  centreChargement: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  texteChargement: { color: '#aaa', fontSize: 16, marginTop: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bgCard,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bgCardLit, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backBtnText: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  headerTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 2 },

  scrollContent: { padding: 16, paddingBottom: 40 },

  niveauxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  niveauChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  niveauChipActif: { borderWidth: 2 },
  niveauChipIcon: { fontSize: 24, marginBottom: 4 },
  niveauChipLabel: { color: C.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  niveauChipIntervalle: { fontSize: 11, fontWeight: '600' },

  erreurBanner: { backgroundColor: '#ff444420', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ff4444' },
  erreurText: { color: '#ff8888', fontSize: 13, textAlign: 'center' },

  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  statsIcon: { fontSize: 32, marginRight: 12 },
  statsInfo: { flex: 1 },
  statsTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  statsSub: { color: C.textSecond, fontSize: 12, marginTop: 2 },
  statsCount: { alignItems: 'center' },
  statsCountValue: { fontSize: 24, fontWeight: '900' },
  statsCountLabel: { color: C.textHint, fontSize: 10, marginTop: 2 },

  listeContainer: { gap: 10 },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  carteMoi: { borderWidth: 2 },

  rangContainer: { width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 8 },
  rangMedaille: { fontSize: 28 },
  rangNum: { fontSize: 16, fontWeight: '900' },

  avatarContainer: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarTexte: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  infoContainer: { flex: 1 },
  pseudoTexte: { color: C.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 13, fontWeight: '700' },
  statLabel: { color: C.textHint, fontSize: 9, fontWeight: '600', marginTop: 1 },
  statSeparateur: { width: 1, height: 14, backgroundColor: C.border },
  serieBadge: { color: '#f59e0b', fontSize: 10, fontWeight: '700', marginTop: 3 },

  pointsContainer: { alignItems: 'flex-end', minWidth: 70 },
  pointsValue: { fontSize: 18, fontWeight: '900' },
  pointsLabel: { color: C.textHint, fontSize: 9, marginTop: 2, letterSpacing: 1 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { color: C.textSecond, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: C.textHint, fontSize: 13, textAlign: 'center' },
});

export default ClassementDuel;