// src/screens/Classement.tsx
// ═══════════════════════════════════════════════════════════════════
//  CLASSEMENT — Solo + Duel (Version corrigée)
//  CORRECTIONS: Animation sans 'left', couleur or, gestion null ratio
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, Platform, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';
import { PseudoBadge } from '../components/PseudoBadge';
import { API_URL } from '../config/serveur';

// ── Types corrigés ─────────────────────────────────────────────────
type JoueurSolo = {
  pseudo:         string;
  totalPoints:    number;
  moyenneEssais:  number;
  niveauMax:      number;
  niveauxReussis: number;
  derniereDate?:  string;
};

type JoueurDuel = {
  pseudo:        string;
  victoires:     number;
  defaites:      number;
  ratio:         number;
  points:        number;
  meilleureSerie:number;
};

type OngletType = 'solo' | 'duel';
type StatutChargement = 'idle' | 'chargement' | 'ok' | 'erreur' | 'hors_ligne';

type Props = {
  onRetour:        () => void;
  pseudo?:         string;
  onPseudoChange?: (p: string) => void;
};

// ── Constantes ─────────────────────────────────────────────────────
const TIMEOUT_MS     = 6000;
const NIVEAUX_LABELS = ['', 'Débutant', 'Confirmé', 'Expert', 'Légendaire'];
const MEDAILLES      = ['🥇', '🥈', '🥉'];

// ── Fetch avec timeout ────────────────────────────────────────────
const fetchTimeout = (url: string): Promise<Response> => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

/* ════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
════════════════════════════════════════════════════════════════ */
export const Classement: React.FC<Props> = ({
  onRetour, pseudo = 'Joueur', onPseudoChange,
}) => {
  const [onglet,      setOnglet]      = useState<OngletType>('solo');
  const [soloData,    setSoloData]    = useState<JoueurSolo[]>([]);
  const [duelData,    setDuelData]    = useState<JoueurDuel[]>([]);
  const [statutSolo,  setStatutSolo]  = useState<StatutChargement>('idle');
  const [statutDuel,  setStatutDuel]  = useState<StatutChargement>('idle');
  const [refreshing,  setRefreshing]  = useState(false);

  // Animations
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(20)).current;
  
  // ⚠️ CORRECTION: Utilisation de translateX au lieu de left
  const translateXAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    chargerSolo();
    chargerDuel();
  }, []);

  // ⚠️ CORRECTION: Animation sans 'left'
  const switchOnglet = (o: OngletType) => {
    setOnglet(o);
    Animated.spring(translateXAnim, {
      toValue: o === 'solo' ? 0 : 1,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const chargerSolo = useCallback(async () => {
    setStatutSolo('chargement');
    try {
      const res = await fetchTimeout(`${API_URL}/classement/solo`);
      if (!res.ok) { setStatutSolo('erreur'); return; }
      const data = await res.json() as JoueurSolo[];
      setSoloData(data);
      setStatutSolo('ok');
    } catch (e: any) {
      setStatutSolo(e?.name === 'AbortError' ? 'hors_ligne' : 'erreur');
    }
  }, []);

  const chargerDuel = useCallback(async () => {
    setStatutDuel('chargement');
    try {
      const res = await fetchTimeout(`${API_URL}/classement/duel`);
      if (!res.ok) { setStatutDuel('erreur'); return; }
      const data = await res.json() as JoueurDuel[];
      setDuelData(data);
      setStatutDuel('ok');
    } catch (e: any) {
      setStatutDuel(e?.name === 'AbortError' ? 'hors_ligne' : 'erreur');
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([chargerSolo(), chargerDuel()]);
    setRefreshing(false);
  };

  const positionSolo = soloData.findIndex(j => j.pseudo === pseudo) + 1;
  const positionDuel = duelData.findIndex(j => j.pseudo === pseudo) + 1;

  const statutActuel = onglet === 'solo' ? statutSolo : statutDuel;

  // ⚠️ CORRECTION: Interpolation pour translateX
  const indicateurPosition = translateXAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  return (
    <View style={S.root}>
      <LinearGradient colors={[C.bgDeep, C.bg, '#0d1628']} style={StyleSheet.absoluteFill} />

      {/* ── Header ── */}
      <View style={S.header}>
        <TouchableOpacity onPress={onRetour} style={S.backBtn} activeOpacity={0.75}>
          <Text style={S.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={S.headerMid}>
          <Text style={S.headerTitle}>CLASSEMENT</Text>
          <Text style={S.headerSub}>
            {statutActuel === 'ok'
              ? `${onglet === 'solo' ? soloData.length : duelData.length} joueurs classés`
              : statutActuel === 'chargement' ? 'Chargement...'
              : ''}
          </Text>
        </View>
        <PseudoBadge pseudo={pseudo} onPseudoChange={onPseudoChange} compact />
      </View>

      <Animated.View style={[S.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Onglets Solo / Duel (corrigés sans 'left') ── */}
        <View style={S.ongletContainer}>
          <View style={S.ongletTrack}>
            <Animated.View 
              style={[
                S.ongletIndicateur,
                {
                  transform: [{
                    translateX: indicateurPosition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1]
                    })
                  }]
                }
              ]} 
            />
            <TouchableOpacity 
              style={S.ongletBtn} 
              onPress={() => switchOnglet('solo')} 
              activeOpacity={0.75}
            >
              <Text style={[S.ongletText, onglet === 'solo' && S.ongletTextActif]}>
                🎯  SOLO
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={S.ongletBtn} 
              onPress={() => switchOnglet('duel')} 
              activeOpacity={0.75}
            >
              <Text style={[S.ongletText, onglet === 'duel' && S.ongletTextActif]}>
                ⚔️  DUEL
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Ma position ── */}
        {statutActuel === 'ok' && (
          <MaPosition
            pseudo={pseudo}
            position={onglet === 'solo' ? positionSolo : positionDuel}
            onglet={onglet}
            dataSolo={soloData.find(j => j.pseudo === pseudo) ?? null}
            dataDuel={duelData.find(j => j.pseudo === pseudo) ?? null}
          />
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.listePadding}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.gold}
              colors={[C.gold]}
            />
          }
        >
          {statutActuel === 'chargement' && <EcranChargement />}
          {statutActuel === 'hors_ligne'  && <EcranHorsLigne onReessayer={onglet === 'solo' ? chargerSolo : chargerDuel} />}
          {statutActuel === 'erreur'      && <EcranErreur    onReessayer={onglet === 'solo' ? chargerSolo : chargerDuel} />}

          {onglet === 'solo' && statutSolo === 'ok' && (
            soloData.length === 0
              ? <EcranVide message="Aucun score enregistré encore." />
              : soloData.map((joueur, i) => (
                  <CarteClassementSolo
                    key={joueur.pseudo}
                    joueur={joueur}
                    position={i + 1}
                    estMoi={joueur.pseudo === pseudo}
                  />
                ))
          )}

          {onglet === 'duel' && statutDuel === 'ok' && (
            duelData.length === 0
              ? <EcranVide message="Aucun duel joué encore." />
              : duelData.map((joueur, i) => (
                  <CarteClassementDuel
                    key={joueur.pseudo}
                    joueur={joueur}
                    position={i + 1}
                    estMoi={joueur.pseudo === pseudo}
                  />
                ))
          )}

          {statutActuel === 'ok' && <View style={{ height: 20 }} />}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

/* ════════════════════════════════════════════════════════════════
   MA POSITION
════════════════════════════════════════════════════════════════ */
const MaPosition: React.FC<{
  pseudo: string; position: number; onglet: OngletType;
  dataSolo: JoueurSolo | null; dataDuel: JoueurDuel | null;
}> = ({ pseudo, position, onglet, dataSolo, dataDuel }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (position > 0 && position <= 3) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])).start();
    }
  }, [position]);

  if (position === 0) return null;

  const medaille  = position <= 3 ? MEDAILLES[position - 1] : null;
  const estPodium = position <= 3;

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 16 }}>
      <LinearGradient
        colors={estPodium ? [C.goldBg, '#2a1c04'] : [C.bgCard, C.bgCardLit]}
        style={[S.maPositionCard, estPodium && S.maPositionCardPodium]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={S.maPositionLeft}>
          <Text style={S.maPositionRankEmoji}>{medaille ?? `#${position}`}</Text>
          <View>
            <Text style={S.maPositionLabel}>MA POSITION</Text>
            <Text style={S.maPositionPseudo}>{pseudo}</Text>
          </View>
        </View>

        <View style={S.maPositionRight}>
          {onglet === 'solo' && dataSolo && (
            <>
              <Text style={S.maPositionVal}>{dataSolo.totalPoints.toLocaleString()}</Text>
              <Text style={S.maPositionValLabel}>points</Text>
            </>
          )}
          {onglet === 'duel' && dataDuel && (
            <>
              <Text style={S.maPositionVal}>{dataDuel.victoires}</Text>
              <Text style={S.maPositionValLabel}>victoires</Text>
            </>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   CARTE CLASSEMENT SOLO
════════════════════════════════════════════════════════════════ */
const CarteClassementSolo: React.FC<{
  joueur: JoueurSolo; position: number; estMoi: boolean;
}> = ({ joueur, position, estMoi }) => {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(position * 40, 800);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, delay, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, delay, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const isPodium  = position <= 3;
  const medaille  = isPodium ? MEDAILLES[position - 1] : null;

  const gradColors: [string, string] = isPodium
    ? position === 1 ? ['#FFD700', '#FFA500']  // ⚠️ CORRECTION: Or véritable
    : position === 2 ? ['#E0E0E0', '#A9A9A9']  // Argent
    :                  ['#CD7F32', '#8B4513']  // Bronze
    : [C.bgCard, C.bgCard];

  const borderColor = isPodium
    ? position === 1 ? C.gold : position === 2 ? '#8899bb' : '#b07d4a'
    : estMoi ? '#3d1a8a' : C.border;

  return (
    <Animated.View style={{ opacity: opacAnim, transform: [{ scale: scaleAnim }], marginBottom: 10 }}>
      <LinearGradient colors={gradColors} style={[S.carte, { borderColor }, estMoi && S.carteMoi]}>
        <View style={[S.carteRang, isPodium && { backgroundColor: `${borderColor}22` }]}>
          {medaille
            ? <Text style={S.carteRangEmoji}>{medaille}</Text>
            : <Text style={[S.carteRangNum, estMoi && { color: '#9d5ff5' }]}>#{position}</Text>
          }
        </View>

        <View style={S.carteInfo}>
          <View style={S.carteInfoTop}>
            <Text style={[S.cartePseudo, estMoi && { color: '#9d5ff5' }]} numberOfLines={1}>
              {joueur.pseudo}{estMoi ? '  (moi)' : ''}
            </Text>
            <View style={[S.carteNiveauBadge, { backgroundColor: `${C.blue}22`, borderColor: `${C.blue}44` }]}>
              <Text style={[S.carteNiveauText, { color: C.blue }]}>
                {NIVEAUX_LABELS[joueur.niveauMax] ?? 'Débutant'}
              </Text>
            </View>
          </View>

          <View style={S.carteStats}>
            <View style={S.carteStat}>
              <Text style={S.carteStatVal}>{joueur.niveauxReussis}/4</Text>
              <Text style={S.carteStatKey}>niveaux</Text>
            </View>
            <View style={S.carteStatSep} />
            <View style={S.carteStat}>
              <Text style={S.carteStatVal}>{joueur.moyenneEssais}</Text>
              <Text style={S.carteStatKey}>moy. essais</Text>
            </View>
          </View>
        </View>

        <View style={S.cartePoints}>
          <Text style={[S.cartePointsVal, isPodium && { color: C.gold }]}>
            {joueur.totalPoints.toLocaleString()}
          </Text>
          <Text style={S.cartePointsLabel}>pts</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   CARTE CLASSEMENT DUEL (corrigée)
════════════════════════════════════════════════════════════════ */
const CarteClassementDuel: React.FC<{
  joueur: JoueurDuel; position: number; estMoi: boolean;
}> = ({ joueur, position, estMoi }) => {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(position * 40, 800);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, delay, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, delay, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const isPodium   = position <= 3;
  const medaille   = isPodium ? MEDAILLES[position - 1] : null;
  
  // ⚠️ CORRECTION: Gestion des valeurs null pour ratio
  const ratioValue = joueur.ratio ?? 0;
  const ratioColor = ratioValue >= 60 ? C.green : ratioValue >= 40 ? C.amber : C.red;
  const totalDuels = joueur.victoires + joueur.defaites;

  // ⚠️ CORRECTION: Couleurs or/argent/bronze correctes
  const gradColors: [string, string] = isPodium
    ? position === 1 
      ? ['#FFD700', '#FFA500']  // Or véritable
      : position === 2 
        ? ['#E0E0E0', '#A9A9A9']  // Argent
        : ['#CD7F32', '#8B4513']  // Bronze
    : [C.bgCard, C.bgCard];

  const borderColor = isPodium
    ? position === 1 ? C.gold : position === 2 ? '#8899bb' : '#b07d4a'
    : estMoi ? '#3d1a8a' : C.border;

  return (
    <Animated.View style={{ opacity: opacAnim, transform: [{ scale: scaleAnim }], marginBottom: 10 }}>
      <LinearGradient colors={gradColors} style={[S.carte, { borderColor }, estMoi && S.carteMoi]}>
        <View style={[S.carteRang, isPodium && { backgroundColor: `${borderColor}22` }]}>
          {medaille
            ? <Text style={S.carteRangEmoji}>{medaille}</Text>
            : <Text style={[S.carteRangNum, estMoi && { color: '#9d5ff5' }]}>#{position}</Text>
          }
        </View>

        <View style={S.carteInfo}>
          <View style={S.carteInfoTop}>
            <Text style={[S.cartePseudo, estMoi && { color: '#9d5ff5' }]} numberOfLines={1}>
              {joueur.pseudo}{estMoi ? '  (moi)' : ''}
            </Text>
            <View style={[S.carteNiveauBadge, { backgroundColor: `${ratioColor}22`, borderColor: `${ratioColor}44` }]}>
              {/* ⚠️ CORRECTION: Fallback pour ratio null */}
              <Text style={[S.carteNiveauText, { color: ratioColor }]}>{ratioValue}% win</Text>
            </View>
          </View>

          <View style={S.carteStats}>
            <View style={S.carteStat}>
              <Text style={[S.carteStatVal, { color: C.green }]}>{joueur.victoires}V</Text>
              <Text style={S.carteStatKey}>victoires</Text>
            </View>
            <View style={S.carteStatSep} />
            <View style={S.carteStat}>
              <Text style={[S.carteStatVal, { color: C.red }]}>{joueur.defaites}D</Text>
              <Text style={S.carteStatKey}>défaites</Text>
            </View>
            <View style={S.carteStatSep} />
            <View style={S.carteStat}>
              <Text style={S.carteStatVal}>{totalDuels}</Text>
              <Text style={S.carteStatKey}>duels</Text>
            </View>
          </View>

          {joueur.meilleureSerie > 0 && (
            <View style={S.carteSerie}>
              <Text style={S.carteSerieText}>🔥 Série max: {joueur.meilleureSerie}</Text>
            </View>
          )}
        </View>

        <View style={S.cartePoints}>
          <Text style={[S.cartePointsVal, isPodium && { color: C.gold }]}>
            {joueur.points.toLocaleString()}
          </Text>
          <Text style={S.cartePointsLabel}>pts</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   ÉTATS UI
════════════════════════════════════════════════════════════════ */
const EcranChargement: React.FC = () => (
  <View style={S.etatCentre}>
    <ActivityIndicator size="large" color={C.gold} />
    <Text style={S.etatText}>Chargement du classement...</Text>
  </View>
);

const EcranHorsLigne: React.FC<{ onReessayer: () => void }> = ({ onReessayer }) => (
  <View style={S.etatCentre}>
    <Text style={S.etatEmoji}>📡</Text>
    <Text style={S.etatTitre}>Hors ligne</Text>
    <Text style={S.etatText}>
      Impossible de joindre le serveur.{'\n'}
      Vérifie ta connexion internet.
    </Text>
    <TouchableOpacity onPress={onReessayer} activeOpacity={0.85} style={S.btnReessayer}>
      <LinearGradient colors={[C.goldDark, C.gold]} style={S.btnReessayerGrad}>
        <Text style={S.btnReessayerText}>↺  Réessayer</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

const EcranErreur: React.FC<{ onReessayer: () => void }> = ({ onReessayer }) => (
  <View style={S.etatCentre}>
    <Text style={S.etatEmoji}>⚠️</Text>
    <Text style={S.etatTitre}>Erreur serveur</Text>
    <Text style={S.etatText}>Le serveur a retourné une erreur.</Text>
    <TouchableOpacity onPress={onReessayer} activeOpacity={0.85} style={S.btnReessayer}>
      <LinearGradient colors={[C.goldDark, C.gold]} style={S.btnReessayerGrad}>
        <Text style={S.btnReessayerText}>↺  Réessayer</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

const EcranVide: React.FC<{ message: string }> = ({ message }) => (
  <View style={S.etatCentre}>
    <Text style={S.etatEmoji}>🏆</Text>
    <Text style={S.etatTitre}>Classement vide</Text>
    <Text style={S.etatText}>{message}</Text>
    <Text style={S.etatSubText}>Sois le premier à te classer !</Text>
  </View>
);

/* ════════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════════ */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bgCard,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.bgCardLit, alignItems: 'center', justifyContent: 'center',
    marginRight: 12, borderWidth: 1, borderColor: C.border,
  },
  backBtnText: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  headerMid:   { flex: 1 },
  headerTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 2.5 },
  headerSub:   { color: C.textSecond,  fontSize: 12, marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  listePadding: { paddingBottom: 40 },

  // ── Onglets (corrigés sans 'left') ──
  ongletContainer: { marginBottom: 16 },
  ongletTrack: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 4,
    position: 'relative',
    height: 48,
  },
  ongletIndicateur: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    borderRadius: 12,
    backgroundColor: C.bgCardLit,
    borderWidth: 1,
    borderColor: C.borderLit,
  },
  ongletBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  ongletText:     { color: C.textSecond, fontSize: 13, fontWeight: '700' },
  ongletTextActif:{ color: C.textPrimary, fontWeight: '900' },

  maPositionCard: {
    borderRadius: 18, padding: 16, flexDirection: 'row',
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  maPositionCardPodium: { borderColor: C.goldDark },
  maPositionLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  maPositionRankEmoji: { fontSize: 28 },
  maPositionLabel: { color: C.textSecond, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  maPositionPseudo:{ color: C.textPrimary, fontSize: 16, fontWeight: '900', marginTop: 2 },
  maPositionRight: { alignItems: 'flex-end' },
  maPositionVal:   { color: C.gold, fontSize: 22, fontWeight: '900' },
  maPositionValLabel: { color: C.textSecond, fontSize: 11, fontWeight: '600' },

  carte: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, padding: 14, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  carteMoi: { borderWidth: 1.5 },
  carteRang: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.bgCardLit,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  carteRangEmoji: { fontSize: 22 },
  carteRangNum:   { color: C.textSecond, fontSize: 15, fontWeight: '900' },
  carteInfo:      { flex: 1 },
  carteInfoTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cartePseudo:    { color: C.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 },
  carteNiveauBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  carteNiveauText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  carteStats:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carteStat:      { alignItems: 'center' },
  carteStatVal:   { color: C.textBody, fontSize: 13, fontWeight: '800' },
  carteStatKey:   { color: C.textHint, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  carteStatSep:   { width: 1, height: 20, backgroundColor: C.border, marginHorizontal: 4 },
  cartePoints:    { alignItems: 'flex-end', minWidth: 60 },
  cartePointsVal: { color: C.textPrimary, fontSize: 18, fontWeight: '900' },
  cartePointsLabel:{ color: C.textSecond, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  carteSerie: {
    marginTop: 4, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: C.bgCardLit, borderRadius: 6, alignSelf: 'flex-start',
  },
  carteSerieText: { fontSize: 9, color: C.gold, fontWeight: '700' },

  etatCentre:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  etatEmoji:    { fontSize: 56, marginBottom: 16 },
  etatTitre:    { color: C.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  etatText:     { color: C.textBody, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  etatSubText:  { color: C.textHint, fontSize: 13, textAlign: 'center' },
  btnReessayer: { borderRadius: 16, overflow: 'hidden', minWidth: 160 },
  btnReessayerGrad: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  btnReessayerText: { color: C.bgDeep, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});

export default Classement;