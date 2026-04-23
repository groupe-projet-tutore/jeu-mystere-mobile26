// src/screens/ClassementSolo.tsx
// ═══════════════════════════════════════════════════════════════════════════════
//  CLASSEMENT SOLO — Version GLOBALE (tous niveaux confondus)
//  - Classement unique par somme des points de tous les niveaux
//  - Tri par total points DESC, puis meilleur essai ASC, puis pseudo ASC
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
  total_points: number;
  meilleur_essai: number;
  niveaux_joues: number;
};

const AVATAR_COLORS = [
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f97316',
];

const avatarColor = (pseudo: string): string => {
  let h = 0;
  for (const c of pseudo) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const initials = (pseudo: string): string => pseudo.substring(0, 2).toUpperCase();

const formatPts = (n: number): string => {
  const valeur = n || 0;
  return valeur >= 10000 ? `${(valeur / 1000).toFixed(1)}K` : valeur.toLocaleString();
};

export const ClassementSolo: React.FC<Props> = ({ onRetour, pseudo }) => {
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

  const chargerClassement = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setChargement(true);
    setErreur(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_URL}/api/classement/solo/global`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error('Erreur de chargement');
      
      const data = await response.json();
      setClassement(data);
    } catch (err: any) {
      console.log('Erreur classement:', err);
      if (err.name === 'AbortError') {
        setErreur('Le serveur ne répond pas. Vérifie ta connexion.');
      } else {
        setErreur('Impossible de charger le classement');
      }
      setClassement([]);
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, []);

  useEffect(() => {
    chargerClassement();
  }, []);

  const onRefresh = () => {
    setRafraichissement(true);
    chargerClassement(true);
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

  if (chargement && !rafraichissement) {
    return (
      <LinearGradient colors={['#080c18', '#0d1628']} style={Styles.centreChargement}>
        <ActivityIndicator size="large" color="#4d8af0" />
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
        <Text style={Styles.headerTitle}>CLASSEMENT SOLO</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={Styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={onRefresh}
            tintColor="#4d8af0"
            colors={['#4d8af0']}
          />
        }
      >
        {/* Bannière d'erreur */}
        {erreur && (
          <View style={Styles.erreurBanner}>
            <Text style={Styles.erreurText}>{erreur}</Text>
          </View>
        )}

        {/* Statistiques globales */}
        <LinearGradient
          colors={['#4d8af020', '#4d8af008']}
          style={[Styles.statsBanner, { borderColor: '#4d8af040' }]}
        >
          <Text style={[Styles.statsIcon, { color: '#4d8af0' }]}>🏆</Text>
          <View style={Styles.statsInfo}>
            <Text style={[Styles.statsTitle, { color: '#4d8af0' }]}>CLASSEMENT GLOBAL</Text>
            <Text style={Styles.statsSub}>Somme des points de tous les niveaux</Text>
          </View>
          <View style={Styles.statsCount}>
            <Text style={[Styles.statsCountValue, { color: '#4d8af0' }]}>{classement.length}</Text>
            <Text style={Styles.statsCountLabel}>joueurs</Text>
          </View>
        </LinearGradient>

        {/* Liste du classement */}
        {classement.length === 0 ? (
          <View style={Styles.emptyContainer}>
            <Text style={Styles.emptyEmoji}>🏆</Text>
            <Text style={Styles.emptyTitle}>Aucun classement</Text>
            <Text style={Styles.emptySub}>Soyez le premier à jouer !</Text>
          </View>
        ) : (
          <View style={Styles.listeContainer}>
            {classement.map((joueur, index) => {
              const medaille = getMedaille(index);
              const estMoi = joueur.pseudo === pseudo;
              const medailleCouleur = getMedailleCouleur(index);
              const avatarCoul = avatarColor(joueur.pseudo);
              
              const pointsValue = joueur.total_points || 0;
              const meilleurEssai = joueur.meilleur_essai || 0;
              const niveauxJoues = joueur.niveaux_joues || 0;

              return (
                <LinearGradient
                  key={joueur.pseudo}
                  colors={estMoi ? ['#150e28', '#0e0d1e'] : ['#111827', '#0f1420']}
                  style={[Styles.carte, estMoi && Styles.carteMoi, { borderColor: estMoi ? '#4d8af0' : '#1e2d45' }]}
                >
                  <View style={[Styles.rangContainer, { backgroundColor: `${medailleCouleur}20` }]}>
                    {medaille ? (
                      <Text style={Styles.rangMedaille}>{medaille}</Text>
                    ) : (
                      <Text style={[Styles.rangNum, { color: medailleCouleur }]}>#{index + 1}</Text>
                    )}
                  </View>

                  <View style={[Styles.avatarContainer, { backgroundColor: `${avatarCoul}20`, borderColor: `${avatarCoul}50` }]}>
                    <Text style={[Styles.avatarTexte, { color: avatarCoul }]}>{initials(joueur.pseudo)}</Text>
                  </View>

                  <View style={Styles.infoContainer}>
                    <Text style={[Styles.pseudoTexte, estMoi && { color: '#4d8af0' }]}>
                      {joueur.pseudo}{estMoi && ' ✦'}
                    </Text>
                    <View style={Styles.statsRow}>
                      <View style={Styles.statItem}>
                        <Text style={Styles.statValue}>{pointsValue.toLocaleString()}</Text>
                        <Text style={Styles.statLabel}>pts</Text>
                      </View>
                      <View style={Styles.statSeparateur} />
                      <View style={Styles.statItem}>
                        <Text style={Styles.statValue}>{meilleurEssai}</Text>
                        <Text style={Styles.statLabel}>meilleur essai</Text>
                      </View>
                      <View style={Styles.statSeparateur} />
                      <View style={Styles.statItem}>
                        <Text style={Styles.statValue}>{niveauxJoues}</Text>
                        <Text style={Styles.statLabel}>niveaux</Text>
                      </View>
                    </View>
                  </View>

                  <View style={Styles.pointsContainer}>
                    <Text style={[Styles.pointsValue, { color: medaille ? medailleCouleur : '#4d8af0' }]}>
                      {formatPts(pointsValue)}
                    </Text>
                    <Text style={Styles.pointsLabel}>TOTAL</Text>
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
  statValue: { color: C.textBody, fontSize: 13, fontWeight: '700' },
  statLabel: { color: C.textHint, fontSize: 9, fontWeight: '600', marginTop: 1 },
  statSeparateur: { width: 1, height: 14, backgroundColor: C.border },

  pointsContainer: { alignItems: 'flex-end', minWidth: 60 },
  pointsValue: { fontSize: 18, fontWeight: '900' },
  pointsLabel: { color: C.textHint, fontSize: 9, marginTop: 2, letterSpacing: 1 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { color: C.textSecond, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: C.textHint, fontSize: 13, textAlign: 'center' },
});

export default ClassementSolo;