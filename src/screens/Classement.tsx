// src/screens/Classement.tsx
// ═══════════════════════════════════════════════════════════════════
//  CLASSEMENT — Version optimisée (tactile réactif)
// ═══════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, Platform, ScrollView,
  ActivityIndicator, RefreshControl, Dimensions,
  TextInput, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';
import { PseudoBadge } from '../components/PseudoBadge';
import { API_URL } from '../config/serveur';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────

type JoueurSoloGlobal = {
  pseudo: string;
  totalPoints: number;
  moyenneEssais: number;
  derniereDate: string;
  niveauMax: number;
  niveauxReussis: number;
};

type JoueurSoloParNiveau = {
  pseudo: string;
  points: number;
  essais: number;
  date: string;
};

type StatutChargement = 'idle' | 'chargement' | 'ok' | 'erreur' | 'hors_ligne';
type SortType = 'pts' | 'az';
type OngletType = 'global' | 'par_niveau';

type Props = {
  onRetour: () => void;
  pseudo?: string;
  onPseudoChange?: (p: string) => void;
};

// ─────────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────────
const TIMEOUT_MS = 6000;

const NIVEAUX_LABELS = ['Débutant', 'Confirmé', 'Expert', 'Légendaire'];
const MEDAILLES = ['🥇', '🥈', '🥉'];
const MEDAILLE_COLORS: [string, string][] = [
  ['#FFD700', '#B8860B'],
  ['#D0D0D8', '#909098'],
  ['#CD7F32', '#8B4513'],
];

const AVATAR_COLORS = [
  '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f59e0b', '#10b981', '#f97316',
];

const NIVEAUX_BOUTONS = [
  { id: 1, label: 'NIV 1', icon: '🌱', color: '#4ade80' },
  { id: 2, label: 'NIV 2', icon: '🌿', color: '#facc15' },
  { id: 3, label: 'NIV 3', icon: '🔥', color: '#f97316' },
  { id: 4, label: 'NIV 4', icon: '👑', color: '#a855f7' },
];

// ─────────────────────────────────────────────────────────────────
//  ANIMATIONS SIMPLIFIÉES (performantes)
// ─────────────────────────────────────────────────────────────────

// Animation d'entrée simple (sans spring lourd)
function useSimpleEntrance(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(15)).current;
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, delay: 0, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(translateY, { toValue: 0, duration: 350, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);
  
  return { opacity, transform: [{ translateY }] };
}

// Animation simple de pulsation (pour le point live uniquement)
function useSimplePulse() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return { opacity };
}

// ─────────────────────────────────────────────────────────────────
//  UTILITAIRES
// ─────────────────────────────────────────────────────────────────
const fetchTimeout = (url: string): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

const avatarColor = (pseudo: string): string => {
  let h = 0;
  for (const c of pseudo) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const initials = (pseudo: string): string =>
  pseudo.substring(0, 2).toUpperCase();

const formatPts = (n: number): string =>
  n >= 10000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();

const niveauLabel = (niveauMax: number): string =>
  NIVEAUX_LABELS[Math.max(0, Math.min(niveauMax - 1, 3))] ?? 'Débutant';

/* ════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
════════════════════════════════════════════════════════════════ */
export const Classement: React.FC<Props> = ({
  onRetour, pseudo = 'Joueur', onPseudoChange,
}) => {
  const [soloDataGlobal, setSoloDataGlobal] = useState<JoueurSoloGlobal[]>([]);
  const [soloDataParNiveau, setSoloDataParNiveau] = useState<JoueurSoloParNiveau[]>([]);
  const [niveauSelectionne, setNiveauSelectionne] = useState<number>(1);
  const [onglet, setOnglet] = useState<OngletType>('global');
  const [statut, setStatut] = useState<StatutChargement>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortType>('pts');

  const headerAnim = useSimpleEntrance(0);
  const contentAnim = useSimpleEntrance(60);

  const chargerClassementGlobal = useCallback(async () => {
    setStatut('chargement');
    try {
      const res = await fetchTimeout(`${API_URL}/api/classement/solo`);
      if (!res.ok) { setStatut('erreur'); return; }
      const data = await res.json() as JoueurSoloGlobal[];
      setSoloDataGlobal(data);
      setStatut('ok');
    } catch (e: any) {
      setStatut(e?.name === 'AbortError' ? 'hors_ligne' : 'erreur');
    }
  }, []);

  const chargerClassementParNiveau = useCallback(async (niveauId: number) => {
    setStatut('chargement');
    try {
      const res = await fetchTimeout(`${API_URL}/api/classement/solo/niveau/${niveauId}`);
      if (!res.ok) { setStatut('erreur'); return; }
      const data = await res.json() as JoueurSoloParNiveau[];
      setSoloDataParNiveau(data);
      setStatut('ok');
    } catch (e: any) {
      setStatut(e?.name === 'AbortError' ? 'hors_ligne' : 'erreur');
    }
  }, []);

  useEffect(() => {
    if (onglet === 'global') {
      chargerClassementGlobal();
    } else {
      chargerClassementParNiveau(niveauSelectionne);
    }
  }, [onglet, niveauSelectionne]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (onglet === 'global') {
      await chargerClassementGlobal();
    } else {
      await chargerClassementParNiveau(niveauSelectionne);
    }
    setRefreshing(false);
  };

  const handleChangerNiveau = (niveauId: number) => {
    setNiveauSelectionne(niveauId);
  };

  const handleChangerOnglet = (newOnglet: OngletType) => {
    setOnglet(newOnglet);
    setSearch('');
  };

  const dataGlobal = soloDataGlobal;
  const dataParNiveau = soloDataParNiveau;
  const maPositionGlobal = dataGlobal.findIndex(j => j.pseudo === pseudo) + 1;
  const maPositionNiveau = dataParNiveau.findIndex(j => j.pseudo === pseudo) + 1;
  const top3Global = dataGlobal.slice(0, 3);
  const top3Niveau = dataParNiveau.slice(0, 3);
  const totalJoueurs = onglet === 'global' ? dataGlobal.length : dataParNiveau.length;
  const maPosition = onglet === 'global' ? maPositionGlobal : maPositionNiveau;

  const dataFiltree = useMemo(() => {
    if (onglet === 'global') {
      let d = [...dataGlobal];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        d = d.filter(j => j.pseudo.toLowerCase().includes(q));
      }
      if (sort === 'az') {
        d = [...d].sort((a, b) => a.pseudo.localeCompare(b.pseudo));
      }
      return d;
    } else {
      let d = [...dataParNiveau];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        d = d.filter(j => j.pseudo.toLowerCase().includes(q));
      }
      if (sort === 'az') {
        d = [...d].sort((a, b) => a.pseudo.localeCompare(b.pseudo));
      }
      return d;
    }
  }, [onglet, dataGlobal, dataParNiveau, search, sort]);

  const niveauInfo = NIVEAUX_BOUTONS.find(n => n.id === niveauSelectionne);

  return (
    <View style={S.root}>
      <LinearGradient
        colors={['#030712', '#060d1f', '#0b1228'] as const}
        style={StyleSheet.absoluteFill}
      />
      <GridFond />

      {/* Header avec animation simple */}
      <Animated.View style={[S.header, { opacity: headerAnim.opacity, transform: headerAnim.transform }]}>
        <TouchableOpacity onPress={onRetour} style={S.backBtn} activeOpacity={0.7}>
          <Text style={S.backBtnText}>←</Text>
        </TouchableOpacity>

        <View style={S.headerMid}>
          <Text style={S.headerTitle}>CLASSEMENT SOLO</Text>
          <View style={S.liveBadge}>
            <PointClignotant />
            <Text style={S.liveText}>
              {statut === 'ok'
                ? `${totalJoueurs} joueur${totalJoueurs > 1 ? 's' : ''} classé${totalJoueurs > 1 ? 's' : ''}`
                : statut === 'chargement' ? 'Chargement...'
                : statut === 'hors_ligne' ? 'Hors ligne'
                : 'Erreur'}
            </Text>
          </View>
        </View>

        <PseudoBadge pseudo={pseudo} onPseudoChange={onPseudoChange} compact />
      </Animated.View>

      {/* Onglets */}
      <View style={S.ongletsContainer}>
        <TouchableOpacity
          style={[S.ongletBtn, onglet === 'global' && S.ongletBtnActif]}
          onPress={() => handleChangerOnglet('global')}
          activeOpacity={0.7}
        >
          <Text style={[S.ongletText, onglet === 'global' && S.ongletTextActif]}>
            🌍 GLOBAL
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.ongletBtn, onglet === 'par_niveau' && S.ongletBtnActif]}
          onPress={() => handleChangerOnglet('par_niveau')}
          activeOpacity={0.7}
        >
          <Text style={[S.ongletText, onglet === 'par_niveau' && S.ongletTextActif]}>
            🎯 PAR NIVEAU
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sélecteur de niveau */}
      {onglet === 'par_niveau' && (
        <Animated.View style={[S.niveauxRow, { opacity: contentAnim.opacity, transform: contentAnim.transform }]}>
          {NIVEAUX_BOUTONS.map((niv) => (
            <TouchableOpacity
              key={niv.id}
              style={[
                S.niveauBtn,
                niveauSelectionne === niv.id && { borderColor: niv.color, backgroundColor: `${niv.color}15` }
              ]}
              onPress={() => handleChangerNiveau(niv.id)}
              activeOpacity={0.7}
            >
              <Text style={S.niveauBtnIcon}>{niv.icon}</Text>
              <Text style={[S.niveauBtnLabel, niveauSelectionne === niv.id && { color: niv.color, fontWeight: '900' }]}>
                {niv.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      <Animated.View style={[{ flex: 1 }, { opacity: contentAnim.opacity }]}>
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
          {statut === 'chargement' ? (
            <EcranChargement />
          ) : (
            <>
              {/* Bannière ma position */}
              {statut === 'ok' && maPosition > 0 && (
                <BannierePosition
                  pseudo={pseudo}
                  position={maPosition}
                  total={totalJoueurs}
                  isGlobal={onglet === 'global'}
                  dataGlobal={onglet === 'global' ? dataGlobal.find(j => j.pseudo === pseudo) ?? null : null}
                  dataNiveau={onglet === 'par_niveau' ? dataParNiveau.find(j => j.pseudo === pseudo) ?? null : null}
                  niveauActuel={niveauSelectionne}
                />
              )}

              {/* Podium Top 3 */}
              {statut === 'ok' && (onglet === 'global' ? top3Global.length >= 1 : top3Niveau.length >= 1) && (
                <Podium
                  data={onglet === 'global' ? top3Global : top3Niveau}
                  pseudo={pseudo}
                  isGlobal={onglet === 'global'}
                />
              )}

              {/* Barre recherche + tri */}
              {statut === 'ok' && dataFiltree.length > 0 && (
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
                  <BoutonTri label="A–Z" actif={sort === 'az'} onPress={() => setSort('az')} />
                </View>
              )}

              {/* États */}
              {statut === 'hors_ligne' && (
                <EcranEtat
                  emoji="📡" titre="Hors ligne"
                  texte="Impossible de joindre le serveur. Vérifie ta connexion internet."
                  onReessayer={onRefresh}
                />
              )}
              {statut === 'erreur' && (
                <EcranEtat
                  emoji="⚠️" titre="Erreur serveur"
                  texte="Le serveur a retourné une erreur."
                  onReessayer={onRefresh}
                />
              )}
              {statut === 'ok' && dataFiltree.length === 0 && (
                <EcranEtat
                  emoji="🏆" titre="Aucun résultat"
                  texte={search ? `Aucun joueur pour "${search}".` : 'Aucun joueur classé pour ce niveau.'}
                />
              )}

              {/* Liste des cartes */}
              {statut === 'ok' && dataFiltree.map((joueur: any, i: number) => {
                const posReelle = onglet === 'global'
                  ? dataGlobal.findIndex(j => j.pseudo === joueur.pseudo) + 1
                  : dataParNiveau.findIndex(j => j.pseudo === joueur.pseudo) + 1;
                
                if (onglet === 'global') {
                  const j = joueur as JoueurSoloGlobal;
                  return (
                    <CarteClassementGlobal
                      key={j.pseudo}
                      joueur={j}
                      position={posReelle}
                      estMoi={j.pseudo === pseudo}
                      index={i}
                    />
                  );
                } else {
                  const j = joueur as JoueurSoloParNiveau;
                  return (
                    <CarteClassementNiveau
                      key={j.pseudo}
                      joueur={j}
                      position={posReelle}
                      estMoi={j.pseudo === pseudo}
                      index={i}
                      niveau={niveauSelectionne}
                    />
                  );
                }
              })}
            </>
          )}
          <View style={{ height: 48 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

/* ════════════════════════════════════════════════════════════════
   GRILLE DE FOND (statique)
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
  const { opacity } = useSimplePulse();
  return <Animated.View style={[S.pointVert, { opacity }]} />;
};

/* ════════════════════════════════════════════════════════════════
   BANNIÈRE POSITION
════════════════════════════════════════════════════════════════ */
const BannierePosition: React.FC<{
  pseudo: string; position: number; total: number;
  isGlobal: boolean; dataGlobal: any; dataNiveau: any; niveauActuel: number;
}> = ({ pseudo, position, total, isGlobal, dataGlobal, dataNiveau, niveauActuel }) => {
  const entrance = useSimpleEntrance(0);
  const isPodium = position <= 3;
  const medaille = isPodium ? MEDAILLES[position - 1] : null;
  const accentCoul = isPodium ? MEDAILLE_COLORS[position - 1][0] : '#8b5cf6';
  const niveauInfo = NIVEAUX_BOUTONS.find(n => n.id === niveauActuel);

  return (
    <Animated.View style={[entrance, { marginBottom: 16 }]}>
      <LinearGradient
        colors={isPodium ? ['#1c1a08', '#0d1520'] : ['#110d22', '#090d1e'] as const}
        style={[S.banniere, { borderColor: `${accentCoul}40` }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={[S.banniereAccent, { backgroundColor: accentCoul }]} />
        <Text style={S.banniereMedaille}>{medaille ?? `#${position}`}</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.banniereLabel}>MA POSITION</Text>
          <Text style={S.bannierePseudo} numberOfLines={1}>{pseudo}</Text>
          {!isGlobal && niveauInfo && (
            <Text style={S.banniereNiveau}>{niveauInfo.icon} Niveau {niveauActuel}</Text>
          )}
        </View>
        <View style={S.banniereRight}>
          {isGlobal && dataGlobal && (
            <>
              <Text style={[S.banniereVal, { color: accentCoul }]}>{formatPts(dataGlobal.totalPoints)}</Text>
              <Text style={S.banniereValLabel}>points</Text>
            </>
          )}
          {!isGlobal && dataNiveau && (
            <>
              <Text style={[S.banniereVal, { color: accentCoul }]}>{dataNiveau.points.toLocaleString()}</Text>
              <Text style={S.banniereValLabel}>pts</Text>
              <Text style={S.banniereEssais}>en {dataNiveau.essais} essais</Text>
            </>
          )}
          <Text style={S.banniereRangLabel}>{position} / {total}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   PODIUM
════════════════════════════════════════════════════════════════ */
const Podium: React.FC<{
  data: any[]; pseudo: string; isGlobal: boolean;
}> = ({ data, pseudo, isGlobal }) => {
  if (data.length < 3) {
    return (
      <View style={S.podiumConteneur}>
        <Text style={S.podiumTitre}>⬡  TOP {data.length}  ⬡</Text>
        <View style={S.podiumRangeeSimple}>
          {data.map((joueur, i) => (
            <View key={joueur.pseudo} style={S.podiumColonneSimple}>
              <Text style={S.podiumMedailleSimple}>{MEDAILLES[i]}</Text>
              <Text style={S.podiumPseudoSimple}>{joueur.pseudo}{joueur.pseudo === pseudo ? ' ✦' : ''}</Text>
              <Text style={S.podiumPtsSimple}>
                {isGlobal ? formatPts(joueur.totalPoints) : joueur.points}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const ordre = [data[1], data[0], data[2]];
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
          const [c1] = MEDAILLE_COLORS[rang - 1];
          
          let pts: number, sub: string;
          if (isGlobal) {
            pts = joueur.totalPoints;
            sub = `${joueur.niveauxReussis}/4 niveaux • moy. ${joueur.moyenneEssais}`;
          } else {
            pts = joueur.points;
            sub = `${joueur.essais} essais`;
          }
          
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
  joueur: any; rang: number; isMe: boolean;
  pts: number; sub: string; couleur: string;
  hauteur: number; delay: number;
}> = ({ joueur, rang, isMe, pts, sub, couleur, hauteur, delay }) => {
  const entrance = useSimpleEntrance(delay);

  return (
    <Animated.View style={[S.podiumColonne, entrance]}>
      {rang === 1 && <Text style={S.podiumCouronne}>👑</Text>}
      <Text style={S.podiumMedaille}>{MEDAILLES[rang - 1]}</Text>
      <LinearGradient
        colors={[`${couleur}20`, `${couleur}08`] as const}
        style={[S.podiumCarte, { borderColor: `${couleur}50` }]}
      >
        <LinearGradient
          colors={[couleur, `${couleur}44`] as const}
          style={[S.podiumBarre, { height: hauteur }]}
          start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }}
        />
        <View style={S.podiumCarteInner}>
          <View style={[S.podiumAvatar, {
            backgroundColor: avatarColor(joueur.pseudo) + '28',
            borderColor: avatarColor(joueur.pseudo) + '60',
          }]}>
            <Text style={[S.podiumAvatarTxt, { color: avatarColor(joueur.pseudo) }]}>
              {initials(joueur.pseudo)}
            </Text>
          </View>
          <Text style={[S.podiumPseudo, { color: couleur }]} numberOfLines={1}>
            {joueur.pseudo}{isMe ? ' ✦' : ''}
          </Text>
          <Text style={[S.podiumPts, { color: couleur }]}>{typeof pts === 'number' ? formatPts(pts) : pts}</Text>
          <Text style={S.podiumPtsLabel}>{typeof pts === 'number' && pts >= 1000 ? 'pts' : ''}</Text>
          <Text style={S.podiumSub} numberOfLines={2}>{sub}</Text>
        </View>
        <View style={[S.podiumLueur, { backgroundColor: couleur }]} />
      </LinearGradient>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   CARTE CLASSEMENT GLOBAL
════════════════════════════════════════════════════════════════ */
const CarteClassementGlobal: React.FC<{
  joueur: JoueurSoloGlobal; position: number; estMoi: boolean; index: number;
}> = ({ joueur, position, estMoi, index }) => {
  const entrance = useSimpleEntrance(Math.min(index * 40, 400));
  const isPodium = position <= 3;
  const [coul] = isPodium ? MEDAILLE_COLORS[position - 1] : ['#06b6d4', ''];
  const accentCoul = estMoi ? '#8b5cf6' : isPodium ? coul : '#1e3a5c';
  const label = niveauLabel(joueur.niveauMax);
  const niveauCoul = joueur.niveauMax >= 4 ? '#FFD700'
    : joueur.niveauMax >= 3 ? '#8b5cf6'
    : joueur.niveauMax >= 2 ? '#06b6d4'
    : '#4b5563';

  return (
    <Animated.View style={[entrance, { marginBottom: 8 }]}>
      <TouchableOpacity activeOpacity={0.7}>
        <LinearGradient
          colors={estMoi ? ['#150e28', '#0e0d1e'] : isPodium ? ['#141820', '#0c1018'] : ['#0e1320', '#080c18'] as const}
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
            borderColor: avatarColor(joueur.pseudo) + '50',
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
              <View style={[S.badge, { backgroundColor: `${niveauCoul}18`, borderColor: `${niveauCoul}40` }]}>
                <Text style={[S.badgeTxt, { color: niveauCoul }]}>{label.toUpperCase()}</Text>
              </View>
            </View>
            <View style={S.carteStats}>
              <MiniStat val={`${joueur.niveauxReussis}/4`} label="niveaux" />
              <View style={S.sep} />
              <MiniStat val={`${joueur.moyenneEssais}`} label="moy. essais" />
            </View>
          </View>
          <View style={S.cartePts}>
            <Text style={[S.cartePtsVal, isPodium && { color: coul }]}>{formatPts(joueur.totalPoints)}</Text>
            <Text style={S.cartePtsLabel}>PTS</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ════════════════════════════════════════════════════════════════
   CARTE CLASSEMENT PAR NIVEAU
════════════════════════════════════════════════════════════════ */
const CarteClassementNiveau: React.FC<{
  joueur: JoueurSoloParNiveau; position: number; estMoi: boolean; index: number; niveau: number;
}> = ({ joueur, position, estMoi, index, niveau }) => {
  const entrance = useSimpleEntrance(Math.min(index * 40, 400));
  const isPodium = position <= 3;
  const [coul] = isPodium ? MEDAILLE_COLORS[position - 1] : ['#06b6d4', ''];
  const accentCoul = estMoi ? '#8b5cf6' : isPodium ? coul : '#1e3a5c';
  const niveauInfo = NIVEAUX_BOUTONS.find(n => n.id === niveau);
  const niveauColor = niveauInfo?.color || '#06b6d4';

  const getPerformance = (essais: number, niveauId: number) => {
    const limites = { 1: { excellent: 3, bien: 6 }, 2: { excellent: 2, bien: 4 }, 3: { excellent: 1, bien: 3 }, 4: { excellent: 1, bien: 2 } };
    const lim = limites[niveauId as keyof typeof limites] || limites[1];
    if (essais <= lim.excellent) return { label: 'EXCELLENT', color: '#4ade80' };
    if (essais <= lim.bien) return { label: 'BIEN', color: '#facc15' };
    return { label: 'CORRECT', color: '#f97316' };
  };
  const perf = getPerformance(joueur.essais, niveau);

  return (
    <Animated.View style={[entrance, { marginBottom: 8 }]}>
      <TouchableOpacity activeOpacity={0.7}>
        <LinearGradient
          colors={estMoi ? ['#150e28', '#0e0d1e'] : isPodium ? ['#141820', '#0c1018'] : ['#0e1320', '#080c18'] as const}
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
            borderColor: avatarColor(joueur.pseudo) + '50',
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
              <View style={[S.badge, { backgroundColor: `${perf.color}18`, borderColor: `${perf.color}40` }]}>
                <Text style={[S.badgeTxt, { color: perf.color }]}>{perf.label}</Text>
              </View>
            </View>
            <View style={S.carteStatsNiveau}>
              <MiniStat val={`${joueur.essais}`} label="essais" color={niveauColor} />
              <View style={S.sep} />
              <MiniStat val={new Date(joueur.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} label="date" small />
            </View>
          </View>
          <View style={S.cartePts}>
            <Text style={[S.cartePtsVal, isPodium && { color: coul }]}>{joueur.points.toLocaleString()}</Text>
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
const MiniStat: React.FC<{ val: string; label: string; color?: string; small?: boolean }> = ({ val, label, color, small }) => (
  <View style={S.miniStat}>
    <Text style={[S.miniStatVal, color ? { color } : undefined, small && { fontSize: 10 }]}>{val}</Text>
    <Text style={[S.miniStatLabel, small && { fontSize: 7 }]}>{label}</Text>
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
        <LinearGradient colors={[C.goldDark, C.gold] as const} style={S.btnReessayerInner}>
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
  orbe: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.06 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 18,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(6,182,212,0.12)',
    backgroundColor: 'rgba(3,7,18,0.95)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  headerMid: { flex: 1 },
  headerTitle: {
    color: C.textPrimary, fontSize: 19, fontWeight: '900', letterSpacing: 4,
    textShadowColor: 'rgba(6,182,212,0.5)', textShadowRadius: 10,
  },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveText: { color: '#06b6d4', fontSize: 10, letterSpacing: 2 },
  pointVert: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#06b6d4' },

  ongletsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#0a0f1a',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ongletBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  ongletBtnActif: { backgroundColor: '#1a2a3a' },
  ongletText: { color: '#6b7280', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  ongletTextActif: { color: '#06b6d4' },

  niveauxRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  niveauBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0a0f1a' },
  niveauBtnIcon: { fontSize: 20, marginBottom: 2 },
  niveauBtnLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  banniere: {
    borderRadius: 18, borderWidth: 1,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 16, overflow: 'hidden',
  },
  banniereAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  banniereMedaille: { fontSize: 24 },
  banniereLabel: { color: '#374151', fontSize: 9, letterSpacing: 2.5, fontWeight: '800' },
  bannierePseudo: { color: C.textPrimary, fontSize: 17, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 },
  banniereNiveau: { color: '#9ca3af', fontSize: 10, marginTop: 2 },
  banniereRight: { alignItems: 'flex-end' },
  banniereVal: { fontSize: 21, fontWeight: '900' },
  banniereValLabel: { color: '#4b5563', fontSize: 10, letterSpacing: 1 },
  banniereEssais: { color: '#6b7280', fontSize: 9, marginTop: 2 },
  banniereRangLabel: { color: '#1f2937', fontSize: 10, letterSpacing: 1, marginTop: 2 },

  podiumConteneur: { marginBottom: 24 },
  podiumTitre: { color: '#f7f7f7', fontSize: 11, letterSpacing: 6, textAlign: 'center', marginBottom: 14, fontWeight: '800' },
  podiumRangee: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  podiumColonne: { flex: 1, alignItems: 'center' },
  podiumCouronne: { fontSize: 22, marginBottom: 2 },
  podiumMedaille: { fontSize: 28, marginBottom: 8, textShadowColor: 'rgba(255,215,0,0.35)', textShadowRadius: 10 },
  podiumCarte: { width: '100%', borderRadius: 16, borderWidth: 1, overflow: 'hidden', position: 'relative', minHeight: 150 },
  podiumBarre: { position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.14 },
  podiumCarteInner: { padding: 10, alignItems: 'center', zIndex: 1 },
  podiumAvatar: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  podiumAvatarTxt: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  podiumPseudo: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3, textAlign: 'center', width: '100%' },
  podiumPts: { fontSize: 17, fontWeight: '900', marginTop: 5 },
  podiumPtsLabel: { color: '#e7e9ec', fontSize: 8, letterSpacing: 2 },
  podiumSub: { color: '#dde3eb', fontSize: 8, marginTop: 5, letterSpacing: 0.4, textAlign: 'center' },
  podiumLueur: { position: 'absolute', bottom: -35, alignSelf: 'center', width: 50, height: 50, borderRadius: 25, opacity: 0.18 },
  podiumRangeeSimple: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  podiumColonneSimple: { alignItems: 'center', backgroundColor: '#0a0f1a', borderRadius: 16, padding: 12, minWidth: 80 },
  podiumMedailleSimple: { fontSize: 28, marginBottom: 6 },
  podiumPseudoSimple: { color: C.textPrimary, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  podiumPtsSimple: { color: C.gold, fontSize: 16, fontWeight: '900', marginTop: 4 },

  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#080d1a', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, height: 42 },
  searchIcone: { fontSize: 13, marginRight: 6 },
  searchInput: { flex: 1, color: C.textPrimary, fontSize: 14, height: 42 },
  searchClear: { color: '#374151', fontSize: 14, paddingHorizontal: 4 },
  triBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#080d1a' },
  triBtnActif: { borderColor: 'rgba(6,182,212,0.45)', backgroundColor: 'rgba(6,182,212,0.07)' },
  triTxt: { color: '#374151', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  triTxtActif: { color: '#06b6d4' },

  carte: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  carteMoi: { borderColor: 'rgba(139,92,246,0.45)' },
  carteAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  carteRang: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  carteRangEmoji: { fontSize: 22 },
  carteRangNum: { color: '#374151', fontSize: 14, fontWeight: '900' },
  carteAvatar: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  carteAvatarTxt: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  carteInfo: { flex: 1, minWidth: 0 },
  carteInfoLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cartePseudo: { color: C.textPrimary, fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: 0.3 },
  carteStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  carteStatsNiveau: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sep: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  cartePts: { alignItems: 'flex-end', minWidth: 58 },
  cartePtsVal: { color: C.textPrimary, fontSize: 17, fontWeight: '900' },
  cartePtsLabel: { color: '#fcfafb', fontSize: 9, letterSpacing: 2, marginTop: 1 },

  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1 },
  badgeTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },

  miniStat: { alignItems: 'center' },
  miniStatVal: { color: '#08d204', fontSize: 12, fontWeight: '800' },
  miniStatLabel: { color: '#49e11a', fontSize: 8, letterSpacing: 1, marginTop: 1 },

  etatCentre: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 24 },
  etatEmoji: { fontSize: 52, marginBottom: 16 },
  etatTitre: { color: C.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 8, textAlign: 'center', letterSpacing: 1 },
  etatTexte: { color: C.textBody, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btnReessayer: { borderRadius: 16, overflow: 'hidden', minWidth: 160 },
  btnReessayerInner: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  btnReessayerTxt: { color: C.bgDeep, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});

export default Classement;