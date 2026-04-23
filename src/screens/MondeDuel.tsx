// src/screens/MondeDuel.tsx
// ═══════════════════════════════════════════════════════════════════════════════
//  MONDE DUEL — Version Premium avec intervalle FIXE et nouveau système post-manche
//  - Intervalle de recherche FIXE (ne se réduit pas)
//  - Créateur : 3 boutons (Choisir niveau, Recommencer, Quitter)
//  - Invité : 2 boutons (Confirmer avec animation, Quitter)
//  - Nouveau duel sans quitter la salle
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Animated, Easing, Platform, Share, Clipboard,
  Vibration, Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, LEVEL_THEMES as LT } from '../styles/theme';
import { PseudoBadge } from '../components/PseudoBadge';
import { useDuel, type EtatDuel, type PropositionDuel } from '../hooks/useDuel';
import { ChatDuel } from './ChatDuel';
import { ClassementDuel } from './ClassementDuel';

type Props = {
  onRetour:        () => void;
  pseudo?:         string;
  onPseudoChange?: (p: string) => void;
};
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const NIVEAUX_DUEL = [
  { id: 1, min: 1, max: 100, essaisMax: 10, label: 'Débutant', icon: '🌱', color: '#4d8af0' },
  { id: 2, min: 1, max: 200, essaisMax: 8, label: 'Intermédiaire', icon: '🌿', color: '#9d5ff5' },
  { id: 3, min: 1, max: 300, essaisMax: 5, label: 'Expert', icon: '🔥', color: '#f472b6' },
  { id: 4, min: 1, max: 500, essaisMax: 3, label: 'Maître', icon: '👑', color: '#f87171' },
];

export const MondeDuel: React.FC<Props> = ({
  onRetour, pseudo = 'Joueur', onPseudoChange,
}) => {
  const duel = useDuel(pseudo);
  const [showClassementDuel, setShowClassementDuel] = useState(false);
  const [showVictoireAbandonScreen, setShowVictoireAbandonScreen] = useState(false);
  const [showNiveauModal, setShowNiveauModal] = useState(false);
  const [niveauTemp, setNiveauTemp] = useState(1);
  const [notificationAbandon, setNotificationAbandon] = useState<{ 
    visible: boolean; 
    adversaire: string; 
  }>({ visible: false, adversaire: '' });
  const [notificationAdversaireQuitte, setNotificationAdversaireQuitte] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: '' });
  
  // Animation pour le bouton Confirmer de l'invité
  const [boutonConfirmeAnime, setBoutonConfirmeAnime] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (duel.etat === 'adversaire_a_quitte') {
      setNotificationAdversaireQuitte({
        visible: true,
        message: "Votre adversaire a quitté la partie."
      });
    }
  }, [duel.etat]);

  useEffect(() => {
    if (boutonConfirmeAnime) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start(() => setBoutonConfirmeAnime(false));
    }
  }, [boutonConfirmeAnime]);

  const handleAdversaireQuitteOk = () => {
    setNotificationAdversaireQuitte({ visible: false, message: '' });
    duel.reinitialiser();
    onRetour();
  };

  const handleChoisirNiveau = (niveau: number) => {
    duel.choisirNiveau(niveau);
    setShowNiveauModal(false);
    if (!duel.estHote) {
      setBoutonConfirmeAnime(true);
    }
  };

  const handleRecommencer = () => {
    duel.recommencerNiveau();
    if (!duel.estHote) {
      setBoutonConfirmeAnime(true);
    }
  };

  const handleConfirmer = () => {
    if (duel.actionCreateur) {
      duel.confirmerNouveauDuel();
    }
  };

  const renderContenu = () => {
    switch (duel.etat) {
      case 'idle':
        return <EcranAccueil duel={duel} onRetour={onRetour} />;
      case 'creation':
      case 'rejoindre':
        return <EcranChargement message={duel.etat === 'creation' ? 'Création de la salle...' : 'Connexion en cours...'} />;
      case 'attente':
        return <EcranAttente duel={duel} pseudo={pseudo} onAnnuler={duel.annulerSalle} />;
      case 'compte_a_rebours':
        return <EcranCompteARebours compte={duel.compteARebours} adversaire={duel.adversairePseudo ?? ''} />;
      case 'en_cours':
        return <EcranJeu duel={duel} pseudo={pseudo} />;
      case 'victoire_manche':
        return (
          <EcranFinManche
            victoire={true}
            duel={duel}
            pseudo={pseudo}
            onChoisirNiveau={() => setShowNiveauModal(true)}
            onRecommencer={handleRecommencer}
            onQuitter={duel.quitterProprement}
            onConfirmer={handleConfirmer}
            onRetourMenu={duel.reinitialiser}
            estCreateur={duel.estHote}
            actionCreateur={duel.actionCreateur}
            boutonConfirmeAnime={boutonConfirmeAnime}
            pulseAnim={pulseAnim}
          />
        );
      case 'defaite_manche':
        return (
          <EcranFinManche
            victoire={false}
            duel={duel}
            pseudo={pseudo}
            onChoisirNiveau={() => setShowNiveauModal(true)}
            onRecommencer={handleRecommencer}
            onQuitter={duel.quitterProprement}
            onConfirmer={handleConfirmer}
            onRetourMenu={duel.reinitialiser}
            estCreateur={duel.estHote}
            actionCreateur={duel.actionCreateur}
            boutonConfirmeAnime={boutonConfirmeAnime}
            pulseAnim={pulseAnim}
          />
        );
      case 'victoire_par_abandon':
        if (showVictoireAbandonScreen) {
          return <EcranVictoireParAbandon duel={duel} pseudo={pseudo} onRetour={() => {
            setShowVictoireAbandonScreen(false);
            duel.reinitialiser();
            onRetour();
          }} />;
        }
        if (!notificationAbandon.visible && duel.abandonData && !showVictoireAbandonScreen) {
          setNotificationAbandon({ visible: true, adversaire: duel.adversairePseudo || 'Adversaire' });
          return null;
        }
        return null;
      case 'defaite_par_abandon':
        return <EcranDefaiteParAbandon duel={duel} pseudo={pseudo} onRetour={() => {
          duel.reinitialiser();
          onRetour();
        }} />;
      case 'victoire':
      case 'defaite':
      case 'egal':
        return <EcranResultat duel={duel} pseudo={pseudo} onRejouer={() => {
          duel.reinitialiser();
        }} onMenu={() => {
          duel.reinitialiser();
          onRetour();
        }} />;
      case 'adversaire_parti':
        return <EcranAdversaireParti duel={duel} onRetour={() => {
          duel.reinitialiser();
          onRetour();
        }} />;
      case 'adversaire_a_quitte':
        return null;
      default:
        return <EcranAccueil duel={duel} onRetour={onRetour} />;
    }
  };

  const handleNotificationOk = () => {
    setNotificationAbandon({ visible: false, adversaire: '' });
    setShowVictoireAbandonScreen(true);
  };

  return (
    <>
      <View style={S.root}>
        <LinearGradient colors={[C.bgDeep, C.bg, '#0d1628']} style={StyleSheet.absoluteFill} />

        <View style={S.header}>
          <TouchableOpacity
            onPress={() => {
              if (duel.etat === 'attente') {
                duel.annulerSalle();
                onRetour();
              } else if (duel.etat === 'idle') {
                onRetour();
              } else {
                duel.abandonner();
              }
            }}
            style={S.backBtn}
            activeOpacity={0.7}
          >
            <Text style={S.backBtnText}>←</Text>
          </TouchableOpacity>
          
          <View style={S.headerMid}>
            <Text style={S.headerTitle}>MONDE DUEL</Text>
            <View style={S.headerBadgeRow}>
              <View style={[S.headerStateBadge, {
                backgroundColor: duel.etat === 'en_cours' ? C.greenBg : C.bgCard,
                borderColor: duel.etat === 'en_cours' ? C.green : C.border,
              }]}>
                <Text style={[S.headerStateText, {
                  color: duel.etat === 'en_cours' ? C.green : C.textSecond,
                }]}>
                  {duel.etat === 'idle'          && '⚔️  PRÊT'}
                  {duel.etat === 'creation'      && '🔄  CRÉATION'}
                  {duel.etat === 'attente'       && '⏳  EN ATTENTE'}
                  {duel.etat === 'rejoindre'     && '🔄  CONNEXION'}
                  {duel.etat === 'compte_a_rebours' && '🎯  BIENTÔT'}
                  {duel.etat === 'en_cours'      && '🟢  EN JEU'}
                  {duel.etat === 'victoire_manche' && '🎉  MANCHE TERMINÉE'}
                  {duel.etat === 'defaite_manche' && '⏸️  MANCHE TERMINÉE'}
                  {duel.etat === 'victoire_par_abandon' && '🏆  VICTOIRE'}
                  {duel.etat === 'defaite_par_abandon' && '💀  DÉFAITE'}
                  {(duel.etat === 'victoire' || duel.etat === 'defaite' || duel.etat === 'egal') && '🏁  TERMINÉ'}
                  {duel.etat === 'adversaire_parti' && '🔌  DÉCONNECTÉ'}
                  {duel.etat === 'adversaire_a_quitte' && '🚪  ADVERSAIRE PARTI'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={S.headerRight}>
            <TouchableOpacity onPress={() => setShowClassementDuel(true)} style={S.classementBtn} activeOpacity={0.7}>
              <LinearGradient colors={[C.blueDark, C.blue]} style={S.classementIconGrad}>
                <Text style={S.classementIconText}>🏆</Text>
              </LinearGradient>
            </TouchableOpacity>
            <PseudoBadge pseudo={pseudo} onPseudoChange={onPseudoChange} compact />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={S.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderContenu()}
        </ScrollView>
      </View>

      <Modal visible={showClassementDuel} animationType="slide" presentationStyle="fullScreen">
        <ClassementDuel onRetour={() => setShowClassementDuel(false)} pseudo={pseudo} />
      </Modal>

      <Modal visible={showNiveauModal} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={S.modalBox}>
            <Text style={S.modalTitle}>Choisir un niveau</Text>
            <View style={S.niveauxModalRow}>
              {NIVEAUX_DUEL.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[S.niveauModalChip, niveauTemp === n.id && { borderColor: n.color, backgroundColor: `${n.color}20` }]}
                  onPress={() => setNiveauTemp(n.id)}
                >
                  <Text style={S.niveauModalIcon}>{n.icon}</Text>
                  <Text style={[S.niveauModalLabel, { color: n.color }]}>{n.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={S.modalBtns}>
              <TouchableOpacity style={S.btnAnnulerModal} onPress={() => setShowNiveauModal(false)}>
                <Text style={S.btnAnnulerModalTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.btnValiderModal, { backgroundColor: NIVEAUX_DUEL.find(n => n.id === niveauTemp)?.color }]} onPress={() => handleChoisirNiveau(niveauTemp)}>
                <Text style={S.btnValiderModalTxt}>Valider</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      <NotificationAbandon visible={notificationAbandon.visible} adversaire={notificationAbandon.adversaire} onOk={handleNotificationOk} />
      <NotificationAdversaireQuitte visible={notificationAdversaireQuitte.visible} message={notificationAdversaireQuitte.message} onOk={handleAdversaireQuitteOk} />

      <ChatDuel
        socket={duel.socketRef?.current}
        pseudo={pseudo}
        adversairePseudo={duel.adversairePseudo}
        estConnecte={duel.estConnecte}
        etatPartie={duel.etat}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN FIN DE MANCHE (VICTOIRE ou DÉFAITE)
//  - Créateur : 3 boutons (Choisir niveau, Recommencer, Quitter)
//  - Invité : 2 boutons (Confirmer, Quitter)
// ═══════════════════════════════════════════════════════════════════════════════

const EcranFinManche: React.FC<{
  victoire: boolean;
  duel: ReturnType<typeof useDuel>;
  pseudo: string;
  onChoisirNiveau: () => void;
  onRecommencer: () => void;
  onQuitter: () => void;
  onConfirmer: () => void;
  onRetourMenu: () => void;
  estCreateur: boolean;
  actionCreateur: string | null;
  boutonConfirmeAnime: boolean;
  pulseAnim: Animated.Value;
}> = ({ 
  victoire, duel, pseudo, onChoisirNiveau, onRecommencer, onQuitter, 
  onConfirmer, onRetourMenu, estCreateur, actionCreateur, boutonConfirmeAnime, pulseAnim 
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    if (victoire) {
      setTimeout(() => setShowConfetti(true), 100);
    }
  }, []);

  const niveauInfo = NIVEAUX_DUEL.find(n => n.id === duel.niveau) || NIVEAUX_DUEL[0];

  return (
    <Animated.View style={[S.finContainer, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient 
        colors={victoire ? ['#0a2e1a', '#0b4d20', '#0d5e28'] : ['#2a0a0a', '#4a1010', '#6a1515']} 
        style={S.finCard} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
      >
        <Animated.View style={[S.finGlow, { opacity: glowAnim, backgroundColor: victoire ? C.green : C.red }]} />
        
        {victoire && showConfetti && (
          <View style={S.confettiContainer}>
            <Text style={[S.confetti, { top: 20, left: 20 }]}>✨</Text>
            <Text style={[S.confetti, { top: 50, right: 30 }]}>🎉</Text>
            <Text style={[S.confetti, { bottom: 80, left: 40 }]}>⭐</Text>
            <Text style={[S.confetti, { bottom: 40, right: 50 }]}>🌟</Text>
          </View>
        )}

        <View style={S.finHeader}>
          <View style={S.finIconWrapper}>
            <LinearGradient colors={victoire ? ['#f5a623', '#ffd166'] : ['#f05252', '#a01515']} style={S.finIconCircle}>
              <Text style={S.finIcon}>{victoire ? '🏆' : '💀'}</Text>
            </LinearGradient>
          </View>
          <Text style={[S.finTitle, victoire ? { color: C.gold } : { color: C.red }]}>
            {victoire ? 'VICTOIRE !' : 'DÉFAITE'}
          </Text>
          <Text style={S.finNiveau}>Niveau {duel.niveau} terminé</Text>
        </View>

        <View style={S.scoreBoard}>
          <View style={S.scorePlayer}>
            <View style={S.scoreAvatar}><Text style={S.scoreAvatarText}>👤</Text></View>
            <Text style={S.scoreName}>{pseudo}</Text>
            <Text style={[S.scorePoints, victoire && { color: C.gold }]}>{duel.pointsJoueur}</Text>
          </View>
          <View style={S.scoreDivider}>
            <View style={S.scoreDividerLine} />
            <Text style={S.scoreDividerText}>VS</Text>
            <View style={S.scoreDividerLine} />
          </View>
          <View style={[S.scorePlayer, { alignItems: 'flex-end' }]}>
            <View style={[S.scoreAvatar, { backgroundColor: '#ffffff15' }]}><Text style={S.scoreAvatarText}>⚔️</Text></View>
            <Text style={S.scoreName}>{duel.adversairePseudo}</Text>
            <Text style={[S.scorePoints, !victoire && { color: C.red }]}>{duel.pointsAdversaire}</Text>
          </View>
        </View>

        {/* Boutons selon le rôle */}
        {estCreateur ? (
          // CRÉATEUR : 3 boutons
          <View style={S.buttonsColumn}>
            <TouchableOpacity onPress={onChoisirNiveau} style={S.btnPrimaryFull} activeOpacity={0.85}>
              <LinearGradient colors={['#6d28d9', '#9d5ff5']} style={S.btnPrimaryFullGrad}>
                <Text style={S.btnIcon}>🎯</Text>
                <View style={S.btnTextContainer}>
                  <Text style={S.btnTitle}>Choisir un niveau</Text>
                  <Text style={S.btnSubtitle}>Sélectionner un autre niveau</Text>
                </View>
                <Text style={S.btnArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onRecommencer} style={S.btnPrimaryFull} activeOpacity={0.85}>
              <LinearGradient colors={['#3a1a6a', '#5a2a8a']} style={S.btnPrimaryFullGrad}>
                <Text style={S.btnIcon}>🔄</Text>
                <View style={S.btnTextContainer}>
                  <Text style={S.btnTitle}>Recommencer</Text>
                  <Text style={S.btnSubtitle}>Rejouer le niveau {duel.niveau}</Text>
                </View>
                <Text style={S.btnArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onQuitter} style={S.quitBtnFull} activeOpacity={0.85}>
              <LinearGradient colors={['#dc2626', '#b91c1c']} style={S.quitBtnFullGrad}>
                <Text style={S.quitBtnIcon}>🚪</Text>
                <Text style={S.quitBtnText}>Quitter</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          // INVITÉ : 2 boutons
          <View style={S.buttonsColumn}>
            <Animated.View style={{ transform: [{ scale: boutonConfirmeAnime ? pulseAnim : 1 }] }}>
              <TouchableOpacity 
                onPress={onConfirmer} 
                style={[S.btnConfirmFull, !actionCreateur && S.btnConfirmFullDisabled]} 
                activeOpacity={0.85}
                disabled={!actionCreateur}
              >
                <LinearGradient 
                  colors={actionCreateur ? ['#f5a623', '#ffd166'] : [C.bgCardLit, C.bgCard]} 
                  style={S.btnConfirmFullGrad}
                >
                  <Text style={S.btnConfirmIcon}>✅</Text>
                  <View style={S.btnTextContainer}>
                    <Text style={[S.btnTitle, actionCreateur && { color: C.bgDeep }]}>Confirmer</Text>
                    <Text style={[S.btnSubtitle, actionCreateur && { color: C.bgDeep + 'aa' }]}>
                      {actionCreateur ? `Partie suivant - ${actionCreateur}` : 'En attente du choix...'}
                    </Text>
                  </View>
                  <Text style={[S.btnArrow, actionCreateur && { color: C.bgDeep }]}>→</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity onPress={onQuitter} style={S.quitBtnFull} activeOpacity={0.85}>
              <LinearGradient colors={['#dc2626', '#b91c1c']} style={S.quitBtnFullGrad}>
                <Text style={S.quitBtnIcon}>🚪</Text>
                <Text style={S.quitBtnText}>Quitter</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const NotificationAbandon: React.FC<{ visible: boolean; adversaire: string; onOk: () => void }> = ({ visible, adversaire, onOk }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [visible, fadeAnim]);
  
  if (!visible) return null;
  
  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={[S.notificationOverlay, { opacity: fadeAnim }]}>
        <View style={S.notificationCard}>
          <Text style={S.notificationEmoji}>⚠️</Text>
          <Text style={S.notificationTitle}>Abandon de l'adversaire</Text>
          <Text style={S.notificationMessage}>
            {adversaire} a abandonné le match.{'\n'}Victoire par abandon !
          </Text>
          <TouchableOpacity onPress={onOk} style={S.notificationBtn} activeOpacity={0.7}>
            <LinearGradient colors={[C.primary, C.primaryDark]} style={S.notificationBtnGrad}>
              <Text style={S.notificationBtnText}>OK</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

const NotificationAdversaireQuitte: React.FC<{ visible: boolean; message: string; onOk: () => void }> = ({ visible, message, onOk }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [visible, fadeAnim]);
  
  if (!visible) return null;
  
  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={[S.notificationOverlay, { opacity: fadeAnim }]}>
        <View style={[S.notificationCard, { borderColor: C.blue }]}>
          <Text style={S.notificationEmoji}>🚪</Text>
          <Text style={S.notificationTitle}>Adversaire parti</Text>
          <Text style={S.notificationMessage}>{message}</Text>
          <TouchableOpacity onPress={onOk} style={S.notificationBtn} activeOpacity={0.7}>
            <LinearGradient colors={[C.primary, C.primaryDark]} style={S.notificationBtnGrad}>
              <Text style={S.notificationBtnText}>OK</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN ACCUEIL (avec sélection du niveau)
// ═══════════════════════════════════════════════════════════════════════════════

const EcranAccueil: React.FC<{ duel: ReturnType<typeof useDuel>; onRetour: () => void }> = ({ duel, onRetour }) => {
  const [codeInput, setCodeInput] = useState('');
  const [onglet, setOnglet] = useState<'creer' | 'rejoindre'>('creer');
  const [enCreation, setEnCreation] = useState(false);
  const [niveauChoisi, setNiveauChoisi] = useState<number>(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleCreerSalle = async () => {
    if (enCreation) return;
    setEnCreation(true);
    try {
      await duel.creerSalle(niveauChoisi);
    } finally {
      setEnCreation(false);
    }
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <LinearGradient colors={['#1a0a3a', '#3d1a8a']} style={S.duelBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={S.duelBannerBg} />
        <Text style={S.duelBannerEmoji}>⚔️</Text>
        <Text style={S.duelBannerTitle}>DUEL EN LIGNE</Text>
        <Text style={S.duelBannerSub}>Affronte un joueur en temps réel{'\n'}Trouve le nombre mystère avant lui</Text>
      </LinearGradient>

      <View style={S.ongletRow}>
        <TouchableOpacity onPress={() => setOnglet('creer')} style={[S.onglet, onglet === 'creer' && S.ongletActif]} activeOpacity={0.7}>
          <Text style={[S.ongletText, onglet === 'creer' && S.ongletTextActif]}>➕  Créer une salle</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOnglet('rejoindre')} style={[S.onglet, onglet === 'rejoindre' && S.ongletActif]} activeOpacity={0.7}>
          <Text style={[S.ongletText, onglet === 'rejoindre' && S.ongletTextActif]}>🔑  Rejoindre</Text>
        </TouchableOpacity>
      </View>

      {onglet === 'creer' ? (
        <>
          <Text style={S.sectionLabel}>CHOISIS LE NIVEAU DU DUEL</Text>
          <View style={S.niveauxRow}>
            {NIVEAUX_DUEL.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[S.niveauChip, niveauChoisi === n.id && S.niveauChipActif, { borderColor: n.color }]}
                onPress={() => setNiveauChoisi(n.id)}
                activeOpacity={0.7}
              >
                <Text style={S.niveauChipIcon}>{n.icon}</Text>
                <Text style={[S.niveauChipLabel, niveauChoisi === n.id && { color: n.color }]}>
                  {n.label}
                </Text>
                <Text style={[S.niveauChipIntervalle, { color: n.color }]}>
                  {n.min}-{n.max}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {duel.erreur ? (
            <View style={S.erreurBox}>
              <Text style={S.erreurText}>⚠  {duel.erreur}</Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={handleCreerSalle} activeOpacity={0.7} disabled={enCreation}>
            <LinearGradient colors={enCreation ? [C.bgCard, C.bgCard] : [C.primary, C.primaryDark]} style={S.btnPrimary}>
              <Text style={[S.btnPrimaryText, enCreation && { color: C.textHint }]}>
                {enCreation ? '🔄  CRÉATION EN COURS...' : '⚔️  CRÉER LE DUEL'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={S.sectionLabel}>ENTRE LE CODE DE LA SALLE</Text>
          <View style={S.codeInputCard}>
            <Text style={S.codeInputLabel}>CODE À 6 CARACTÈRES</Text>
            <TextInput
              style={S.codeInput}
              value={codeInput}
              onChangeText={t => setCodeInput(t.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor={C.textHint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={() => codeInput.length === 6 && duel.rejoindreSalle(codeInput)}
            />
            <Text style={S.codeInputHint}>{codeInput.length}/6 — demande le code à ton adversaire</Text>
          </View>

          {duel.erreur ? (
            <View style={S.erreurBox}>
              <Text style={S.erreurText}>⚠  {duel.erreur}</Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={() => duel.rejoindreSalle(codeInput)} activeOpacity={0.7} disabled={codeInput.length < 6}>
            <LinearGradient colors={codeInput.length === 6 ? [C.primary, C.primaryDark] : [C.bgCard, C.bgCard]} style={S.btnPrimary}>
              <Text style={[S.btnPrimaryText, codeInput.length < 6 && { color: C.textHint }]}>🔑  REJOINDRE LE DUEL</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN CHARGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const EcranChargement: React.FC<{ message: string }> = ({ message }) => {
  const rotAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(rotAnim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  const spin = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={S.centreEcran}>
      <Animated.Text style={[S.spinnerEmoji, { transform: [{ rotate: spin }] }]}>⚙️</Animated.Text>
      <Text style={S.chargementText}>{message}</Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN ATTENTE
// ═══════════════════════════════════════════════════════════════════════════════

const EcranAttente: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onAnnuler: () => void }> = ({ duel, pseudo, onAnnuler }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [copie, setCopie] = useState(false);
  const pretEnvoyeRef = useRef(false);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    if (duel.adversairePseudo && duel.etat === 'attente' && !pretEnvoyeRef.current) {
      pretEnvoyeRef.current = true;
      const timer = setTimeout(() => {
        duel.envoyerPret();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [duel.adversairePseudo, duel.etat, duel.envoyerPret]);

  const partagerCode = async () => {
    try {
      await Share.share({ message: `Rejoins mon duel Nombre Mystère ! Code : ${duel.codeSalle}` });
    } catch {}
  };

  const copierCode = () => {
    Clipboard.setString(duel.codeSalle);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  return (
    <View style={S.centreEcran}>
      <View style={S.attenteIndicateur}>
        <Animated.Text style={[{ fontSize: 56 }, { transform: [{ scale: pulseAnim }] }]}>⏳</Animated.Text>
      </View>
      <Text style={S.attenteTitle}>En attente d'un adversaire</Text>
      <Text style={S.attenteSub}>Partage ce code à ton adversaire</Text>

      {duel.adversairePseudo ? (
        <View style={S.adversaireConnecteCard}>
          <Text style={S.adversaireConnecteEmoji}>✅</Text>
          <Text style={S.adversaireConnecteText}>{duel.adversairePseudo} a rejoint la salle !</Text>
          <Text style={S.adversaireConnecteSub}>Préparation du duel...</Text>
        </View>
      ) : (
        <>
          <View style={S.codeCard}>
            <Text style={S.codeCardLabel}>TON CODE DE SALLE</Text>
            <Text style={S.codeCardValue}>{duel.codeSalle}</Text>
            <View style={S.codeBtnsRow}>
              <TouchableOpacity onPress={copierCode} style={S.codeCopyBtn} activeOpacity={0.7}>
                <Text style={S.codeCopyText}>{copie ? '✓ Copié !' : '📋 Copier'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={partagerCode} style={S.codeShareBtn} activeOpacity={0.7}>
                <LinearGradient colors={[C.primary, C.primaryDark]} style={S.codeShareGrad}>
                  <Text style={S.codeShareText}>📤 Partager</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={S.attenteNote}>Le duel démarrera automatiquement{'\n'}dès que ton adversaire aura rejoint</Text>
        </>
      )}

      <TouchableOpacity onPress={onAnnuler} style={S.btnAnnuler} activeOpacity={0.7}>
        <LinearGradient colors={[C.bgCardLit, C.bgCard]} style={S.btnAnnulerGrad}>
          <Text style={S.btnAnnulerText}>Annuler</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN COMPTE À REBOURS
// ═══════════════════════════════════════════════════════════════════════════════

const EcranCompteARebours: React.FC<{ compte: number; adversaire: string }> = ({ compte, adversaire }) => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
  }, [compte]);

  useEffect(() => {
    if (compte > 0 && compte <= 3) {
      Vibration.vibrate(100);
    }
  }, [compte]);

  return (
    <View style={S.centreEcran}>
      <Text style={S.compteAdversaire}>⚔️ vs {adversaire}</Text>
      <Animated.Text style={[S.compteChiffre, { transform: [{ scale: scaleAnim }] }]}>
        {compte > 0 ? compte : '🎯'}
      </Animated.Text>
      <Text style={S.compteSous}>{compte > 0 ? 'Prépare-toi !' : 'C\'EST PARTI !'}</Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN JEU EN COURS — AVEC INTERVALLE FIXE (ne se réduit pas)
// ═══════════════════════════════════════════════════════════════════════════════

const EcranJeu: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string }> = ({ duel, pseudo }) => {
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');

  const twAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const { niveauConfig, tempsRestant, adversairePseudo, essaisRestants, derniereProposition, propositions, monTour } = duel;

  useEffect(() => {
    Animated.timing(twAnim, { toValue: tempsRestant / 30, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();

    if (tempsRestant <= 10 && !pulseRef.current && tempsRestant > 0) {
      pulseRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      pulseRef.current.start();
    } else if ((tempsRestant > 10 || tempsRestant === 0) && pulseRef.current) {
      pulseRef.current.stop();
      pulseRef.current = null;
      pulseAnim.setValue(1);
    }
  }, [tempsRestant]);

  const shakeInput = () => Animated.sequence([
    Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 6, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
  ]).start();

  const handleSubmit = () => {
    const trimmed = saisie.trim();
    
    if (!/^\d+$/.test(trimmed)) {
      setErreur('Entrez un nombre entier uniquement (ex: 42)');
      shakeInput();
      return;
    }
    
    const val = parseInt(trimmed, 10);
    
    if (isNaN(val)) {
      setErreur('Entrez un nombre valide');
      shakeInput();
      return;
    }
    
    if (val.toString() !== trimmed) {
      setErreur('Les nombres décimaux ne sont pas acceptés');
      shakeInput();
      return;
    }
    
    // ✅ INTERVALLE FIXE — on utilise les bornes du niveau (ne se réduit pas)
    const minActuel = niveauConfig.min;
    const maxActuel = niveauConfig.max;
    
    if (val < minActuel || val > maxActuel) {
      setErreur(`Entre ${minActuel} et ${maxActuel}`);
      shakeInput();
      return;
    }
    
    if (propositions.some(p => p.valeur === val)) {
      setErreur('Déjà proposé !');
      shakeInput();
      return;
    }
    
    setErreur('');
    setSaisie('');
    duel.proposerNombre(val);
  };

  const handleSaisieChange = (texte: string) => {
    const filtered = texte.replace(/[^0-9]/g, '');
    setSaisie(filtered);
    setErreur('');
  };

  const tc = tempsRestant > 20 ? C.green : tempsRestant > 10 ? C.amber : C.red;
  const ec = essaisRestants / niveauConfig.essaisMax > 0.6 ? C.green : essaisRestants / niveauConfig.essaisMax > 0.3 ? C.amber : C.red;

  const renderStatutTour = () => (
    <View style={[S.statutTour, monTour ? S.statutTourActif : S.statutTourInactif]}>
      <Text style={[S.statutTourTexte, { color: monTour ? C.green : C.textSecond }]}>
        {monTour ? '🟢 C\'EST À VOUS DE JOUER !' : '⏳ ATTENTE DE L\'ADVERSAIRE...'}
      </Text>
      {monTour && <View style={S.pulseDot} />}
    </View>
  );

  return (
    <View>
      {renderStatutTour()}

      <View style={S.vsBandeau}>
        <View style={S.vsJoueur}>
          <Text style={S.vsNom} numberOfLines={1}>{pseudo}</Text>
          <Text style={[S.vsScore, { color: ec }]}>{essaisRestants}</Text>
          <Text style={S.vsScoreLabel}>essais</Text>
        </View>

        <View style={S.vsCenter}>
          <Text style={S.vsLabel}>VS</Text>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Text style={[S.vsTimer, { color: tc }]}>{tempsRestant}s</Text>
            <View style={S.vsTimerTrack}>
              <Animated.View style={[S.vsTimerFill, { width: twAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }), backgroundColor: tc }]} />
            </View>
          </Animated.View>
        </View>

        <View style={[S.vsJoueur, { alignItems: 'flex-end' }]}>
          <Text style={S.vsNom} numberOfLines={1}>{adversairePseudo ?? '...'}</Text>
          <Text style={S.vsScore}>{duel.essaisAdversaire}</Text>
          <Text style={S.vsScoreLabel}>essais</Text>
        </View>
      </View>

      {/* Intervalle FIXE (ne se réduit pas) */}
      <View style={S.intervalleCard}>
        <Text style={S.intervalleLabel}>INTERVALLE DU NIVEAU {duel.niveau}</Text>
        <View style={S.intervalleRow}>
          <Text style={S.intervalleNum}>{niveauConfig.min}</Text>
          <View style={S.intervalleBar}>
            <LinearGradient colors={[C.primary, C.primaryDark]} style={StyleSheet.absoluteFill} />
          </View>
          <Text style={S.intervalleNum}>{niveauConfig.max}</Text>
        </View>
      </View>

      {derniereProposition && (
        <View style={[S.indiceBox,
          derniereProposition.indice === 'plus' && S.indicePlus,
          derniereProposition.indice === 'moins' && S.indiceMoins,
          derniereProposition.indice === 'egal' && S.indiceEgal,
        ]}>
          <Text style={S.indiceNum}>{derniereProposition.valeur}</Text>
          <View style={S.indiceSep} />
          <View>
            <Text style={[S.indiceMsg,
              derniereProposition.indice === 'plus' && { color: C.blue },
              derniereProposition.indice === 'moins' && { color: C.red },
              derniereProposition.indice === 'egal' && { color: C.green },
            ]}>
              {derniereProposition.indice === 'plus' && "↑  C'est PLUS GRAND"}
              {derniereProposition.indice === 'moins' && "↓  C'est PLUS PETIT"}
              {derniereProposition.indice === 'egal' && "✓  TROUVÉ !"}
            </Text>
            <Text style={S.indiceHint}>
              {derniereProposition.indice === 'plus' && `Le nombre est > ${derniereProposition.valeur}`}
              {derniereProposition.indice === 'moins' && `Le nombre est < ${derniereProposition.valeur}`}
              {derniereProposition.indice === 'egal' && 'Tu as gagné ce niveau !'}
            </Text>
          </View>
        </View>
      )}

      <View style={S.saisieCard}>
        <Text style={S.saisieLabel}>TON NOMBRE</Text>
        <Animated.View style={[S.saisieWrapper, { transform: [{ translateX: shakeAnim }] }, !!erreur && S.saisieError]}>
          <TextInput
            style={[S.saisieInput, !monTour && S.saisieInputDesactive]}
            keyboardType="number-pad"
            value={saisie}
            onChangeText={handleSaisieChange}
            onSubmitEditing={handleSubmit}
            placeholder={monTour ? `${niveauConfig.min} – ${niveauConfig.max}` : "Attendez votre tour..."}
            placeholderTextColor={monTour ? C.textHint : C.textSecond}
            editable={monTour}
            returnKeyType="done"
          />
        </Animated.View>
        {erreur ? (
          <View style={S.erreurRow}>
            <View style={S.erreurDot} />
            <Text style={S.erreurText}>{erreur}</Text>
          </View>
        ) : null}
        <View style={S.saisieBtnsRow}>
          <TouchableOpacity onPress={handleSubmit} activeOpacity={0.7} disabled={essaisRestants === 0 || !monTour} style={[S.btnProposer, (essaisRestants === 0 || !monTour) && { opacity: 0.35 }]}>
            <LinearGradient colors={(essaisRestants === 0 || !monTour) ? [C.bgCard, C.bgCard] : [C.primary, C.primaryDark]} style={S.btnProposerGrad}>
              <Text style={S.btnProposerText}>{!monTour ? 'EN ATTENTE' : 'PROPOSER'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={duel.abandonner} style={S.btnAbandonner} activeOpacity={0.7}>
            <LinearGradient colors={[C.redBg, C.redDark]} style={S.btnAbandonnerGrad}>
              <Text style={S.btnAbandonnerText}>🏳️ Abandonner</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {propositions.length > 0 && (
        <View style={S.histSection}>
          <Text style={S.histTitle}>HISTORIQUE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
            {[...propositions].reverse().map((p, i) => (
              <View key={i} style={[S.histChip,
                p.indice === 'plus' && S.histChipPlus,
                p.indice === 'moins' && S.histChipMoins,
                p.indice === 'egal' && S.histChipEgal,
              ]}>
                <Text style={S.histChipVal}>{p.valeur}</Text>
                <Text style={S.histChipIco}>{p.indice === 'plus' ? '↑' : p.indice === 'moins' ? '↓' : '✓'}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN VICTOIRE PAR ABANDON
// ═══════════════════════════════════════════════════════════════════════════════

const EcranVictoireParAbandon: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onRetour: () => void }> = ({ duel, pseudo, onRetour }) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [showStars, setShowStars] = useState(false);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    setTimeout(() => setShowStars(true), 100);
  }, []);

  const niveauAbandon = duel.abandonData?.niveau || duel.niveau;

  return (
    <Animated.View style={[S.abandonVictoryContainer, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient colors={['#0a2e1a', '#0b4d20', '#0d5e28']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.abandonVictoryCard}>
        <Animated.View style={[S.abandonVictoryGlow, { opacity: glowAnim }]} />
        {showStars && (<View style={S.starsContainer}><Text style={[S.star, { top: 30, left: 25 }]}>⭐</Text><Text style={[S.star, { top: 60, right: 35 }]}>✨</Text><Text style={[S.star, { bottom: 100, left: 45 }]}>🌟</Text><Text style={[S.star, { bottom: 50, right: 60 }]}>⭐</Text></View>)}
        <View style={S.abandonVictoryHeader}>
          <View style={S.abandonVictoryIconWrapper}><LinearGradient colors={['#f5a623', '#ffd166']} style={S.abandonVictoryIconCircle}><Text style={S.abandonVictoryIcon}>🏆</Text></LinearGradient></View>
          <Text style={S.abandonVictoryTitle}>VICTOIRE PAR ABANDON</Text>
          <View style={S.abandonVictoryBadge}><Text style={S.abandonVictoryBadgeText}>L'adversaire a abandonné</Text></View>
        </View>
        <View style={S.abandonInfoCard}>
          <View style={S.abandonInfoRow}><Text style={S.abandonInfoLabel}>Niveau</Text><Text style={S.abandonInfoValue}>{niveauAbandon}</Text></View>
          <View style={S.abandonDivider} />
          <View style={S.abandonInfoRow}><Text style={S.abandonInfoLabel}>Résultat</Text><Text style={[S.abandonInfoValue, { color: '#ffd166' }]}>Victoire</Text></View>
        </View>
        <View style={S.abandonScoreBoard}>
          <View style={S.abandonScoreItem}><Text style={S.abandonScoreLabel}>VOTRE SCORE</Text><Text style={S.abandonScoreValue}>{duel.pointsJoueur}</Text></View>
          <View style={S.abandonScoreDivider}><Text style={S.abandonScoreDividerText}>🏆</Text></View>
          <View style={[S.abandonScoreItem, { alignItems: 'flex-end' }]}><Text style={S.abandonScoreLabel}>ADVERSAIRE</Text><Text style={[S.abandonScoreValue, { color: '#888' }]}>{duel.pointsAdversaire}</Text></View>
        </View>
        <TouchableOpacity onPress={onRetour} style={S.quitBtnFull} activeOpacity={0.85}>
          <LinearGradient colors={['#dc2626', '#b91c1c']} style={S.quitBtnFullGrad}>
            <Text style={S.quitBtnIcon}>←</Text>
            <Text style={S.quitBtnText}>MENU</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN DÉFAITE PAR ABANDON
// ═══════════════════════════════════════════════════════════════════════════════

const EcranDefaiteParAbandon: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onRetour: () => void }> = ({ duel, pseudo, onRetour }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <Animated.View style={[S.abandonDefeatContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient colors={['#2a0a0a', '#4a1010', '#6a1515']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.abandonDefeatCard}>
        <View style={S.abandonDefeatHeader}>
          <Animated.View style={[S.abandonDefeatIconWrapper, { transform: [{ scale: pulseAnim }] }]}><LinearGradient colors={['#f05252', '#a01515']} style={S.abandonDefeatIconCircle}><Text style={S.abandonDefeatIcon}>💀</Text></LinearGradient></Animated.View>
          <Text style={S.abandonDefeatTitle}>DÉFAITE PAR ABANDON</Text>
          <View style={S.abandonDefeatBadge}><Text style={S.abandonDefeatBadgeText}>Vous avez abandonné le match</Text></View>
        </View>
        <View style={S.abandonInfoCardDefeat}>
          <View style={S.abandonInfoRowDefeat}><Text style={S.abandonInfoLabelDefeat}>Résultat</Text><Text style={[S.abandonInfoValueDefeat, { color: '#f05252' }]}>Défaite</Text></View>
          <View style={S.abandonDividerDefeat} />
          <View style={S.abandonInfoRowDefeat}><Text style={S.abandonInfoLabelDefeat}>Score final</Text><Text style={S.abandonInfoValueDefeat}>{duel.pointsJoueur}</Text></View>
        </View>
        <View style={S.abandonScoreBoardDefeat}>
          <View style={S.abandonScoreItemDefeat}><Text style={S.abandonScoreLabelDefeat}>VOTRE SCORE</Text><Text style={S.abandonScoreValueDefeat}>{duel.pointsJoueur}</Text></View>
          <View style={S.abandonScoreDividerDefeat}><Text style={S.abandonScoreDividerTextDefeat}>💔</Text></View>
          <View style={[S.abandonScoreItemDefeat, { alignItems: 'flex-end' }]}><Text style={S.abandonScoreLabelDefeat}>ADVERSAIRE</Text><Text style={[S.abandonScoreValueDefeat, { color: '#f05252' }]}>{duel.pointsAdversaire}</Text></View>
        </View>
        <View style={S.abandonMessageCard}>
          <Text style={S.abandonMessageIcon}>⚠️</Text>
          <Text style={S.abandonMessageTitle}>Pas de pénalité</Text>
          <Text style={S.abandonMessageText}>Vous avez abandonné volontairement.</Text>
        </View>
        <TouchableOpacity onPress={onRetour} style={S.quitBtnFull} activeOpacity={0.85}>
          <LinearGradient colors={['#dc2626', '#b91c1c']} style={S.quitBtnFullGrad}>
            <Text style={S.quitBtnIcon}>←</Text>
            <Text style={S.quitBtnText}>MENU</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN RÉSULTAT FINAL
// ═══════════════════════════════════════════════════════════════════════════════

const EcranResultat: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onRejouer: () => void; onMenu: () => void }> = ({ duel, pseudo, onRejouer, onMenu }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const { etat, resultat } = duel;

  useEffect(() => {
    Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.2, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  const isVictoire = etat === 'victoire';
  const isEgal = etat === 'egal';

  const config = isVictoire ? {
    emoji: '🏆', titre: 'VICTOIRE !',
    colors: ['#04200e', '#0b4d20', '#16a34a'] as [string, string, string],
    glow: C.green,
  } : isEgal ? {
    emoji: '🤝', titre: 'ÉGALITÉ !',
    colors: ['#1a1004', '#3d2800', '#b07d0e'] as [string, string, string],
    glow: C.gold,
  } : {
    emoji: '💀', titre: 'DÉFAITE',
    colors: ['#200404', '#5a0808', '#b91c1c'] as [string, string, string],
    glow: C.red,
  };

  return (
    <Animated.View style={{ opacity: bounceAnim, transform: [{ scale: bounceAnim.interpolate({ inputRange: [0,1], outputRange: [0.65,1] }) }] }}>
      <LinearGradient colors={config.colors} style={S.resultatCard} start={{ x:0,y:0 }} end={{ x:1,y:1 }}>
        <Animated.View style={[S.resultatGlow, { backgroundColor: config.glow, opacity: glowAnim }]} />
        <Text style={S.resultatEmoji}>{config.emoji}</Text>
        <Text style={S.resultatTitre}>{config.titre}</Text>
        {resultat && (
          <>
            <Text style={S.resultatMystere}>Nombre mystère : <Text style={S.resultatMystereVal}>{resultat.nombreMystere}</Text></Text>
            <View style={S.resultatStats}>
              <View style={S.resultatStatCol}><Text style={S.resultatStatVal}>{resultat.essaisJoueur}</Text><Text style={S.resultatStatKey}>TES ESSAIS</Text></View>
              <View style={S.resultatStatSep} />
              <View style={S.resultatStatCol}><Text style={[S.resultatStatVal, { color: C.gold }]}>+{resultat.pointsJoueur}</Text><Text style={S.resultatStatKey}>POINTS</Text></View>
              <View style={S.resultatStatSep} />
              <View style={S.resultatStatCol}><Text style={S.resultatStatVal}>{resultat.duree}s</Text><Text style={S.resultatStatKey}>DURÉE</Text></View>
            </View>
            <View style={S.resultatAdversaire}>
              <Text style={S.resultatAdvLabel}>Adversaire :</Text>
              <Text style={S.resultatAdvVal}>{resultat.vainqueur && resultat.vainqueur !== pseudo ? resultat.vainqueur : duel.adversairePseudo}</Text>
              <Text style={S.resultatAdvPoints}>+{resultat.pointsAdversaire} pts</Text>
            </View>
          </>
        )}
        <View style={S.resultatBtns}>
          <TouchableOpacity onPress={onRejouer} style={S.resultatBtnSecond} activeOpacity={0.7}><Text style={S.resultatBtnSecondText}>🔄  Rejouer</Text></TouchableOpacity>
          <TouchableOpacity onPress={onMenu} style={S.resultatBtnSecond} activeOpacity={0.7}><Text style={S.resultatBtnSecondText}>← Menu</Text></TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN ADVERSAIRE PARTI
// ═══════════════════════════════════════════════════════════════════════════════

const EcranAdversaireParti: React.FC<{ duel: ReturnType<typeof useDuel>; onRetour: () => void }> = ({ duel, onRetour }) => (
  <View style={S.centreEcran}>
    <Text style={{ fontSize: 64, marginBottom: 16 }}>🔌</Text>
    <Text style={S.adversairePartiTitle}>Adversaire déconnecté</Text>
    <Text style={S.adversairePartiSub}>Ton adversaire a quitté la partie.{'\n'}Victoire par forfait !</Text>
    <TouchableOpacity onPress={onRetour} activeOpacity={0.7} style={{ marginTop: 32, width: '100%' }}>
      <LinearGradient colors={[C.primary, C.primaryDark]} style={S.btnPrimary}>
        <Text style={S.btnPrimaryText}>🔄  Nouveau duel</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 52 : 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgCard },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bgCardLit, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.border },
  backBtnText: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  headerMid: { flex: 1 },
  headerTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 2.5 },
  headerBadgeRow: { flexDirection: 'row', marginTop: 5 },
  headerStateBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  headerStateText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  classementBtn: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' },
  classementIconGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  classementIconText: { fontSize: 22 },
  scroll: { padding: 16, paddingBottom: 52 },
  
  duelBanner: { borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 20, overflow: 'hidden', shadowColor: '#6d28d9', shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  duelBannerBg: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ffffff08', top: -60, right: -40 },
  duelBannerEmoji: { fontSize: 52, marginBottom: 10 },
  duelBannerTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 3, marginBottom: 8 },
  duelBannerSub: { color: '#ffffffcc', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  
  ongletRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  onglet: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  ongletActif: { backgroundColor: '#1a0a3a', borderColor: '#6d28d9' },
  ongletText: { color: C.textSecond, fontSize: 13, fontWeight: '700' },
  ongletTextActif: { color: '#9d5ff5' },
  
  sectionLabel: { color: C.textSecond, fontSize: 11, fontWeight: '900', letterSpacing: 2.5, marginBottom: 12 },
  
  niveauxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  niveauChip: { flex: 1, minWidth: '45%', backgroundColor: C.bgCard, borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  niveauChipActif: { backgroundColor: C.bgCardLit, borderWidth: 2 },
  niveauChipIcon: { fontSize: 24, marginBottom: 4 },
  niveauChipLabel: { color: C.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  niveauChipIntervalle: { fontSize: 12, fontWeight: '600' },
  
  codeInputCard: { backgroundColor: C.bgCard, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  codeInputLabel: { color: C.textSecond, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  codeInput: { backgroundColor: C.bgCardLit, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderLit, paddingVertical: 18, paddingHorizontal: 20, color: C.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 8, marginBottom: 10 },
  codeInputHint: { color: C.textHint, fontSize: 12, textAlign: 'center' },
  
  erreurBox: { backgroundColor: C.redBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.redDark, marginBottom: 16 },
  erreurRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  erreurDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red },
  erreurText: { color: C.red, fontSize: 13, fontWeight: '700' },
  
  btnPrimary: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  btnAnnuler: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  btnAnnulerGrad: { paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  btnAnnulerText: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  
  centreEcran: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  attenteIndicateur: { marginBottom: 20 },
  attenteTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  attenteSub: { color: C.textBody, fontSize: 15, marginBottom: 28, textAlign: 'center' },
  attenteNote: { color: C.textHint, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  
  codeCard: { backgroundColor: C.bgCard, borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#3d1a8a', alignItems: 'center', width: '100%', marginBottom: 24 },
  codeCardLabel: { color: C.textSecond, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  codeCardValue: { color: '#9d5ff5', fontSize: 42, fontWeight: '900', letterSpacing: 12, marginBottom: 18, textShadowColor: '#6d28d9', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  codeBtnsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  codeCopyBtn: { flex: 1, backgroundColor: C.bgCardLit, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  codeCopyText: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  codeShareBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  codeShareGrad: { paddingVertical: 13, alignItems: 'center' },
  codeShareText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  
  adversaireConnecteCard: { backgroundColor: C.greenBg, borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: C.green, width: '100%' },
  adversaireConnecteEmoji: { fontSize: 48, marginBottom: 12 },
  adversaireConnecteText: { color: C.green, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  adversaireConnecteSub: { color: C.textBody, fontSize: 14, textAlign: 'center' },
  
  spinnerEmoji: { fontSize: 48, marginBottom: 20 },
  chargementText: { color: C.textBody, fontSize: 16, fontWeight: '600' },
  
  compteAdversaire: { color: C.textBody, fontSize: 16, fontWeight: '700', marginBottom: 20 },
  compteChiffre: { color: C.gold, fontSize: 96, fontWeight: '900', textShadowColor: C.gold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  compteSous: { color: C.textBody, fontSize: 18, fontWeight: '600', marginTop: 12 },
  
  vsBandeau: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  vsJoueur: { flex: 1, alignItems: 'flex-start' },
  vsNom: { color: C.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  vsScore: { fontSize: 28, fontWeight: '900', color: C.textPrimary },
  vsScoreLabel: { color: C.textSecond, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  vsCenter: { alignItems: 'center', paddingHorizontal: 16 },
  vsLabel: { color: '#9d5ff5', fontSize: 18, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  vsTimer: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  vsTimerTrack: { width: 56, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  vsTimerFill: { height: 4, borderRadius: 2 },
  
  intervalleCard: { backgroundColor: C.bgCard, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  intervalleLabel: { color: C.textSecond, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  intervalleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intervalleNum: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  intervalleBar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: C.border },
  
  indiceBox: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard },
  indicePlus: { backgroundColor: C.blueBg, borderColor: C.blue },
  indiceMoins: { backgroundColor: C.redBg, borderColor: C.red },
  indiceEgal: { backgroundColor: C.greenBg, borderColor: C.green },
  indiceNum: { color: C.textPrimary, fontSize: 24, fontWeight: '900', minWidth: 50, textAlign: 'center' },
  indiceSep: { width: 1.5, height: 32, backgroundColor: C.border },
  indiceMsg: { fontSize: 15, fontWeight: '800' },
  indiceHint: { fontSize: 12, color: C.textBody, marginTop: 2, fontWeight: '500' },
  
  saisieCard: { backgroundColor: C.bgCard, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  saisieLabel: { fontSize: 13, fontWeight: '800', color: C.textSecond, letterSpacing: 2, marginBottom: 12 },
  saisieWrapper: { backgroundColor: C.bgCardLit, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderLit, marginBottom: 10 },
  saisieError: { borderColor: C.red },
  saisieInput: { paddingVertical: 18, paddingHorizontal: 20, color: C.textPrimary, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  saisieInputDesactive: { opacity: 0.6, backgroundColor: C.bgCardLit },
  saisieBtnsRow: { flexDirection: 'row', gap: 10 },
  btnProposer: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  btnProposerGrad: { paddingVertical: 15, alignItems: 'center' },
  btnProposerText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  btnAbandonner: { borderRadius: 12, overflow: 'hidden', flex: 0.5 },
  btnAbandonnerGrad: { paddingVertical: 15, alignItems: 'center' },
  btnAbandonnerText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  
  histSection: { marginBottom: 8 },
  histTitle: { color: C.textSecond, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  histChip: { backgroundColor: C.bgCard, borderRadius: 10, padding: 10, marginRight: 8, minWidth: 54, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  histChipPlus: { backgroundColor: C.blueBg, borderColor: C.blue },
  histChipMoins: { backgroundColor: C.redBg, borderColor: C.red },
  histChipEgal: { backgroundColor: C.greenBg, borderColor: C.green },
  histChipVal: { color: C.textPrimary, fontSize: 15, fontWeight: '900' },
  histChipIco: { color: C.textBody, fontSize: 13, marginTop: 2 },
  
  notificationOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  notificationCard: { backgroundColor: C.bgCard, borderRadius: 24, padding: 24, alignItems: 'center', width: '80%', borderWidth: 1, borderColor: C.gold },
  notificationEmoji: { fontSize: 48, marginBottom: 16 },
  notificationTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  notificationMessage: { color: C.textBody, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  notificationBtn: { borderRadius: 12, overflow: 'hidden', width: '100%' },
  notificationBtnGrad: { paddingVertical: 12, alignItems: 'center' },
  notificationBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  // Styles pour l'écran de fin de manche
  finContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  finCard: { borderRadius: 48, padding: 28, alignItems: 'center', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, elevation: 25, width: '100%' },
  finGlow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -80, alignSelf: 'center' },
  finHeader: { alignItems: 'center', marginBottom: 24, zIndex: 1 },
  finIconWrapper: { marginBottom: 16 },
  finIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowColor: '#f5a623', shadowOpacity: 0.5, shadowRadius: 20 },
  finIcon: { fontSize: 44 },
  finTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
  finNiveau: { color: '#ffffffcc', fontSize: 14 },
  
  confettiContainer: { position: 'absolute', width: '100%', height: '100%' },
  confetti: { position: 'absolute', fontSize: 24, opacity: 0.7 },
  
  buttonsColumn: { flexDirection: 'column', gap: 12, width: '100%', marginTop: 8, marginBottom: 8 },
  btnPrimaryFull: { borderRadius: 60, overflow: 'hidden', shadowColor: '#6d28d9', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6, width: '100%' },
  btnPrimaryFullGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 24 },
  btnConfirmFull: { borderRadius: 60, overflow: 'hidden', width: '100%' },
  btnConfirmFullDisabled: { opacity: 0.5 },
  btnConfirmFullGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 24 },
  btnIcon: { fontSize: 24, color: '#fff' },
  btnConfirmIcon: { fontSize: 22 },
  btnTextContainer: { alignItems: 'center' },
  btnTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 1, color: '#fff' },
  btnSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2, color: '#ffffffcc' },
  btnArrow: { fontSize: 24, color: '#fff' },
  
  quitBtnFull: { borderRadius: 60, overflow: 'hidden', backgroundColor: '#dc2626', shadowColor: '#ff0000', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5, width: '100%' },
  quitBtnFullGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#e20c0c' },
  quitBtnIcon: { fontSize: 22, color: '#fff' },
  quitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  
  scoreBoard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#00000030', borderRadius: 28, padding: 20, marginBottom: 28, width: '100%' },
  scorePlayer: { flex: 1, alignItems: 'center' },
  scoreAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ffffff15', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  scoreAvatarText: { fontSize: 22 },
  scoreName: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  scorePoints: { color: '#fff', fontSize: 28, fontWeight: '900' },
  scoreDivider: { paddingHorizontal: 16, alignItems: 'center' },
  scoreDividerLine: { width: 40, height: 1, backgroundColor: '#ffffff30', marginVertical: 4 },
  scoreDividerText: { color: '#ffffff80', fontSize: 12, fontWeight: '700' },
  
  // Styles pour les écrans d'abandon
  abandonVictoryContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  abandonVictoryCard: { borderRadius: 48, padding: 28, alignItems: 'center', overflow: 'hidden', shadowColor: '#0b4d20', shadowOpacity: 0.5, shadowRadius: 30, elevation: 25, width: '100%' },
  abandonVictoryGlow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#16a34a', top: -80, alignSelf: 'center' },
  starsContainer: { position: 'absolute', width: '100%', height: '100%' },
  star: { position: 'absolute', fontSize: 22, opacity: 0.6 },
  abandonVictoryHeader: { alignItems: 'center', marginBottom: 24, zIndex: 1 },
  abandonVictoryIconWrapper: { marginBottom: 16 },
  abandonVictoryIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowColor: '#f5a623', shadowOpacity: 0.5, shadowRadius: 20 },
  abandonVictoryIcon: { fontSize: 44 },
  abandonVictoryTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2, marginBottom: 12, textAlign: 'center' },
  abandonVictoryBadge: { backgroundColor: '#ffffff20', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 40 },
  abandonVictoryBadgeText: { color: '#ffd166', fontSize: 13, fontWeight: '700' },
  abandonInfoCard: { backgroundColor: '#00000030', borderRadius: 28, padding: 20, width: '100%', marginBottom: 20 },
  abandonInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  abandonInfoLabel: { color: '#ffffffaa', fontSize: 14, fontWeight: '600' },
  abandonInfoValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  abandonDivider: { height: 1, backgroundColor: '#ffffff20', marginVertical: 8 },
  abandonScoreBoard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#00000030', borderRadius: 28, padding: 20, marginBottom: 28, width: '100%' },
  abandonScoreItem: { flex: 1, alignItems: 'center' },
  abandonScoreLabel: { color: '#ffffffaa', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  abandonScoreValue: { color: '#fff', fontSize: 32, fontWeight: '900' },
  abandonScoreDivider: { paddingHorizontal: 16 },
  abandonScoreDividerText: { fontSize: 24, opacity: 0.7 },
  
  abandonDefeatContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  abandonDefeatCard: { borderRadius: 48, padding: 28, alignItems: 'center', overflow: 'hidden', shadowColor: '#6a1515', shadowOpacity: 0.5, shadowRadius: 30, elevation: 25, width: '100%' },
  abandonDefeatHeader: { alignItems: 'center', marginBottom: 24, zIndex: 1 },
  abandonDefeatIconWrapper: { marginBottom: 16 },
  abandonDefeatIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowColor: '#f05252', shadowOpacity: 0.4, shadowRadius: 20 },
  abandonDefeatIcon: { fontSize: 44 },
  abandonDefeatTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2, marginBottom: 12, textAlign: 'center' },
  abandonDefeatBadge: { backgroundColor: '#ffffff15', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 40 },
  abandonDefeatBadgeText: { color: '#f05252', fontSize: 13, fontWeight: '700' },
  abandonInfoCardDefeat: { backgroundColor: '#00000030', borderRadius: 28, padding: 20, width: '100%', marginBottom: 20 },
  abandonInfoRowDefeat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  abandonInfoLabelDefeat: { color: '#ffffffaa', fontSize: 14, fontWeight: '600' },
  abandonInfoValueDefeat: { color: '#fff', fontSize: 24, fontWeight: '900' },
  abandonDividerDefeat: { height: 1, backgroundColor: '#ffffff20', marginVertical: 8 },
  abandonScoreBoardDefeat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#00000030', borderRadius: 28, padding: 20, marginBottom: 20, width: '100%' },
  abandonScoreItemDefeat: { flex: 1, alignItems: 'center' },
  abandonScoreLabelDefeat: { color: '#ffffffaa', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  abandonScoreValueDefeat: { color: '#fff', fontSize: 32, fontWeight: '900' },
  abandonScoreDividerDefeat: { paddingHorizontal: 16 },
  abandonScoreDividerTextDefeat: { fontSize: 24, opacity: 0.7 },
  abandonMessageCard: { backgroundColor: '#ffffff10', borderRadius: 24, padding: 20, alignItems: 'center', width: '100%', marginBottom: 28 },
  abandonMessageIcon: { fontSize: 32, marginBottom: 12 },
  abandonMessageTitle: { color: '#ffd166', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  abandonMessageText: { color: '#ffffffcc', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  
  // Styles modaux
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' },
  modalBox: { borderRadius: 28, padding: 24, width: SCREEN_WIDTH - 48, alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  niveauxModalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 24 },
  niveauModalChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', minWidth: 80 },
  niveauModalIcon: { fontSize: 24, marginBottom: 4 },
  niveauModalLabel: { fontSize: 12, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  btnAnnulerModal: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.bgCardLit, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  btnAnnulerModalTxt: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  btnValiderModal: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnValiderModalTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  
  resultatCard: { borderRadius: 26, padding: 28, alignItems: 'center', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, elevation: 16 },
  resultatGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -40, alignSelf: 'center' },
  resultatEmoji: { fontSize: 72, marginBottom: 8 },
  resultatTitre: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 2.5, marginBottom: 6 },
  resultatMystere: { color: '#ffffffcc', fontSize: 15, marginBottom: 24 },
  resultatMystereVal: { color: '#fff', fontWeight: '900', fontSize: 20 },
  resultatStats: { flexDirection: 'row', backgroundColor: '#00000028', borderRadius: 16, padding: 18, marginBottom: 16, width: '100%', borderWidth: 1, borderColor: '#ffffff18' },
  resultatStatCol: { flex: 1, alignItems: 'center' },
  resultatStatVal: { color: '#fff', fontSize: 24, fontWeight: '900' },
  resultatStatKey: { color: '#ffffff80', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 3 },
  resultatStatSep: { width: 1, backgroundColor: '#ffffff20' },
  resultatAdversaire: { backgroundColor: '#00000020', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginBottom: 24, borderWidth: 1, borderColor: '#ffffff15' },
  resultatAdvLabel: { color: '#ffffff99', fontSize: 12 },
  resultatAdvVal: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },
  resultatAdvPoints: { color: '#ffffffcc', fontSize: 13, fontWeight: '700' },
  resultatBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  resultatBtnSecond: { flex: 1, backgroundColor: '#ffffff22', paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#ffffff30' },
  resultatBtnSecondText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  
  adversairePartiTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  adversairePartiSub: { color: C.textBody, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  statutTour: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, marginBottom: 12 },
  statutTourActif: { backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.green },
  statutTourInactif: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  statutTourTexte: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginLeft: 8 },
});

export default MondeDuel;