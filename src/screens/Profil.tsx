// src/screens/Profil.tsx
// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN PROFIL UTILISATEUR — Version Premium Multilingue
//  - Support Français, Anglais, Somali, Arabe
//  - Statistiques complètes (solo / duel / streak)
//  - Badges dynamiques avec conditions de déblocage
//  - Historique des parties
//  - Personnalisation : avatar, thème, pseudo
//  - Synchronisation complète avec le serveur
//  - Design moderne, animations fluides
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Alert, TextInput, Modal, Dimensions, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../config/serveur';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTES & CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const AVATARS = ['🦊', '🦅', '🐺', '🐯', '🦁', '🐉', '👾', '🎭', '🤖', '🎯'];
const THEMES = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#378ADD'];

const BADGE_WIDTH = (SCREEN_WIDTH - 44) / 2;

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

type StatistiquesJoueur = {
  parties_jouees: number;
  victoires: number;
  defaites: number;
  niveau_max: number;
  points_solo: number;
  points_duel: number;
  meilleur_score: number | null;
  streak: number;
  duels_joues: number;
  duels_gagnes: number;
  meilleure_serie: number;
};

type PartieHistorique = {
  id: number;
  mode: string;
  niveau: number;
  adversaire: string | null;
  resultat: string;
  tentatives: number;
  points: number;
  date: string;
};

type Badge = {
  id: string;
  nom: string;
  description: string;
  icone: string;
  debloque: boolean;
};

type Props = {
  pseudo: string;
  onRetour: () => void;
  onPseudoChange?: (nouveauPseudo: string) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
//  COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export const Profil: React.FC<Props> = ({ pseudo: pseudoProp, onRetour, onPseudoChange }) => {
  const { t } = useTranslation();
  
  // ── États ──────────────────────────────────────────────────────────────────
  const [statistiques, setStatistiques] = useState<StatistiquesJoueur | null>(null);
  const [historique, setHistorique] = useState<PartieHistorique[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [themeIndex, setThemeIndex] = useState(0);
  const [modalPseudoVisible, setModalPseudoVisible] = useState(false);
  const [langueModalVisible, setLangueModalVisible] = useState(false);
  const [nouveauPseudo, setNouveauPseudo] = useState(pseudoProp);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreurReseau, setErreurReseau] = useState<string | null>(null);
  const [pseudoAffiche, setPseudoAffiche] = useState(pseudoProp);

  // ── Animations ─────────────────────────────────────────────────────────────
  const animationFondu = useRef(new Animated.Value(0)).current;
  const couleurTheme = THEMES[themeIndex];

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    setPseudoAffiche(pseudoProp);
    setNouveauPseudo(pseudoProp);
    chargerPreferences();
    chargerDonnees();
    Animated.timing(animationFondu, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [pseudoProp]);

  // ── Synchronisation des préférences (avatar, thème) ────────────────────────
  const synchroniserPreferences = useCallback(async (avatar: number | null, theme: number | null) => {
    try {
      const payload: any = { pseudo: pseudoProp };
      if (avatar !== null) payload.avatar_idx = avatar;
      if (theme !== null) payload.theme_idx = theme;

      await fetch(`${API_URL}/sync_preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Échec silencieux
    }
  }, [pseudoProp]);

  // ── Chargement des préférences (avatar, thème) ─────────────────────────────
  const chargerPreferences = useCallback(async () => {
    try {
      const pseudoEncoded = encodeURIComponent(pseudoProp);
      const reponse = await fetch(`${API_URL}/get_preferences?pseudo=${pseudoEncoded}`);

      if (reponse.ok) {
        const donnees = await reponse.json();
        setAvatarIndex(donnees.avatar_idx ?? 0);
        setThemeIndex(donnees.theme_idx ?? 0);
      } else {
        const avatarStocke = await AsyncStorage.getItem('profil_avatar');
        const themeStocke = await AsyncStorage.getItem('profil_theme');
        if (avatarStocke) setAvatarIndex(parseInt(avatarStocke));
        if (themeStocke) setThemeIndex(parseInt(themeStocke));
      }
    } catch {
      const avatarStocke = await AsyncStorage.getItem('profil_avatar');
      const themeStocke = await AsyncStorage.getItem('profil_theme');
      if (avatarStocke) setAvatarIndex(parseInt(avatarStocke));
      if (themeStocke) setThemeIndex(parseInt(themeStocke));
    }
  }, [pseudoProp]);

  // ── Changement d'avatar ────────────────────────────────────────────────────
  const changerAvatar = useCallback(async () => {
    const prochain = (avatarIndex + 1) % AVATARS.length;
    setAvatarIndex(prochain);
    await AsyncStorage.setItem('profil_avatar', String(prochain));
    synchroniserPreferences(prochain, null);
  }, [avatarIndex, synchroniserPreferences]);

  // ── Changement de thème ────────────────────────────────────────────────────
  const changerTheme = useCallback(async (index: number) => {
    setThemeIndex(index);
    await AsyncStorage.setItem('profil_theme', String(index));
    synchroniserPreferences(null, index);
  }, [synchroniserPreferences]);

  // ── Chargement des données (stats, historique, badges) ─────────────────────
  const chargerDonnees = useCallback(async (estRafraichissement = false) => {
    if (!estRafraichissement) setChargement(true);
    setErreurReseau(null);

    try {
      const pseudoEncoded = encodeURIComponent(pseudoProp);

      const reponseStats = await fetch(`${API_URL}/stats?pseudo=${pseudoEncoded}`);
      if (reponseStats.ok) {
        const donneesStats = await reponseStats.json();
        setStatistiques(donneesStats);
      } else {
        setStatistiques({
          parties_jouees: 0,
          victoires: 0,
          defaites: 0,
          niveau_max: 1,
          points_solo: 0,
          points_duel: 0,
          meilleur_score: null,
          streak: 0,
          duels_joues: 0,
          duels_gagnes: 0,
          meilleure_serie: 0,
        });
      }

      const reponseHistorique = await fetch(`${API_URL}/historique?pseudo=${pseudoEncoded}&limit=10`);
      if (reponseHistorique.ok) {
        const donneesHistorique = await reponseHistorique.json();
        setHistorique(donneesHistorique.historique || []);
      } else {
        setHistorique([]);
      }

      const reponseBadges = await fetch(`${API_URL}/badges?pseudo=${pseudoEncoded}`);
      if (reponseBadges.ok) {
        const donneesBadges = await reponseBadges.json();
        setBadges(donneesBadges || []);
      } else {
        setBadges([]);
      }
    } catch {
      setErreurReseau(t('profil.connection_error'));
      setStatistiques({
        parties_jouees: 0,
        victoires: 0,
        defaites: 0,
        niveau_max: 1,
        points_solo: 0,
        points_duel: 0,
        meilleur_score: null,
        streak: 0,
        duels_joues: 0,
        duels_gagnes: 0,
        meilleure_serie: 0,
      });
      setHistorique([]);
      setBadges([]);
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, [pseudoProp, t]);

  // ── Rafraîchissement manuel ────────────────────────────────────────────────
  const onRafraichir = useCallback(() => {
    setRafraichissement(true);
    chargerDonnees(true);
  }, [chargerDonnees]);

  // ── Changement de pseudo ───────────────────────────────────────────────────
  const validerChangementPseudo = useCallback(async () => {
    const pseudoNet = nouveauPseudo.trim();
    if (!pseudoNet || pseudoNet.length < 3) {
      Alert.alert(t('profil.pseudo_invalid'), t('profil.pseudo_min_length'));
      return;
    }

    if (pseudoNet === pseudoProp) {
      setModalPseudoVisible(false);
      return;
    }

    try {
      const reponse = await fetch(`${API_URL}/update_pseudo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ancien_pseudo: pseudoProp,
          nouveau_pseudo: pseudoNet,
        }),
      });

      if (reponse.ok) {
        setPseudoAffiche(pseudoNet);
        onPseudoChange?.(pseudoNet);
        setModalPseudoVisible(false);
        Alert.alert(t('profil.pseudo_updated'), t('profil.pseudo_updated'));
      } else {
        const erreur = await reponse.json();
        Alert.alert(t('profil.pseudo_invalid'), erreur.error || t('profil.pseudo_already_used'));
      }
    } catch {
      Alert.alert(t('profil.network_error'), t('profil.connection_error'));
    }
  }, [nouveauPseudo, pseudoProp, onPseudoChange, t]);

  // ── Formatage de date ──────────────────────────────────────────────────────
  const formaterDate = useCallback((dateISO: string) => {
    try {
      const date = new Date(dateISO);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateISO;
    }
  }, []);

  // ── Calculs statistiques ───────────────────────────────────────────────────
  const partiesJouees = statistiques?.parties_jouees ?? 0;
  const victoires = statistiques?.victoires ?? 0;
  const tauxVictoire = partiesJouees > 0 ? Math.round((victoires / partiesJouees) * 100) : 0;

  // ── Écran de chargement ────────────────────────────────────────────────────
  if (chargement) {
    return (
      <LinearGradient colors={['#080c18', '#0d1628']} style={Styles.centreChargement}>
        <ActivityIndicator size="large" color={couleurTheme} />
        <Text style={Styles.texteChargement}>{t('profil.loading')}</Text>
      </LinearGradient>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <Animated.View style={[Styles.conteneurPrincipal, { opacity: animationFondu }]}>
      <LinearGradient colors={['#080c18', '#0d1628']} style={StyleSheet.absoluteFill} />

      {/* En-tête */}
      <View style={[Styles.enTete, { borderBottomColor: `${couleurTheme}44` }]}>
        <TouchableOpacity onPress={onRetour} style={Styles.boutonRetour} activeOpacity={0.7}>
          <Text style={Styles.texteRetour}>←</Text>
        </TouchableOpacity>
        <Text style={Styles.titreEnTete}>{t('profil.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={Styles.conteneurScroll}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={onRafraichir}
            tintColor={couleurTheme}
            colors={[couleurTheme]}
          />
        }
      >
        {/* Bannière d'erreur */}
        {erreurReseau && (
          <View style={Styles.banniereErreur}>
            <Text style={Styles.texteErreur}>{erreurReseau}</Text>
          </View>
        )}

        {/* Section Avatar et identité */}
        <LinearGradient colors={['#111827', '#0f1420']} style={Styles.sectionAvatar}>
          <TouchableOpacity onPress={changerAvatar} style={[Styles.avatar, { borderColor: couleurTheme }]} activeOpacity={0.8}>
            <Text style={Styles.emojiAvatar}>{AVATARS[avatarIndex]}</Text>
            <View style={Styles.badgeEditionAvatar}>
              <Text style={Styles.texteBadgeEdition}>✏️</Text>
            </View>
          </TouchableOpacity>

          <View style={Styles.colonneIdentite}>
            <Text style={Styles.pseudoTexte}>{pseudoAffiche}</Text>
            <TouchableOpacity onPress={() => setModalPseudoVisible(true)} activeOpacity={0.7}>
              <Text style={[Styles.lienModifierPseudo, { color: couleurTheme }]}>{t('profil.edit_pseudo')}</Text>
            </TouchableOpacity>
            <View style={Styles.ligneThemes}>
              {THEMES.map((couleur, index) => (
                <TouchableOpacity
                  key={couleur}
                  style={[
                    Styles.cercleTheme,
                    { backgroundColor: couleur },
                    themeIndex === index && Styles.cercleThemeActif,
                  ]}
                  onPress={() => changerTheme(index)}
                  activeOpacity={0.8}
                />
              ))}
            </View>
            {/* Bouton langue */}
            <TouchableOpacity
              onPress={() => setLangueModalVisible(true)}
              style={[Styles.langueBtn, { borderColor: couleurTheme }]}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[couleurTheme + '20', couleurTheme + '08']}
                style={Styles.langueBtnGrad}
              >
                <Text style={Styles.langueBtnIcon}>🌐</Text>
                <Text style={[Styles.langueBtnText, { color: couleurTheme }]}>
                  {t('profil.language')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={[Styles.badgeNiveau, { backgroundColor: `${couleurTheme}22` }]}>
            <Text style={[Styles.chiffreNiveau, { color: couleurTheme }]}>{statistiques?.niveau_max || 1}</Text>
            <Text style={[Styles.libelleNiveau, { color: couleurTheme }]}>{t('profil.max_level')}</Text>
          </View>
        </LinearGradient>

        {/* Streak */}
        <LinearGradient colors={['#1a1200', '#0f0e1a']} style={Styles.banniereStreak}>
          <Text style={Styles.iconeStreak}>🔥</Text>
          <View style={Styles.colonneStreak}>
            <Text style={Styles.titreStreak}>{t('profil.current_streak')}</Text>
            <Text style={Styles.sousTitreStreak}>{t('profil.streak_days')}</Text>
          </View>
          <Text style={Styles.valeurStreak}>{statistiques?.streak || 0}</Text>
        </LinearGradient>

        {/* Statistiques - Layout 2 colonnes */}
        <Text style={Styles.titreSection}>{t('profil.stats_title')}</Text>
        <View style={Styles.statsContainer}>
          {/* Colonne gauche */}
          <View style={Styles.statsColonne}>
            <View style={Styles.statCard}>
              <Text style={Styles.statVal}>{partiesJouees}</Text>
              <Text style={Styles.statLbl}>{t('profil.games_played')}</Text>
            </View>
            <View style={Styles.statCard}>
              <Text style={[Styles.statVal, { color: '#1D9E75' }]}>{victoires}</Text>
              <Text style={Styles.statLbl}>{t('profil.wins')}</Text>
            </View>
            <View style={Styles.statCard}>
              <Text style={[Styles.statVal, { color: '#D85A30' }]}>{statistiques?.defaites || 0}</Text>
              <Text style={Styles.statLbl}>{t('profil.losses')}</Text>
            </View>
            <View style={Styles.statCard}>
              <Text style={[Styles.statVal, { color: couleurTheme }]}>{tauxVictoire}%</Text>
              <Text style={Styles.statLbl}>{t('profil.win_rate')}</Text>
            </View>
          </View>

          {/* Colonne droite */}
          <View style={Styles.statsColonne}>
            
            <View style={Styles.statCard}>
              <Text style={Styles.statVal}>{statistiques?.duels_joues || 0}</Text>
              <Text style={Styles.statLbl}>{t('profil.duels_played')}</Text>
            </View>
            <View style={Styles.statCard}>
              <Text style={[Styles.statVal, { color: '#4d8af0' }]}>{statistiques?.points_solo || 0}</Text>
              <Text style={Styles.statLbl}>{t('profil.solo_points')}</Text>
            </View>
            <View style={Styles.statCard}>
              <Text style={[Styles.statVal, { color: '#9d5ff5' }]}>{statistiques?.points_duel || 0}</Text>
              <Text style={Styles.statLbl}>{t('profil.duel_points')}</Text>
            </View>
            <View style={Styles.statCard}>
              <Text style={[Styles.statVal, { color: '#FAC775' }]}>{statistiques?.meilleure_serie || 0}</Text>
              <Text style={Styles.statLbl}>{t('profil.best_streak')}</Text>
            </View>
          </View>
        </View>

        {/* Badges */}
        <Text style={Styles.titreSection}>{t('profil.badges_title')}</Text>
        <View style={Styles.grilleBadges}>
          {badges.length === 0 ? (
            <Text style={Styles.texteVide}>{t('profil.no_badges')}</Text>
          ) : (
            badges.map((badge) => (
              <LinearGradient
                key={badge.id}
                colors={badge.debloque ? ['#111827', '#1a1a2e'] : ['#0f0f1a', '#0a0a14']}
                style={[Styles.carteBadge, !badge.debloque && Styles.carteBadgeVerrouillee]}
              >
                <View style={[Styles.iconeBadge, { backgroundColor: badge.debloque ? '#2ecc7a20' : '#333' }]}>
                  <Text style={Styles.emojiBadge}>{badge.icone}</Text>
                </View>
                <View style={Styles.colonneBadge}>
                  <Text style={Styles.titreBadge}>{badge.nom}</Text>
                  <Text style={Styles.descriptionBadge}>{badge.description}</Text>
                </View>
              </LinearGradient>
            ))
          )}
        </View>

        {/* Historique */}
        <Text style={Styles.titreSection}>{t('profil.history_title')}</Text>
        {historique.length === 0 ? (
          <Text style={[Styles.texteVide, { marginBottom: 12 }]}>{t('profil.no_games')}</Text>
        ) : (
          historique.map((partie) => (
            <LinearGradient key={partie.id} colors={['#111827', '#0f1420']} style={Styles.ligneHistorique}>
              <View style={[Styles.pointHistorique, { backgroundColor: partie.resultat === 'gagne' ? '#1D9E75' : '#D85A30' }]} />
              <View style={Styles.colonneHistorique}>
                <Text style={Styles.modeHistorique}>
                  {partie.mode === 'solo' 
                    ? `${t('profil.solo_level')} ${partie.niveau}` 
                    : `${t('profil.duel_vs')} ${partie.adversaire ?? '?'}`}
                </Text>
                <Text style={Styles.dateHistorique}>{formaterDate(partie.date)}</Text>
              </View>
              <Text style={[Styles.resultatHistorique, { color: partie.resultat === 'gagne' ? '#1D9E75' : '#D85A30' }]}>
                {partie.resultat === 'gagne' ? '✔️' : '❌'} {partie.tentatives} {t('profil.attempts')}
              </Text>
            </LinearGradient>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal modification pseudo */}
      <Modal visible={modalPseudoVisible} transparent animationType="fade">
        <View style={Styles.fondModal}>
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={Styles.boiteModal}>
            <Text style={Styles.titreModal}>{t('profil.edit_pseudo')}</Text>
            <TextInput
              style={[Styles.champPseudo, { borderColor: couleurTheme }]}
              value={nouveauPseudo}
              onChangeText={setNouveauPseudo}
              maxLength={20}
              autoFocus
              placeholderTextColor="#555"
              placeholder={t('profil.edit_pseudo')}
            />
            <View style={Styles.ligneBoutonsModal}>
              <TouchableOpacity style={Styles.boutonAnnulerModal} onPress={() => setModalPseudoVisible(false)} activeOpacity={0.7}>
                <Text style={Styles.texteBoutonAnnulerModal}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[Styles.boutonValiderModal, { backgroundColor: couleurTheme }]} onPress={validerChangementPseudo} activeOpacity={0.7}>
                <Text style={Styles.texteBoutonValiderModal}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Modal sélection langue */}
      <LanguageSwitcher
        visible={langueModalVisible}
        onClose={() => setLangueModalVisible(false)}
      />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────────────────────

const Styles = StyleSheet.create({
  conteneurPrincipal: { flex: 1, backgroundColor: '#080c18' },
  centreChargement: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  texteChargement: { color: '#aaa', fontSize: 16, marginTop: 12 },

  enTete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    backgroundColor: '#111827',
  },
  boutonRetour: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#1a2438' },
  texteRetour: { color: '#fff', fontSize: 22, fontWeight: '600' },
  titreEnTete: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },

  conteneurScroll: { padding: 16, paddingBottom: 40 },

  banniereErreur: { backgroundColor: '#ff444420', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ff4444' },
  texteErreur: { color: '#ff8888', fontSize: 13, textAlign: 'center' },

  sectionAvatar: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 16, marginBottom: 12 },
  avatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, backgroundColor: '#1e2a3a', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  emojiAvatar: { fontSize: 34 },
  badgeEditionAvatar: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#080c18', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff' },
  texteBadgeEdition: { fontSize: 12 },

  colonneIdentite: { flex: 1 },
  pseudoTexte: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  lienModifierPseudo: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  ligneThemes: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cercleTheme: { width: 18, height: 18, borderRadius: 9 },
  cercleThemeActif: { borderColor: '#fff', borderWidth: 2 },

  langueBtn: { borderRadius: 24, overflow: 'hidden', marginTop: 10, alignSelf: 'flex-start' },
  langueBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  langueBtnIcon: { fontSize: 16 },
  langueBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  badgeNiveau: { alignItems: 'center', borderRadius: 12, padding: 10, minWidth: 65 },
  chiffreNiveau: { fontSize: 22, fontWeight: '800' },
  libelleNiveau: { fontSize: 10, marginTop: 2, fontWeight: '700' },

  banniereStreak: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FAC77544' },
  iconeStreak: { fontSize: 32 },
  colonneStreak: { flex: 1, marginLeft: 14 },
  titreStreak: { color: '#FAC775', fontSize: 14, fontWeight: '700' },
  sousTitreStreak: { color: '#9a7a40', fontSize: 11, marginTop: 2 },
  valeurStreak: { color: '#FAC775', fontSize: 32, fontWeight: '800' },

  titreSection: { color: '#9ca3af', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, marginTop: 20, textTransform: 'uppercase' },

  statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statsColonne: { flex: 1, gap: 10 },
  statCard: { backgroundColor: '#111827', borderRadius: 14, padding: 14, alignItems: 'center', width: '100%' },
  statVal: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLbl: { color: '#6b7280', fontSize: 11, marginTop: 4, textAlign: 'center', fontWeight: '500' },

  grilleBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  carteBadge: { width: BADGE_WIDTH, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  carteBadgeVerrouillee: { opacity: 0.5 },
  iconeBadge: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  emojiBadge: { fontSize: 22 },
  colonneBadge: { flex: 1 },
  titreBadge: { color: '#fff', fontSize: 13, fontWeight: '700' },
  descriptionBadge: { color: '#6b7280', fontSize: 10, marginTop: 2 },
  iconeSucces: { fontSize: 16, color: '#2ecc7a' },

  ligneHistorique: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  pointHistorique: { width: 10, height: 10, borderRadius: 5 },
  colonneHistorique: { flex: 1 },
  modeHistorique: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  dateHistorique: { color: '#6b7280', fontSize: 10, marginTop: 2 },
  resultatHistorique: { fontSize: 12, fontWeight: '600' },

  texteVide: { color: '#6b7280', fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  fondModal: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' },
  boiteModal: { borderRadius: 24, padding: 24, width: SCREEN_WIDTH - 60, alignItems: 'center' },
  titreModal: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  champPseudo: { backgroundColor: '#1e2a3a', color: '#fff', borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 16, marginBottom: 20, width: '100%', textAlign: 'center' },
  ligneBoutonsModal: { flexDirection: 'row', gap: 12, width: '100%' },
  boutonAnnulerModal: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#374151', alignItems: 'center', backgroundColor: '#1a1a2e' },
  texteBoutonAnnulerModal: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  boutonValiderModal: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  texteBoutonValiderModal: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default Profil;