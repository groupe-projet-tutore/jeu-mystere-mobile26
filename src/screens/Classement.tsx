// src/screens/Classement.tsx
// ═══════════════════════════════════════════════════════════════════
//  CLASSEMENT — Solo + Duel  •  Version corrigée + Premium
//  Endpoints exacts du serveur v5.4 :
//    GET /classement/solo  → JoueurSolo[]
//    GET /classement/duel  → JoueurDuel[]
//  Tous les champs correspondent exactement à la réponse serveur.
// ═══════════════════════════════════════════════════════════════════
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, Platform, ScrollView,
  ActivityIndicator, RefreshControl, Dimensions,
  TextInput, LayoutAnimation, UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';
import { PseudoBadge } from '../components/PseudoBadge';
import { API_URL } from '../config/serveur';

// Android LayoutAnimation
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────
//  TYPES — mappés exactement sur les réponses JSON du serveur v5.4
// ─────────────────────────────────────────────────────────────────

/**
 * Réponse de GET /classement/solo
 * Source : classement_solo_global() dans app.py
 *   SELECT pseudo, SUM(points) as total_points,
 *          AVG(essais) as moyenne_essais,
 *          MAX(date) as derniere_date,
 *          MAX(niveau_id) as niveau_max,
 *          COUNT(*) as niveaux_reussis
 */
type JoueurSolo = {
  pseudo:         string;   // row[0]
  totalPoints:    number;   // row[1]  — SUM(points)
  moyenneEssais:  number;   // row[2]  — AVG(essais) arrondi à 1 décimale
  derniereDate:   string;   // row[3]  — MAX(date)
  niveauMax:      number;   // row[4]  — MAX(niveau_id) — valeur 1..4
  niveauxReussis: number;   // row[5]  — COUNT(*)       — nb de niveaux passés
};

/**
 * Réponse de GET /classement/duel
 * Source : classement_duel() dans app.py
 *   SELECT pseudo, victoires, defaites,
 *          ROUND(CAST(victoires AS FLOAT) / NULLIF(total_duels,0) * 100, 1) as ratio,
 *          points_total, meilleure_serie
 *   FROM stats_duel WHERE total_duels > 0
 * Le serveur fait `if row[3] else 0` donc ratio vaut toujours un number (jamais null côté JS)
 */
type JoueurDuel = {
  pseudo:         string;   // row[0]
  victoires:      number;   // row[1]
  defaites:       number;   // row[2]
  ratio:          number;   // row[3]  — ex: 66.7  (toujours >= 0 côté serveur)
  points:         number;   // row[4]  — points_total dans stats_duel
  meilleureSerie: number;   // row[5]
};

type OngletType       = 'solo' | 'duel';
type StatutChargement = 'idle' | 'chargement' | 'ok' | 'erreur' | 'hors_ligne';
type SortType         = 'pts' | 'az';

type Props = {
  onRetour:        () => void;
  pseudo?:         string;
  onPseudoChange?: (p: string) => void;
};

// ─────────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────────
const TIMEOUT_MS = 6000;

/**
 * niveauMax est MAX(niveau_id) dans scores — valeurs 1..4
 * Index direct : NIVEAUX_LABELS[niveauMax - 1]
 */
const NIVEAUX_LABELS = ['Débutant', 'Confirmé', 'Expert', 'Légendaire'];

const MEDAILLES = ['🥇', '🥈', '🥉'];

/** Couleur principale / secondaire pour or, argent, bronze */
const MEDAILLE_COLORS: [string, string][] = [
  ['#FFD700', '#B8860B'],
  ['#D0D0D8', '#909098'],
  ['#CD7F32', '#8B4513'],
];

const AVATAR_COLORS = [
  '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f59e0b', '#10b981', '#f97316',
];

// ─────────────────────────────────────────────────────────────────
//  UTILITAIRES
// ─────────────────────────────────────────────────────────────────
const fetchTimeout = (url: string): Promise<Response> => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

/** Couleur déterministe à partir du pseudo */
const avatarColor = (pseudo: string): string => {
  let h = 0;
  for (const c of pseudo) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

/** Deux premières lettres en majuscule */
const initials = (pseudo: string): string =>
  pseudo.substring(0, 2).toUpperCase();

/** Formatte un score : 12 345 ou 12.3K */
const formatPts = (n: number): string =>
  n >= 10000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();

/**
 * Label de niveau à partir de niveauMax (1..4)
 * Sécurisé : si la valeur est hors plage → 'Débutant'
 */
const niveauLabel = (niveauMax: number): string =>
  NIVEAUX_LABELS[Math.max(0, Math.min(niveauMax - 1, 3))] ?? 'Débutant';

/** Couleur du win-rate */
const ratioColor = (r: number): string =>
  r >= 60 ? '#22c55e' : r >= 40 ? '#f59e0b' : '#ef4444';

// ─────────────────────────────────────────────────────────────────
//  HOOKS ANIMATIONS
// ─────────────────────────────────────────────────────────────────
function usePulse(enabled: boolean) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1.025, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1,     duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enabled]);
  return anim;
}

function useEntrance(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);
  return { opacity, transform: [{ translateY }] } as const;
}

/* ════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
════════════════════════════════════════════════════════════════ */
export const Classement: React.FC<Props> = ({
  onRetour, pseudo = 'Joueur', onPseudoChange,
}) => {
  const [onglet,     setOnglet]     = useState<OngletType>('solo');
  const [soloData,   setSoloData]   = useState<JoueurSolo[]>([]);
  const [duelData,   setDuelData]   = useState<JoueurDuel[]>([]);
  const [statutSolo, setStatutSolo] = useState<StatutChargement>('idle');
  const [statutDuel, setStatutDuel] = useState<StatutChargement>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [sort,       setSort]       = useState<SortType>('pts');
  const [trackW,     setTrackW]     = useState(SCREEN_W - 64);

  const headerAnim  = useEntrance(0);
  const tabAnim     = useEntrance(60);
  const contentAnim = useEntrance(130);

  // ── Indicateur d'onglet glissant ──────────────────────────────
  const tabSlide = useRef(new Animated.Value(0)).current;

  const switchOnglet = (o: OngletType) => {
    if (o === onglet) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOnglet(o);
    Animated.spring(tabSlide, {
      toValue:  o === 'solo' ? 0 : trackW / 2 - 4,
      friction: 8, tension: 80, useNativeDriver: true,
    }).start();
  };

  // ── Chargement ────────────────────────────────────────────────
  // Endpoint exact du serveur : /classement/solo  (pas /api/classement/solo)
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

  // Endpoint exact du serveur : /classement/duel  (pas /api/classement/duel)
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

  useEffect(() => {
    chargerSolo();
    chargerDuel();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([chargerSolo(), chargerDuel()]);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Données courantes ─────────────────────────────────────────
  const data   = onglet === 'solo' ? soloData   : duelData;
  const statut = onglet === 'solo' ? statutSolo : statutDuel;

  /** Position du joueur courant dans le classement actif (0 = absent) */
  const maPosition = (data as any[]).findIndex(j => j.pseudo === pseudo) + 1;

  /** Top 3 pour le podium */
  const top3 = (data as any[]).slice(0, 3);

  /** Liste filtrée + triée */
  const dataFiltree = useMemo(() => {
    let d = [...(data as any[])];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      d = d.filter(j => j.pseudo.toLowerCase().includes(q));
    }
    if (sort === 'az') {
      d = [...d].sort((a, b) => a.pseudo.localeCompare(b.pseudo));
    }
    // sort === 'pts' : déjà trié par le serveur (ORDER BY total_points/points_total DESC)
    return d;
  }, [data, search, sort]);

  return (
    <View style={S.root}>
      <LinearGradient
        colors={['#030712', '#060d1f', '#0b1228']}
        style={StyleSheet.absoluteFill}
      />
      <GridFond />

      {/* ── Header ── */}
      <Animated.View style={[S.header, headerAnim]}>
        <TouchableOpacity onPress={onRetour} style={S.backBtn} activeOpacity={0.7}>
          <Text style={S.backBtnText}>←</Text>
        </TouchableOpacity>

        <View style={S.headerMid}>
          <Text style={S.headerTitle}>CLASSEMENT</Text>
          <View style={S.liveBadge}>
            <PointClignotant />
            <Text style={S.liveText}>
              {statut === 'ok'
                ? `${data.length} joueur${data.length > 1 ? 's' : ''} classé${data.length > 1 ? 's' : ''}`
                : statut === 'chargement' ? 'Chargement...'
                : statut === 'hors_ligne' ? 'Hors ligne'
                : 'Erreur'}
            </Text>
          </View>
        </View>

        <PseudoBadge pseudo={pseudo} onPseudoChange={onPseudoChange} compact />
      </Animated.View>

      <Animated.View style={[{ flex: 1 }, tabAnim]}>

        {/* ── Onglets ── */}
        <View style={S.ongletWrap}>
          <View
            style={S.ongletTrack}
            onLayout={e => setTrackW(e.nativeEvent.layout.width)}
          >
            {/* Pastille glissante */}
            <Animated.View
              style={[
                S.ongletPastille,
                { width: trackW / 2 - 4, transform: [{ translateX: tabSlide }] },
              ]}
            >
              <LinearGradient
                colors={['#1a3a5c', '#0d2040']}
                style={StyleSheet.absoluteFill}
              />
              <View style={S.ongletPastilleBord} />
            </Animated.View>

            {(['solo', 'duel'] as OngletType[]).map(o => (
              <TouchableOpacity
                key={o}
                style={S.ongletBtn}
                onPress={() => switchOnglet(o)}
                activeOpacity={0.85}
              >
                <Text style={[S.ongletTxt, onglet === o && S.ongletTxtActif]}>
                  {o === 'solo' ? '🎯  SOLO' : '⚔️  DUEL'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.gold}
              colors={[C.gold]}
            />
          }
        >
          <Animated.View style={contentAnim}>

            {/* ── Bannière ma position ── */}
            {statut === 'ok' && maPosition > 0 && (
              <BannierePosition
                pseudo={pseudo}
                position={maPosition}
                total={data.length}
                onglet={onglet}
                dataSolo={soloData.find(j => j.pseudo === pseudo) ?? null}
                dataDuel={duelData.find(j => j.pseudo === pseudo) ?? null}
              />
            )}

            {/* ── Podium Top 3 ── */}
            {statut === 'ok' && top3.length === 3 && (
              <Podium top3={top3} onglet={onglet} pseudo={pseudo} />
            )}

            {/* ── Barre recherche + tri ── */}
            {statut === 'ok' && data.length > 0 && (
              <View style={S.searchRow}>
                <View style={S.searchBox}>
                  <Text style={S.searchIcone}>🔍</Text>
                  <TextInput
                    style={S.searchInput}
                    placeholder="Rechercher un joueur..."
                    placeholderTextColor={C.textHint}
                    value={search}
                    onChangeText={setSearch}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                      <Text style={S.searchClear}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <BoutonTri label="PTS" actif={sort === 'pts'} onPress={() => setSort('pts')} />
                <BoutonTri label="A–Z" actif={sort === 'az'}  onPress={() => setSort('az')}  />
              </View>
            )}

            {/* ── États ── */}
            {statut === 'chargement' && <EcranChargement />}
            {statut === 'hors_ligne' && (
              <EcranEtat
                emoji="📡" titre="Hors ligne"
                texte={'Impossible de joindre le serveur.\nVérifie ta connexion internet.'}
                onReessayer={onglet === 'solo' ? chargerSolo : chargerDuel}
              />
            )}
            {statut === 'erreur' && (
              <EcranEtat
                emoji="⚠️" titre="Erreur serveur"
                texte="Le serveur a retourné une erreur."
                onReessayer={onglet === 'solo' ? chargerSolo : chargerDuel}
              />
            )}
            {statut === 'ok' && dataFiltree.length === 0 && (
              <EcranEtat
                emoji="🏆" titre="Aucun résultat"
                texte={search ? `Aucun joueur pour "${search}".` : 'Aucun joueur classé.'}
              />
            )}

            {/* ── Liste ── */}
            {statut === 'ok' && dataFiltree.map((joueur: any, i: number) => {
              // La position réelle dans le classement non-filtré (pour la médaille correcte)
              const posReelle = (data as any[]).indexOf(joueur) + 1;
              return onglet === 'solo' ? (
                <CarteClassementSolo
                  key={joueur.pseudo}
                  joueur={joueur as JoueurSolo}
                  position={posReelle}
                  estMoi={joueur.pseudo === pseudo}
                  index={i}
                />
              ) : (
                <CarteClassementDuel
                  key={joueur.pseudo}
                  joueur={joueur as JoueurDuel}
                  position={posReelle}
                  estMoi={joueur.pseudo === pseudo}
                  index={i}
                />
              );
            })}

            <View style={{ height: 48 }} />
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

/* ════════════════════════════════════════════════════════════════
   GRILLE DE FOND
════════════════════════════════════════════════════════════════ */
const GridFond: React.FC = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {Array.from({ length: 10 }).map((_, i) => (
      <View
        key={`v${i}`}
        style={[S.grilleLigne, { position: 'absolute', top: 0, bottom: 0, width: 1, left: (i / 9) * SCREEN_W }]}
      />
    ))}
    {Array.from({ length: 18 }).map((_, i) => (
      <View
        key={`h${i}`}
        style={[S.grilleLigne, { position: 'absolute', left: 0, right: 0, height: 1, top: 60 + i * 80 }]}
      />
    ))}
    <View style={[S.orbe, { top: -100, left: SCREEN_W * 0.65, backgroundColor: '#06b6d4' }]} />
    <View style={[S.orbe, { top: 400, left: -80, backgroundColor: '#3b82f6' }]} />
  </View>
);

/* ════════════════════════════════════════════════════════════════
   POINT CLIGNOTANT
════════════════════════════════════════════════════════════════ */
const PointClignotant: React.FC = () => {
  const anim = usePulse(true);
  return <Animated.View style={[S.pointVert, { transform: [{ scale: anim }] }]} />;
};

/* ════════════════════════════════════════════════════════════════
   BANNIÈRE MA POSITION
════════════════════════════════════════════════════════════════ */
const BannierePosition: React.FC<{
  pseudo:   string;
  position: number;
  total:    number;
  onglet:   OngletType;
  dataSolo: JoueurSolo | null;
  dataDuel: JoueurDuel | null;
}> = ({ pseudo, position, total, onglet, dataSolo, dataDuel }) => {
  const pulse  = usePulse(position <= 3);
  const entree = useEntrance(0);

  const isPodium   = position <= 3;
  const medaille   = isPodium ? MEDAILLES[position - 1] : null;
  const accentCoul = isPodium ? MEDAILLE_COLORS[position - 1][0] : '#8b5cf6';

  return (
    <Animated.View style={[
      entree,
      { marginBottom: 16, transform: [...entree.transform, { scale: pulse }] },
    ]}>
      <LinearGradient
        colors={isPodium ? ['#1c1a08', '#0d1520'] : ['#110d22', '#090d1e']}
        style={[S.banniere, { borderColor: `${accentCoul}30` }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={[S.banniereAccent, { backgroundColor: accentCoul }]} />
        <Text style={S.banniereMedaille}>{medaille ?? `#${position}`}</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.banniereLabel}>MA POSITION</Text>
          <Text style={S.bannierePseudo} numberOfLines={1}>{pseudo}</Text>
        </View>
        <View style={S.banniereRight}>
          {onglet === 'solo' && dataSolo && (
            <>
              <Text style={[S.banniereVal, { color: accentCoul }]}>
                {formatPts(dataSolo.totalPoints)}
              </Text>
              <Text style={S.banniereValLabel}>points</Text>
              <Text style={S.banniereRangLabel}>{position} / {total}</Text>
            </>
          )}
          {onglet === 'duel' && dataDuel && (
            <>
              {/* victoires depuis stats_duel */}
              <Text style={[S.banniereVal, { color: accentCoul }]}>
                {dataDuel.victoires}V
              </Text>
              {/* ratio = ROUND(victoires/total_duels*100, 1) depuis stats_duel */}
              <Text style={S.banniereValLabel}>{dataDuel.ratio}% WR</Text>
              <Text style={S.banniereRangLabel}>{position} / {total}</Text>
            </>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   PODIUM TOP 3
════════════════════════════════════════════════════════════════ */
const Podium: React.FC<{
  top3:   any[];
  onglet: OngletType;
  pseudo: string;
}> = ({ top3, onglet, pseudo }) => {
  const ordre = [top3[1], top3[0], top3[2]];
  const rangs = [2, 1, 3];
  const hauts = [108, 138, 88];

  return (
    <View style={S.podiumConteneur}>
      <Text style={S.podiumTitre}>⬡  TOP 3  ⬡</Text>
      <View style={S.podiumRangee}>
        {ordre.map((joueur, i) => {
          if (!joueur) return null;
          const rang = rangs[i];
          const isMe = joueur.pseudo === pseudo;
          // Points selon l'onglet — champs exacts du serveur
          const pts  = onglet === 'solo'
            ? (joueur as JoueurSolo).totalPoints
            : (joueur as JoueurDuel).points;
          const [c1] = MEDAILLE_COLORS[rang - 1];
          // Sous-titre avec les champs réels du serveur
          const sub  = onglet === 'solo'
            ? `${(joueur as JoueurSolo).niveauxReussis}/4 niveaux • moy. ${(joueur as JoueurSolo).moyenneEssais}`
            : `${(joueur as JoueurDuel).victoires}V ${(joueur as JoueurDuel).defaites}D — ${(joueur as JoueurDuel).ratio}% WR`;

          return (
            <PodiumColonne
              key={joueur.pseudo}
              joueur={joueur} rang={rang} isMe={isMe}
              pts={pts} sub={sub} couleur={c1}
              hauteur={hauts[i]} delay={i * 80}
            />
          );
        })}
      </View>
    </View>
  );
};

const PodiumColonne: React.FC<{
  joueur:  any; rang: number; isMe: boolean;
  pts: number; sub: string; couleur: string;
  hauteur: number; delay: number;
}> = ({ joueur, rang, isMe, pts, sub, couleur, hauteur, delay }) => {
  const entree = useEntrance(delay);
  const pulse  = usePulse(rang === 1);

  return (
    <Animated.View style={[
      S.podiumColonne, entree,
      rang === 1 && { transform: [...entree.transform, { scale: pulse }] },
    ]}>
      {rang === 1 && <Text style={S.podiumCouronne}>👑</Text>}
      <Text style={S.podiumMedaille}>{MEDAILLES[rang - 1]}</Text>
      <LinearGradient
        colors={[`${couleur}20`, `${couleur}08`]}
        style={[S.podiumCarte, { borderColor: `${couleur}50` }]}
      >
        <LinearGradient
          colors={[couleur, `${couleur}44`]}
          style={[S.podiumBarre, { height: hauteur }]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />
        <View style={S.podiumCarteInner}>
          <View style={[S.podiumAvatar, {
            backgroundColor: avatarColor(joueur.pseudo) + '28',
            borderColor:     avatarColor(joueur.pseudo) + '60',
          }]}>
            <Text style={[S.podiumAvatarTxt, { color: avatarColor(joueur.pseudo) }]}>
              {initials(joueur.pseudo)}
            </Text>
          </View>
          <Text style={[S.podiumPseudo, { color: couleur }]} numberOfLines={1}>
            {joueur.pseudo}{isMe ? ' ✦' : ''}
          </Text>
          <Text style={[S.podiumPts, { color: couleur }]}>{formatPts(pts)}</Text>
          <Text style={S.podiumPtsLabel}>pts</Text>
          <Text style={S.podiumSub} numberOfLines={2}>{sub}</Text>
        </View>
        <View style={[S.podiumLueur, { backgroundColor: couleur }]} />
      </LinearGradient>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   CARTE CLASSEMENT SOLO
   Champs : pseudo · totalPoints · moyenneEssais · niveauMax · niveauxReussis
════════════════════════════════════════════════════════════════ */
const CarteClassementSolo: React.FC<{
  joueur: JoueurSolo; position: number; estMoi: boolean; index: number;
}> = ({ joueur, position, estMoi, index }) => {
  const opac   = useRef(new Animated.Value(0)).current;
  const scale  = useRef(new Animated.Value(0.96)).current;
  const slideX = useRef(new Animated.Value(-12)).current;
  const press  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const delay = Math.min(index * 32, 640);
    const a = Animated.parallel([
      Animated.timing(opac,   { toValue: 1, delay, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1, delay, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: 0, delay, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, []);

  const isPodium   = position <= 3;
  const [coul]     = isPodium ? MEDAILLE_COLORS[position - 1] : ['#06b6d4', ''];
  const accentCoul = estMoi ? '#8b5cf6' : isPodium ? coul : '#1e3a5c';
  // niveauMax (1..4) → label via NIVEAUX_LABELS
  const label      = niveauLabel(joueur.niveauMax);
  const niveauCoul = joueur.niveauMax >= 4 ? '#FFD700'
                   : joueur.niveauMax >= 3 ? '#8b5cf6'
                   : joueur.niveauMax >= 2 ? '#06b6d4'
                   : '#4b5563';

  return (
    <Animated.View style={{
      opacity: opac,
      transform: [{ scale }, { translateX: slideX }, { scale: press }],
      marginBottom: 8,
    }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn  ={() => Animated.spring(press, { toValue: 0.975, friction: 10, tension: 200, useNativeDriver: true }).start()}
        onPressOut ={() => Animated.spring(press, { toValue: 1,     friction: 10, tension: 200, useNativeDriver: true }).start()}
      >
        <LinearGradient
          colors={estMoi ? ['#150e28','#0e0d1e'] : isPodium ? ['#141820','#0c1018'] : ['#0e1320','#080c18']}
          style={[S.carte, { borderColor: `${accentCoul}40` }, estMoi && S.carteMoi]}
        >
          <View style={[S.carteAccent, { backgroundColor: accentCoul }]} />

          <View style={[S.carteRang, { backgroundColor: `${accentCoul}16` }]}>
            {isPodium
              ? <Text style={S.carteRangEmoji}>{MEDAILLES[position - 1]}</Text>
              : <Text style={[S.carteRangNum, estMoi && { color: '#8b5cf6' }]}>#{position}</Text>
            }
          </View>

          <View style={[S.carteAvatar, {
            backgroundColor: avatarColor(joueur.pseudo) + '20',
            borderColor:     avatarColor(joueur.pseudo) + '50',
          }]}>
            <Text style={[S.carteAvatarTxt, { color: avatarColor(joueur.pseudo) }]}>
              {initials(joueur.pseudo)}
            </Text>
          </View>

          <View style={S.carteInfo}>
            <View style={S.carteInfoLigne}>
              <Text style={[S.cartePseudo, estMoi && { color: '#8b5cf6' }]} numberOfLines={1}>
                {joueur.pseudo}{estMoi ? '  ✦' : ''}
              </Text>
              {/* Badge : niveauMax converti en label Débutant/Confirmé/Expert/Légendaire */}
              <View style={[S.badge, { backgroundColor: `${niveauCoul}18`, borderColor: `${niveauCoul}40` }]}>
                <Text style={[S.badgeTxt, { color: niveauCoul }]}>{label.toUpperCase()}</Text>
              </View>
            </View>
            <View style={S.carteStats}>
              {/* niveauxReussis = COUNT(*) dans scores — nb de niveaux distincts terminés */}
              <MiniStat val={`${joueur.niveauxReussis}/4`} label="niveaux" />
              <View style={S.sep} />
              {/* moyenneEssais = AVG(essais) arrondi à 1 décimale par le serveur */}
              <MiniStat val={`${joueur.moyenneEssais}`} label="moy. essais" />
            </View>
          </View>

          {/* totalPoints = SUM(points) dans scores */}
          <View style={S.cartePts}>
            <Text style={[S.cartePtsVal, isPodium && { color: coul }]}>
              {formatPts(joueur.totalPoints)}
            </Text>
            <Text style={S.cartePtsLabel}>PTS</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   CARTE CLASSEMENT DUEL
   Champs : pseudo · victoires · defaites · ratio · points · meilleureSerie
════════════════════════════════════════════════════════════════ */
const CarteClassementDuel: React.FC<{
  joueur: JoueurDuel; position: number; estMoi: boolean; index: number;
}> = ({ joueur, position, estMoi, index }) => {
  const opac    = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.96)).current;
  const slideX  = useRef(new Animated.Value(-12)).current;
  const press   = useRef(new Animated.Value(1)).current;
  // useNativeDriver: false car on anime 'width' (propriété de layout)
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index * 32, 640);
    const a = Animated.parallel([
      Animated.timing(opac,    { toValue: 1,                  delay,           duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1,                  delay,           friction: 8, tension: 80,                        useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: 0,                  delay,           duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      // ratio est toujours 0..100 (côté serveur déjà converti en %)
      Animated.timing(barAnim, { toValue: joueur.ratio / 100, delay: delay + 220, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    a.start();
    return () => a.stop();
  }, []);

  const isPodium   = position <= 3;
  const [coul]     = isPodium ? MEDAILLE_COLORS[position - 1] : ['#06b6d4', ''];
  const accentCoul = estMoi ? '#8b5cf6' : isPodium ? coul : '#1e3a5c';
  const rc         = ratioColor(joueur.ratio);

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={{
      opacity: opac,
      transform: [{ scale }, { translateX: slideX }, { scale: press }],
      marginBottom: 8,
    }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn  ={() => Animated.spring(press, { toValue: 0.975, friction: 10, tension: 200, useNativeDriver: true }).start()}
        onPressOut ={() => Animated.spring(press, { toValue: 1,     friction: 10, tension: 200, useNativeDriver: true }).start()}
      >
        <LinearGradient
          colors={estMoi ? ['#150e28','#0e0d1e'] : isPodium ? ['#141820','#0c1018'] : ['#0e1320','#080c18']}
          style={[S.carte, { borderColor: `${accentCoul}40` }, estMoi && S.carteMoi]}
        >
          <View style={[S.carteAccent, { backgroundColor: accentCoul }]} />

          <View style={[S.carteRang, { backgroundColor: `${accentCoul}16` }]}>
            {isPodium
              ? <Text style={S.carteRangEmoji}>{MEDAILLES[position - 1]}</Text>
              : <Text style={[S.carteRangNum, estMoi && { color: '#8b5cf6' }]}>#{position}</Text>
            }
          </View>

          <View style={[S.carteAvatar, {
            backgroundColor: avatarColor(joueur.pseudo) + '20',
            borderColor:     avatarColor(joueur.pseudo) + '50',
          }]}>
            <Text style={[S.carteAvatarTxt, { color: avatarColor(joueur.pseudo) }]}>
              {initials(joueur.pseudo)}
            </Text>
          </View>

          <View style={S.carteInfo}>
            <View style={S.carteInfoLigne}>
              <Text style={[S.cartePseudo, estMoi && { color: '#8b5cf6' }]} numberOfLines={1}>
                {joueur.pseudo}{estMoi ? '  ✦' : ''}
                {/* meilleureSerie depuis stats_duel */}
                {joueur.meilleureSerie > 1 && (
                  <Text style={{ color: '#f59e0b', fontSize: 11 }}>
                    {' '}🔥 {joueur.meilleureSerie}
                  </Text>
                )}
              </Text>
              {/* ratio = ROUND(victoires/total_duels*100, 1) — toujours un number */}
              <View style={[S.badge, { backgroundColor: `${rc}18`, borderColor: `${rc}40` }]}>
                <Text style={[S.badgeTxt, { color: rc }]}>{joueur.ratio}% WR</Text>
              </View>
            </View>
            <View style={S.carteStats}>
              <MiniStat val={`${joueur.victoires}`}                    label="V"     color="#22c55e" />
              <View style={S.sep} />
              <MiniStat val={`${joueur.defaites}`}                     label="D"     color="#ef4444" />
              <View style={S.sep} />
              {/* total duels calculé côté client (victoires + defaites) */}
              <MiniStat val={`${joueur.victoires + joueur.defaites}`}  label="duels" />
            </View>
            {/* Barre win-rate animée */}
            <View style={S.barreTrack}>
              <Animated.View style={[S.barreFill, { width: barWidth, backgroundColor: rc }]} />
            </View>
          </View>

          {/* points = points_total dans stats_duel */}
          <View style={S.cartePts}>
            <Text style={[S.cartePtsVal, isPodium && { color: coul }]}>
              {formatPts(joueur.points)}
            </Text>
            <Text style={S.cartePtsLabel}>PTS</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   COMPOSANTS RÉUTILISABLES
════════════════════════════════════════════════════════════════ */
const MiniStat: React.FC<{ val: string; label: string; color?: string }> = ({ val, label, color }) => (
  <View style={S.miniStat}>
    <Text style={[S.miniStatVal, color ? { color } : undefined]}>{val}</Text>
    <Text style={S.miniStatLabel}>{label}</Text>
  </View>
);

const BoutonTri: React.FC<{ label: string; actif: boolean; onPress: () => void }> = ({ label, actif, onPress }) => (
  <TouchableOpacity style={[S.triBtn, actif && S.triBtnActif]} onPress={onPress} activeOpacity={0.75}>
    <Text style={[S.triTxt, actif && S.triTxtActif]}>{label}</Text>
  </TouchableOpacity>
);

/* ════════════════════════════════════════════════════════════════
   ÉTATS D'ÉCRAN
════════════════════════════════════════════════════════════════ */
const EcranChargement: React.FC = () => (
  <View style={S.etatCentre}>
    <ActivityIndicator size="large" color={C.gold} />
    <Text style={S.etatTexte}>Chargement du classement...</Text>
  </View>
);

const EcranEtat: React.FC<{
  emoji: string; titre: string; texte: string; onReessayer?: () => void;
}> = ({ emoji, titre, texte, onReessayer }) => (
  <View style={S.etatCentre}>
    <Text style={S.etatEmoji}>{emoji}</Text>
    <Text style={S.etatTitre}>{titre}</Text>
    <Text style={S.etatTexte}>{texte}</Text>
    {onReessayer && (
      <TouchableOpacity onPress={onReessayer} activeOpacity={0.85} style={S.btnReessayer}>
        <LinearGradient colors={[C.goldDark, C.gold]} style={S.btnReessayerInner}>
          <Text style={S.btnReessayerTxt}>↺  Réessayer</Text>
        </LinearGradient>
      </TouchableOpacity>
    )}
  </View>
);

/* ════════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════════ */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030712' },

  grilleLigne: { backgroundColor: 'rgba(6,182,212,0.035)' },
  orbe:        { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.06 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16,
    paddingTop:    Platform.OS === 'ios' ? 54 : 18,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(6,182,212,0.12)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  headerMid:   { flex: 1 },
  headerTitle: {
    color: C.textPrimary, fontSize: 19, fontWeight: '900', letterSpacing: 4,
    textShadowColor: 'rgba(6,182,212,0.5)', textShadowRadius: 10,
  },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveText:  { color: '#06b6d4', fontSize: 10, letterSpacing: 2 },
  pointVert: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#06b6d4' },

  // Onglets
  ongletWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  ongletTrack: {
    flexDirection: 'row', height: 48,
    backgroundColor: '#080d1a',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 4, position: 'relative', overflow: 'hidden',
  },
  ongletPastille: {
    position: 'absolute', top: 4, bottom: 4, borderRadius: 12, overflow: 'hidden',
  },
  ongletPastilleBord: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(6,182,212,0.45)',
  },
  ongletBtn:      { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  ongletTxt:      { color: '#374151', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  ongletTxtActif: {
    color: C.textPrimary, fontWeight: '900',
    textShadowColor: 'rgba(6,182,212,0.5)', textShadowRadius: 8,
  },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  // Bannière
  banniere: {
    borderRadius: 18, borderWidth: 1,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 16, overflow: 'hidden',
  },
  banniereAccent:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  banniereMedaille:  { fontSize: 24 },
  banniereLabel:     { color: '#374151', fontSize: 9, letterSpacing: 2.5, fontWeight: '800' },
  bannierePseudo:    { color: C.textPrimary, fontSize: 17, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 },
  banniereRight:     { alignItems: 'flex-end' },
  banniereVal:       { fontSize: 21, fontWeight: '900' },
  banniereValLabel:  { color: '#4b5563', fontSize: 10, letterSpacing: 1 },
  banniereRangLabel: { color: '#1f2937', fontSize: 10, letterSpacing: 1, marginTop: 2 },

  // Podium
  podiumConteneur: { marginBottom: 24 },
  podiumTitre: {
    color: '#1a3050', fontSize: 11, letterSpacing: 6,
    textAlign: 'center', marginBottom: 14, fontWeight: '800',
  },
  podiumRangee:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  podiumColonne:   { flex: 1, alignItems: 'center' },
  podiumCouronne:  { fontSize: 22, marginBottom: 2 },
  podiumMedaille:  { fontSize: 28, marginBottom: 8, textShadowColor: 'rgba(255,215,0,0.35)', textShadowRadius: 10 },
  podiumCarte:     { width: '100%', borderRadius: 16, borderWidth: 1, overflow: 'hidden', position: 'relative', minHeight: 150 },
  podiumBarre:     { position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.14 },
  podiumCarteInner:{ padding: 10, alignItems: 'center', zIndex: 1 },
  podiumAvatar:    { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  podiumAvatarTxt: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  podiumPseudo:    { fontSize: 11, fontWeight: '900', letterSpacing: 0.3, textAlign: 'center', width: '100%' },
  podiumPts:       { fontSize: 17, fontWeight: '900', marginTop: 5 },
  podiumPtsLabel:  { color: '#374151', fontSize: 8, letterSpacing: 2 },
  podiumSub:       { color: '#1f2937', fontSize: 8, marginTop: 5, letterSpacing: 0.4, textAlign: 'center' },
  podiumLueur:     { position: 'absolute', bottom: -35, alignSelf: 'center', width: 50, height: 50, borderRadius: 25, opacity: 0.18 },

  // Recherche
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#080d1a', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12, height: 42,
  },
  searchIcone: { fontSize: 13, marginRight: 6 },
  searchInput: { flex: 1, color: C.textPrimary, fontSize: 14, height: 42 },
  searchClear: { color: '#374151', fontSize: 14, paddingHorizontal: 4 },
  triBtn:      { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#080d1a' },
  triBtnActif: { borderColor: 'rgba(6,182,212,0.45)', backgroundColor: 'rgba(6,182,212,0.07)' },
  triTxt:      { color: '#374151', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  triTxtActif: { color: '#06b6d4' },

  // Carte
  carte: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, padding: 14, borderWidth: 1,
    overflow: 'hidden', position: 'relative',
  },
  carteMoi:      { borderColor: 'rgba(139,92,246,0.45)' },
  carteAccent:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  carteRang:     { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  carteRangEmoji:{ fontSize: 22 },
  carteRangNum:  { color: '#374151', fontSize: 14, fontWeight: '900' },
  carteAvatar:   { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  carteAvatarTxt:{ fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  carteInfo:     { flex: 1, minWidth: 0 },
  carteInfoLigne:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cartePseudo:   { color: C.textPrimary, fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: 0.3 },
  carteStats:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sep:           { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  cartePts:      { alignItems: 'flex-end', minWidth: 58 },
  cartePtsVal:   { color: C.textPrimary, fontSize: 17, fontWeight: '900' },
  cartePtsLabel: { color: '#1f2937', fontSize: 9, letterSpacing: 2, marginTop: 1 },

  // Badge
  badge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1 },
  badgeTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },

  // Barre win-rate
  barreTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  barreFill:  { height: '100%', borderRadius: 2 },

  // MiniStat
  miniStat:      { alignItems: 'center' },
  miniStatVal:   { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
  miniStatLabel: { color: '#1f2937', fontSize: 8, letterSpacing: 1, marginTop: 1 },

  // États
  etatCentre:        { alignItems: 'center', paddingTop: 64, paddingHorizontal: 24 },
  etatEmoji:         { fontSize: 52, marginBottom: 16 },
  etatTitre:         { color: C.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 8, textAlign: 'center', letterSpacing: 1 },
  etatTexte:         { color: C.textBody, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btnReessayer:      { borderRadius: 16, overflow: 'hidden', minWidth: 160 },
  btnReessayerInner: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  btnReessayerTxt:   { color: C.bgDeep, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});

export default Classement;