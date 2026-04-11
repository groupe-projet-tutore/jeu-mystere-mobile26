// src/screens/MenuPrincipal.tsx
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, StatusBar, Platform, Easing, BackHandler, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';
import { PseudoBadge } from '../components/PseudoBadge';

const { width: W, height: H } = Dimensions.get('window');

type Props = {
  onMenuClick:     (id: string) => void;
  onPseudoChange:  (p: string) => void;
  pseudo:          string;
};

const MENU_ITEMS = [
  { id:'solo',       icon:'🎯', title:'SOLO',      sub:'Mode entraînement', desc:"Affronte l'ordinateur sur 4 niveaux", grad:['#0d2554','#1a4fd6'] as [string,string], accent:'#4d8af0', tag:'4 NIVEAUX'   },
  { id:'duel',       icon:'⚔️', title:'DUEL',      sub:'1 contre 1',        desc:'Défie tes amis en temps réel',        grad:['#240d52','#6d28d9'] as [string,string], accent:'#9d5ff5', tag:'MULTIJOUEUR' },
  { id:'classement', icon:'🏆', title:'Classement',    sub:'Classement global', desc:'Compare ta position dans le top',     grad:['#3d2000','#b07d0e'] as [string,string], accent:'#f5a623', tag:'GLOBAL'       },
  { id:'profil',     icon:'👤', title:'PROFIL',    sub:'Tes statistiques',  desc:'Progression, records et badges',      grad:['#03200e','#0f7a42'] as [string,string], accent:'#2ecc7a', tag:'STATS'        },
];

export const MenuPrincipal: React.FC<Props> = ({ onMenuClick, onPseudoChange, pseudo }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const glowAnim  = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  // ✅ Quitter l'application complètement
  const handleQuitter = () => {
    if (Platform.OS === 'android') {
      Alert.alert(
        'Quitter le jeu',
        'Veux-tu vraiment fermer l\'application ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Quitter', style: 'destructive', onPress: () => BackHandler.exitApp() },
        ],
        { cancelable: true }
      );
    } else {
      // iOS : on ne peut pas forcer la fermeture — on affiche juste un message
      Alert.alert(
        'Quitter le jeu',
        'Sur iPhone, ferme l\'application en glissant vers le haut depuis le bas de l\'écran.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={[C.bgDeep, C.bg, '#0d1628']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[S.bgGlow, { opacity: glowAnim }]} />

      <Animated.View style={[S.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Header ── */}
        <View style={S.header}>
          <View style={S.logoSmall}>
            <LinearGradient colors={[C.goldDark, C.gold]} style={S.logoSmallGrad}>
              <Text style={{ fontSize: 20 }}>🎯</Text>
            </LinearGradient>
          </View>
          <View style={S.headerCenter}>
            <Text style={S.headerEye}>BIENVENUE</Text>
            <Text style={S.headerName} numberOfLines={1}>{pseudo}</Text>
          </View>
          {/* ✅ PseudoBadge cliquable — modale de modification */}
          <PseudoBadge
            pseudo={pseudo}
            onPseudoChange={onPseudoChange}
            compact
          />
        </View>

        {/* ── Sous-titre ── */}
        <View style={S.subHeader}>
          <Text style={S.subTitle}>Menu Principal</Text>
          <View style={S.subLine} />
        </View>

        {/* ── Grille 2×2 ── */}
        <View style={S.grid}>
          {MENU_ITEMS.map((item, i) => (
            <MenuCard key={item.id} item={item} index={i} onPress={() => onMenuClick(item.id)} />
          ))}
        </View>

       
      </Animated.View>
    </View>
  );
};

// ── Carte menu ─────────────────────────────────────────────────────
type CardItem = typeof MENU_ITEMS[0];
const MenuCard: React.FC<{ item: CardItem; index: number; onPress: () => void }> = ({ item, index, onPress }) => {
  const entryScale   = useRef(new Animated.Value(0.88)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const pressScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(entryScale,   { toValue: 1, delay: index * 80, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.timing(entryOpacity, { toValue: 1, delay: index * 80, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn  = () => Animated.spring(pressScale, { toValue: 0.96, friction: 8, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(pressScale, { toValue: 1,    friction: 6, useNativeDriver: true }).start();

  const cardH = Math.max(158, Math.min(195, (H - 420) / 2));

  return (
    <Animated.View style={[S.cardWrapper, { opacity: entryOpacity, transform: [{ scale: entryScale }] }]}>
      <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
        <Animated.View style={{ transform: [{ scale: pressScale }] }}>
          <LinearGradient colors={item.grad} style={[S.card, { height: cardH }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={[S.cardDecoBg, { backgroundColor: `${item.accent}14` }]} />
            <View style={S.cardTop}>
              <View style={[S.cardTagPill, { borderColor: `${item.accent}55` }]}>
                <Text style={[S.cardTagText, { color: item.accent }]}>{item.tag}</Text>
              </View>
              <Text style={S.cardIcon}>{item.icon}</Text>
            </View>
            <View>
              <Text style={S.cardTitle}>{item.title}</Text>
              <Text style={S.cardSub}>{item.sub}</Text>
            </View>
            <View style={[S.cardDivider, { backgroundColor: `${item.accent}40` }]} />
            <View style={S.cardBottom}>
              <Text style={S.cardDesc} numberOfLines={1}>{item.desc}</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bgGlow: {
    position: 'absolute', width: W * 0.9, height: W * 0.9,
    borderRadius: W * 0.45, backgroundColor: C.gold, opacity: 0.04,
    top: -W * 0.2, alignSelf: 'center',
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 18, paddingBottom: 16,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  logoSmall: { borderRadius: 14, overflow: 'hidden' },
  logoSmallGrad: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerEye:  { fontSize: 11, fontWeight: '700', color: C.textSecond, letterSpacing: 3 },
  headerName: { fontSize: 22, fontWeight: '900', color: C.textPrimary, letterSpacing: 0.5 },

  // Sous-titre
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  subTitle:  { fontSize: 17, fontWeight: '700', color: C.textBody },
  subLine:   { flex: 1, height: 1, backgroundColor: C.border },

  // Grille
  grid: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', alignContent: 'center',
    gap: 12, marginBottom: 16,
  },
  cardWrapper: { width: (W - 48) / 2 },
  card: {
    borderRadius: 22, padding: 16, overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  cardDecoBg: { position: 'absolute', width: 100, height: 100, borderRadius: 50, top: -24, right: -24 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTagPill: { backgroundColor: '#00000025', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  cardTagText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  cardIcon:    { fontSize: 28 },
  cardTitle:   { fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },
  cardSub:     { fontSize: 12, color: '#ffffffcc', fontWeight: '600', marginTop: 2 },
  cardDivider: { height: 1, marginVertical: 8 },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDesc:    { fontSize: 10, color: '#ffffffcc', flex: 1, fontWeight: '500', marginRight: 6 },
  cardArrowCircle: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardArrow:   { fontSize: 16, fontWeight: '700' },
  
});

export default MenuPrincipal;