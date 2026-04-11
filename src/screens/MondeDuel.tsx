// src/screens/MondeDuel.tsx
// ═══════════════════════════════════════════════════════════════════════════════
//  MONDE DUEL — Version avec READY CHECK, timer serveur unique et gestion des abandons
//  - READY CHECK: synchronisation parfaite des deux joueurs avant le duel
//  - Envoi automatique de 'pret' dès que l'adversaire est connu
//  - Le timer est géré UNIQUEMENT par le serveur
//  - Le client n'affiche que le temps restant
//  - defaite_par_abandon : écran pour l'abandonneur (bouton MENU)
//  - victoire_par_abandon : notification + écran pour l'adversaire (bouton MENU)
//  - NOUVEAU: quitter_proprement sans conséquence (bouton QUITTER)
//  - NOUVEAU: annuler_salle sans abandon (quand pas d'adversaire)
//  - CORRECTION: couleur rouge pour les écrans de défaite
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Animated, Easing, Platform, Share, Clipboard,
  Vibration, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, LEVEL_THEMES as LT } from '../styles/theme';
import { PseudoBadge } from '../components/PseudoBadge';
import { useDuel, type EtatDuel, type PropositionDuel } from '../hooks/useDuel';
import { Classement } from './Classement';

type Props = {
  onRetour:        () => void;
  pseudo?:         string;
  onPseudoChange?: (p: string) => void;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const MondeDuel: React.FC<Props> = ({
  onRetour, pseudo = 'Joueur', onPseudoChange,
}) => {
  const duel = useDuel(pseudo);
  const [showClassement, setShowClassement] = useState(false);
  
  // État pour la victoire par abandon
  const [showVictoireAbandonScreen, setShowVictoireAbandonScreen] = useState(false);
  const [notificationAbandon, setNotificationAbandon] = useState<{ 
    visible: boolean; 
    adversaire: string; 
    pointsGagnes: number 
  }>({ 
    visible: false, 
    adversaire: '',
    pointsGagnes: 0 
  });

  // NOUVEAU: État pour la notification quand l'adversaire quitte proprement
  const [notificationAdversaireQuitte, setNotificationAdversaireQuitte] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: '' });

  // Surveiller l'état 'adversaire_a_quitte' pour afficher la notification
  useEffect(() => {
    if (duel.etat === 'adversaire_a_quitte') {
      setNotificationAdversaireQuitte({
        visible: true,
        message: "Votre adversaire a quitté la partie. Vous gardez vos points gagnés."
      });
    }
  }, [duel.etat]);

  const handleAdversaireQuitteOk = () => {
    setNotificationAdversaireQuitte({ visible: false, message: '' });
    duel.reinitialiser();
    onRetour();
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
        return <EcranVictoireManche duel={duel} pseudo={pseudo} onQuitter={duel.quitterProprement} />;
      case 'defaite_manche':
        return <EcranDefaiteManche duel={duel} pseudo={pseudo} onQuitter={duel.quitterProprement} />;
      
      case 'victoire_par_abandon':
        if (showVictoireAbandonScreen) {
          return <EcranVictoireParAbandon 
            duel={duel} 
            pseudo={pseudo} 
            onRetour={() => {
              setShowVictoireAbandonScreen(false);
              duel.reinitialiser();
              onRetour();
            }} 
          />;
        }
        
        if (!notificationAbandon.visible && duel.abandonData && !showVictoireAbandonScreen) {
          setNotificationAbandon({ 
            visible: true, 
            adversaire: duel.adversairePseudo || 'Adversaire',
            pointsGagnes: duel.abandonData.pointsGagnes 
          });
          return null;
        }
        
        return null;
      
      case 'defaite_par_abandon':
        return <EcranDefaiteParAbandon 
          duel={duel} 
          pseudo={pseudo} 
          onRetour={() => {
            duel.reinitialiser();
            onRetour();
          }} 
        />;
      
      case 'victoire':
      case 'defaite':
      case 'egal':
        return <EcranResultat duel={duel} pseudo={pseudo} />;
      case 'adversaire_parti':
        return <EcranAdversaireParti duel={duel} />;
      case 'adversaire_a_quitte':
        // L'affichage se fait via la notification modale, on retourne null
        return null;
      default:
        return <EcranAccueil duel={duel} onRetour={onRetour} />;
    }
  };

  const handleNotificationOk = () => {
    setNotificationAbandon({ visible: false, adversaire: '', pointsGagnes: 0 });
    setShowVictoireAbandonScreen(true);
  };

  return (
    <>
      <View style={S.root}>
        <LinearGradient colors={[C.bgDeep, C.bg, '#0d1628']} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity
            onPress={() => {
              if (duel.etat === 'attente') {
                // En attente, on annule sans conséquence
                duel.annulerSalle();
                onRetour();
              } else if (duel.etat === 'idle') {
                onRetour();
              } else {
                duel.abandonner();
              }
            }}
            style={S.backBtn}
            activeOpacity={0.75}
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
                  {duel.etat === 'victoire_manche' && '🎉  NIVEAU GAGNÉ'}
                  {duel.etat === 'defaite_manche' && '⏸️  EN ATTENTE'}
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
            <TouchableOpacity
              onPress={() => setShowClassement(true)}
              style={S.classementBtn}
              activeOpacity={0.75}
            >
              <Text style={S.classementBtnText}>🏆</Text>
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

      {/* Modal Classement */}
      <Modal
        visible={showClassement}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <Classement
          onRetour={() => setShowClassement(false)}
          pseudo={pseudo}
          onPseudoChange={onPseudoChange}
        />
      </Modal>

      {/* Notification d'abandon pour l'adversaire */}
      <NotificationAbandon 
        visible={notificationAbandon.visible} 
        adversaire={notificationAbandon.adversaire}
        pointsGagnes={notificationAbandon.pointsGagnes}
        onOk={handleNotificationOk}
      />

      {/* NOUVEAU: Notification quand l'adversaire quitte proprement */}
      <NotificationAdversaireQuitte
        visible={notificationAdversaireQuitte.visible}
        message={notificationAdversaireQuitte.message}
        onOk={handleAdversaireQuitteOk}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATION ABANDON (pour l'adversaire)
// ═══════════════════════════════════════════════════════════════════════════════

const NotificationAbandon: React.FC<{ 
  visible: boolean; 
  adversaire: string; 
  pointsGagnes: number; 
  onOk: () => void;
}> = ({ visible, adversaire, pointsGagnes, onOk }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);
  
  if (!visible) return null;
  
  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={[S.notificationOverlay, { opacity: fadeAnim }]}>
        <View style={S.notificationCard}>
          <Text style={S.notificationEmoji}>⚠️</Text>
          <Text style={S.notificationTitle}>Abandon de l'adversaire</Text>
          <Text style={S.notificationMessage}>
            {adversaire} a abandonné le match.{'\n'}
            Vous gagnez <Text style={{ fontWeight: 'bold', color: C.gold }}>+{pointsGagnes} points</Text> du niveau actuel.
          </Text>
          <TouchableOpacity onPress={onOk} style={S.notificationBtn} activeOpacity={0.85}>
            <LinearGradient colors={['#3d1a8a', '#6d28d9']} style={S.notificationBtnGrad}>
              <Text style={S.notificationBtnText}>OK</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  NOUVEAU: NOTIFICATION QUAND L'ADVERSAIRE QUITTE PROPREMENT
// ═══════════════════════════════════════════════════════════════════════════════

const NotificationAdversaireQuitte: React.FC<{
  visible: boolean;
  message: string;
  onOk: () => void;
}> = ({ visible, message, onOk }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);
  
  if (!visible) return null;
  
  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={[S.notificationOverlay, { opacity: fadeAnim }]}>
        <View style={[S.notificationCard, { borderColor: C.blue }]}>
          <Text style={S.notificationEmoji}>🚪</Text>
          <Text style={S.notificationTitle}>Adversaire parti</Text>
          <Text style={S.notificationMessage}>{message}</Text>
          <TouchableOpacity onPress={onOk} style={S.notificationBtn} activeOpacity={0.85}>
            <LinearGradient colors={['#3d1a8a', '#6d28d9']} style={S.notificationBtnGrad}>
              <Text style={S.notificationBtnText}>OK</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN ACCUEIL
// ═══════════════════════════════════════════════════════════════════════════════

const EcranAccueil: React.FC<{ duel: ReturnType<typeof useDuel>; onRetour: () => void }> = ({
  duel, onRetour,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [onglet, setOnglet] = useState<'creer' | 'rejoindre'>('creer');
  const [enCreation, setEnCreation] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleCreerSalle = async () => {
    if (enCreation) return;
    setEnCreation(true);
    try {
      await duel.creerSalle(1);
    } catch (err) {
      console.log('❌ Erreur:', err);
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
        <TouchableOpacity
          onPress={() => setOnglet('creer')}
          style={[S.onglet, onglet === 'creer' && S.ongletActif]}
          activeOpacity={0.75}
        >
          <Text style={[S.ongletText, onglet === 'creer' && S.ongletTextActif]}>➕  Créer une salle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOnglet('rejoindre')}
          style={[S.onglet, onglet === 'rejoindre' && S.ongletActif]}
          activeOpacity={0.75}
        >
          <Text style={[S.ongletText, onglet === 'rejoindre' && S.ongletTextActif]}>🔑  Rejoindre</Text>
        </TouchableOpacity>
      </View>

      {onglet === 'creer' ? (
        <>
          <View style={S.niveauInfoCard}>
            <LinearGradient colors={['#0d2554', '#1a4fd6']} style={S.niveauInfoGrad}>
              <Text style={S.niveauInfoEmoji}>🌱</Text>
              <Text style={S.niveauInfoTitle}>NIVEAU 1 (OBLIGATOIRE)</Text>
              <Text style={S.niveauInfoDesc}>Débutant — Intervalle 1 à 100</Text>
              <Text style={S.niveauInfoEssais}>10 essais maximum</Text>
              <Text style={S.niveauInfoPoints}>🏆 +1000 points à gagner</Text>
            </LinearGradient>
          </View>

          {duel.erreur ? (
            <View style={S.erreurBox}>
              <Text style={S.erreurText}>⚠  {duel.erreur}</Text>
            </View>
          ) : null}

          <TouchableOpacity 
            onPress={handleCreerSalle} 
            activeOpacity={0.85}
            disabled={enCreation}
          >
            <LinearGradient colors={enCreation ? [C.bgCard, C.bgCard] : ['#3d1a8a', '#6d28d9']} style={S.btnPrimary}>
              <Text style={[S.btnPrimaryText, enCreation && { color: C.textHint }]}>
                {enCreation ? '🔄  CRÉATION EN COURS...' : '⚔️  CRÉER LE DUEL (NIVEAU 1)'}
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
            <Text style={S.codeInputHint}>
              {codeInput.length}/6 — demande le code à ton adversaire
            </Text>
          </View>

          {duel.erreur ? (
            <View style={S.erreurBox}>
              <Text style={S.erreurText}>⚠  {duel.erreur}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => duel.rejoindreSalle(codeInput)}
            activeOpacity={0.85}
            disabled={codeInput.length < 6}
          >
            <LinearGradient
              colors={codeInput.length === 6 ? ['#3d1a8a','#6d28d9'] : [C.bgCard, C.bgCard]}
              style={S.btnPrimary}
            >
              <Text style={[S.btnPrimaryText, codeInput.length < 6 && { color: C.textHint }]}>
                🔑  REJOINDRE LE DUEL
              </Text>
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
    Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
    ).start();
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
//  ÉCRAN ATTENTE (avec envoi automatique de PRET)
//  MODIFIÉ: bouton Annuler appelle annulerSalle() au lieu de abandonner()
// ═══════════════════════════════════════════════════════════════════════════════

const EcranAttente: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onAnnuler: () => void }> = ({
  duel, pseudo, onAnnuler,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  // Envoi automatique de PRET dès que l'adversaire est connu
  useEffect(() => {
    if (duel.adversairePseudo && duel.etat === 'attente') {
      const timer = setTimeout(() => {
        duel.envoyerPret();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [duel.adversairePseudo, duel.etat, duel.envoyerPret]);

  const partagerCode = async () => {
    try {
      await Share.share({ message: `Rejoins mon duel Nombre Mystère ! Code : ${duel.codeSalle}` });
    } catch { /* ignoré */ }
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
          <Text style={S.adversaireConnecteText}>
            {duel.adversairePseudo} a rejoint la salle !
          </Text>
          <Text style={S.adversaireConnecteSub}>Préparation du duel...</Text>
        </View>
      ) : (
        <>
          <View style={S.codeCard}>
            <Text style={S.codeCardLabel}>TON CODE DE SALLE</Text>
            <Text style={S.codeCardValue}>{duel.codeSalle}</Text>
            <View style={S.codeBtnsRow}>
              <TouchableOpacity onPress={copierCode} style={S.codeCopyBtn} activeOpacity={0.75}>
                <Text style={S.codeCopyText}>{copie ? '✓ Copié !' : '📋 Copier'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={partagerCode} style={S.codeShareBtn} activeOpacity={0.75}>
                <LinearGradient colors={['#3d1a8a', '#6d28d9']} style={S.codeShareGrad}>
                  <Text style={S.codeShareText}>📤 Partager</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={S.attenteNote}>
            Le duel démarrera automatiquement{'\n'}dès que ton adversaire aura rejoint
          </Text>
        </>
      )}

      {/* MODIFIÉ: appel à onAnnuler au lieu de duel.abandonner */}
      <TouchableOpacity onPress={onAnnuler} style={S.btnAnnuler} activeOpacity={0.75}>
        <Text style={S.btnAnnulerText}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN COMPTE À REBOURS
// ═══════════════════════════════════════════════════════════════════════════════

const EcranCompteARebours: React.FC<{ compte: number; adversaire: string }> = ({
  compte, adversaire,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    return () => scaleAnim.setValue(0.5);
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
      <Text style={S.compteSous}>
        {compte > 0 ? 'Prépare-toi !' : 'C\'EST PARTI !'}
      </Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN JEU EN COURS
// ═══════════════════════════════════════════════════════════════════════════════

const EcranJeu: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string }> = ({
  duel, pseudo,
}) => {
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');

  const twAnim   = useRef(new Animated.Value(1)).current;
  const pulseAnim= useRef(new Animated.Value(1)).current;
  const shakeAnim= useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const { niveauConfig, tempsRestant, adversairePseudo, essaisRestants, derniereProposition, propositions, monTour } = duel;

  useEffect(() => {
    Animated.timing(twAnim, {
      toValue: tempsRestant / 30,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    if (tempsRestant <= 10 && !pulseRef.current && tempsRestant > 0) {
      pulseRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      pulseRef.current.start();
    } else if ((tempsRestant > 10 || tempsRestant === 0) && pulseRef.current) {
      pulseRef.current.stop();
      pulseRef.current = null;
      pulseAnim.setValue(1);
    }
  }, [tempsRestant]);

  const shakeInput = () => Animated.sequence([
    Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 6,   duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
  ]).start();

  const handleSubmit = () => {
    const val = parseInt(saisie, 10);
    if (isNaN(val)) {
      setErreur('Entrez un nombre valide');
      shakeInput();
      return;
    }
    if (val < niveauConfig.min || val > niveauConfig.max) {
      setErreur(`Entre ${niveauConfig.min} et ${niveauConfig.max}`);
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

  const tc = tempsRestant > 20 ? C.green : tempsRestant > 10 ? C.amber : C.red;
  const ec = essaisRestants / niveauConfig.essaisMax > 0.6 ? C.green :
             essaisRestants / niveauConfig.essaisMax > 0.3 ? C.amber : C.red;

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
              <Animated.View style={[S.vsTimerFill, {
                width: twAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }),
                backgroundColor: tc,
              }]} />
            </View>
          </Animated.View>
        </View>

        <View style={[S.vsJoueur, { alignItems: 'flex-end' }]}>
          <Text style={S.vsNom} numberOfLines={1}>{adversairePseudo ?? '...'}</Text>
          <Text style={S.vsScore}>{duel.essaisAdversaire}</Text>
          <Text style={S.vsScoreLabel}>essais</Text>
        </View>
      </View>

      <View style={S.intervalleCard}>
        <Text style={S.intervalleLabel}>INTERVALLE DU NIVEAU {duel.niveau}</Text>
        <View style={S.intervalleRow}>
          <Text style={S.intervalleNum}>{niveauConfig.min}</Text>
          <View style={S.intervalleBar}>
            <LinearGradient colors={['#3d1a8a','#6d28d9']} style={StyleSheet.absoluteFill} />
          </View>
          <Text style={S.intervalleNum}>{niveauConfig.max}</Text>
        </View>
      </View>

      {derniereProposition && (
        <View style={[S.indiceBox,
          derniereProposition.indice === 'plus'  && S.indicePlus,
          derniereProposition.indice === 'moins' && S.indiceMoins,
          derniereProposition.indice === 'egal'  && S.indiceEgal,
        ]}>
          <Text style={S.indiceNum}>{derniereProposition.valeur}</Text>
          <View style={S.indiceSep} />
          <View>
            <Text style={[S.indiceMsg,
              derniereProposition.indice === 'plus'  && { color: C.blue  },
              derniereProposition.indice === 'moins' && { color: C.red   },
              derniereProposition.indice === 'egal'  && { color: C.green },
            ]}>
              {derniereProposition.indice === 'plus'  && "↑  C'est PLUS GRAND"}
              {derniereProposition.indice === 'moins' && "↓  C'est PLUS PETIT"}
              {derniereProposition.indice === 'egal'  && '✓  TROUVÉ !'}
            </Text>
            <Text style={S.indiceHint}>
              {derniereProposition.indice === 'plus'  && `Le nombre est > ${derniereProposition.valeur}`}
              {derniereProposition.indice === 'moins' && `Le nombre est < ${derniereProposition.valeur}`}
              {derniereProposition.indice === 'egal'  && 'Tu as gagné ce niveau !'}
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
            onChangeText={t => { setSaisie(t); setErreur(''); }}
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
          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={essaisRestants === 0 || !monTour}
            style={[S.btnProposer, (essaisRestants === 0 || !monTour) && { opacity: 0.35 }]}
          >
            <LinearGradient
              colors={(essaisRestants === 0 || !monTour) ? [C.bgCard, C.bgCard] : ['#3d1a8a','#6d28d9']}
              style={S.btnProposerGrad}
            >
              <Text style={S.btnProposerText}>
                {!monTour ? 'EN ATTENTE' : 'PROPOSER'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={duel.abandonner} style={S.btnAbandonner} activeOpacity={0.75}>
  <View style={{ alignItems: 'center' }}>
    <Text style={S.btnAbandonnerText}>🏳️</Text>
    <Text style={{ fontSize: 9, color: C.red, marginTop: 2 }}>Abandon</Text>
  </View>
</TouchableOpacity>
        </View>
      </View>

      {propositions.length > 0 && (
        <View style={S.histSection}>
          <Text style={S.histTitle}>HISTORIQUE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
            {[...propositions].reverse().map((p, i) => (
              <View key={i} style={[S.histChip,
                p.indice === 'plus'  && S.histChipPlus,
                p.indice === 'moins' && S.histChipMoins,
                p.indice === 'egal'  && S.histChipEgal,
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
//  ÉCRAN VICTOIRE DE MANCHE
//  MODIFIÉ: ajout du bouton QUITTER à côté du bouton NIVEAU SUIVANT
// ═══════════════════════════════════════════════════════════════════════════════

const EcranVictoireManche: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onQuitter: () => void }> = ({
  duel, pseudo, onQuitter,
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.2, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  const estDernierNiveau = duel.niveau === 4;
  const prochainPoints = duel.niveau === 1 ? 2000 : duel.niveau === 2 ? 3000 : 5000;

  return (
    <Animated.View style={{
      opacity: bounceAnim,
      transform: [{ scale: bounceAnim.interpolate({ inputRange: [0,1], outputRange: [0.65,1] }) }],
    }}>
      <LinearGradient colors={['#04200e', '#0b4d20', '#16a34a']} style={S.victoireMancheCard} start={{ x:0,y:0 }} end={{ x:1,y:1 }}>
        <Animated.View style={[S.victoireMancheGlow, { backgroundColor: C.green, opacity: glowAnim }]} />

        <Text style={S.victoireMancheEmoji}>🎉</Text>
        <Text style={S.victoireMancheTitre}>NIVEAU {duel.niveau} GAGNÉ !</Text>
        <Text style={S.victoireManchePoints}>+{duel.pointsNiveauGagnes} points</Text>

        <View style={S.victoireMancheScore}>
          <Text style={S.victoireMancheScoreJoueur}>{pseudo} : {duel.pointsJoueur}</Text>
          <Text style={S.victoireMancheScoreSep}>-</Text>
          <Text style={S.victoireMancheScoreAdversaire}>{duel.adversairePseudo} : {duel.pointsAdversaire}</Text>
        </View>

        {!estDernierNiveau ? (
          <>
            {!duel.confirmationEnvoyee ? (
              <View style={S.btnsRowManche}>
                <TouchableOpacity onPress={duel.continuerMancheSuivante} style={[S.btnSuivant, { flex: 2 }]} activeOpacity={0.85}>
                  <LinearGradient colors={['#3d1a8a', '#6d28d9']} style={S.btnSuivantGrad}>
                    <Text style={S.btnSuivantText}>NIVEAU {duel.niveau + 1} →</Text>
                    <Text style={S.btnSuivantPoints}>+{prochainPoints} pts</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={onQuitter} style={[S.btnQuitterManche, { flex: 1 }]} activeOpacity={0.85}>
  <LinearGradient colors={[C.bgCardLit, C.bgCard]} style={S.btnQuitterMancheGrad}>
    <Text style={[S.btnQuitterMancheText, { color: C.textBody }]}>🚪 Quitter</Text>
  </LinearGradient>
</TouchableOpacity>
              </View>
            ) : (
              <View style={S.attenteConfirmation}>
                <Text style={S.attenteConfirmationText}>
                  {duel.adversaireAConfirme 
                    ? "✅ L'adversaire a confirmé, attente de votre confirmation..." 
                    : "⏳ En attente de la confirmation de l'adversaire..."}
                </Text>
                {duel.confirmationEnvoyee && !duel.adversaireAConfirme && (
                  <Text style={S.attenteConfirmationSub}>Votre confirmation a été envoyée</Text>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={S.btnsRowManche}>
            <TouchableOpacity onPress={duel.reinitialiser} style={[S.btnSuivant, { flex: 2 }]} activeOpacity={0.85}>
              <LinearGradient colors={['#3d1a8a', '#6d28d9']} style={S.btnSuivantGrad}>
                <Text style={S.btnSuivantText}>VOIR RÉSULTAT FINAL</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onQuitter} style={[S.btnQuitterManche, { flex: 1 }]} activeOpacity={0.85}>
  <LinearGradient colors={[C.bgCardLit, C.bgCard]} style={S.btnQuitterMancheGrad}>
    <Text style={[S.btnQuitterMancheText, { color: C.textBody }]}>🚪 Quitter</Text>
  </LinearGradient>
</TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN DÉFAITE DE MANCHE
//  MODIFIÉ: couleur rouge (au lieu d'orange) + ajout du bouton QUITTER
// ═══════════════════════════════════════════════════════════════════════════════

const EcranDefaiteManche: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onQuitter: () => void }> = ({
  duel, pseudo, onQuitter,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  const estDernierNiveau = duel.niveau === 4;
  const prochainPoints = duel.niveau === 1 ? 2000 : duel.niveau === 2 ? 3000 : 5000;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {/* COULEUR MODIFIÉE: rouge au lieu d'orange */}
      <LinearGradient colors={['#200404', '#5a0808', '#b91c1c']} style={S.victoireMancheCard} start={{ x:0,y:0 }} end={{ x:1,y:1 }}>
        <Animated.View style={[S.victoireMancheGlow, { backgroundColor: C.red, opacity: 0.2 }]} />

        <Animated.Text style={[S.victoireMancheEmoji, { transform: [{ scale: pulseAnim }] }]}>💀</Animated.Text>
        <Text style={[S.victoireMancheTitre, { color: C.red }]}>DÉFAITE AU NIVEAU {duel.niveau}</Text>
        
        {!estDernierNiveau ? (
          <>
            <Text style={S.victoireManchePoints}>L'adversaire a gagné ce niveau</Text>
            <Text style={S.attenteNote}>
              {prochainPoints} points à gagner pour la prochaine match
            </Text>
            
            {!duel.confirmationEnvoyee ? (
              <View style={S.btnsRowManche}>
                <TouchableOpacity onPress={duel.continuerMancheSuivante} style={[S.btnSuivant, { flex: 2 }]} activeOpacity={0.85}>
                  <LinearGradient colors={['#3d1a8a', '#6d28d9']} style={S.btnSuivantGrad}>
                    <Text style={S.btnSuivantText}>NIVEAU {duel.niveau + 1} </Text>
                    <Text style={S.btnSuivantPoints}>+{prochainPoints} pts</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={onQuitter} style={[S.btnQuitterManche, { flex: 1 }]} activeOpacity={0.85}>
                  <LinearGradient colors={['#4a1a2a', '#7a2a3a']} style={S.btnQuitterMancheGrad}>
                    <Text style={S.btnQuitterMancheText}>🚪 Quitter</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={S.attenteConfirmation}>
                <Text style={S.attenteConfirmationText}>
                  {duel.adversaireAConfirme 
                    ? "✅ L'adversaire a confirmé, attente de votre confirmation..." 
                    : "⏳ En attente de la confirmation de l'adversaire..."}
                </Text>
                {duel.confirmationEnvoyee && !duel.adversaireAConfirme && (
                  <Text style={S.attenteConfirmationSub}>Votre confirmation a été envoyée</Text>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={S.btnsRowManche}>
            <TouchableOpacity onPress={duel.reinitialiser} style={[S.btnSuivant, { flex: 2 }]} activeOpacity={0.85}>
              <LinearGradient colors={['#3d1a8a', '#6d28d9']} style={S.btnSuivantGrad}>
                <Text style={S.btnSuivantText}>VOIR RÉSULTAT FINAL</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onQuitter} style={[S.btnQuitterManche, { flex: 1 }]} activeOpacity={0.85}>
              <LinearGradient colors={['#4a1a2a', '#7a2a3a']} style={S.btnQuitterMancheGrad}>
                <Text style={S.btnQuitterMancheText}>🚪 Quitter</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={S.victoireMancheScore}>
          <Text style={S.victoireMancheScoreJoueur}>{pseudo} : {duel.pointsAdversaire}</Text>
          <Text style={S.victoireMancheScoreSep}>vs</Text>
          <Text style={S.victoireMancheScoreAdversaire}>{duel.adversairePseudo} :{duel.pointsJoueur} </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN VICTOIRE PAR ABANDON (pour l'adversaire)
// ═══════════════════════════════════════════════════════════════════════════════

const EcranVictoireParAbandon: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onRetour: () => void }> = ({
  duel, pseudo, onRetour,
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.2, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  const pointsGagnes = duel.abandonData?.pointsGagnes || 0;
  const niveauAbandon = duel.abandonData?.niveau || duel.niveau;

  return (
    <Animated.View style={{ opacity: bounceAnim, transform: [{ scale: bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }] }}>
      <LinearGradient colors={['#04200e', '#0b4d20', '#16a34a']} style={S.resultatCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Animated.View style={[S.resultatGlow, { backgroundColor: C.green, opacity: glowAnim }]} />
        
        <Text style={S.resultatEmoji}>🏆</Text>
        <Text style={S.resultatTitre}>VICTOIRE PAR ABANDON !</Text>
        <Text style={S.resultatMystere}>Votre adversaire a abandonné au niveau {niveauAbandon}</Text>
        
        <View style={S.finStats}>
          <View style={S.finStatCol}>
            <Text style={[S.finStatVal, { color: C.gold }]}>+{pointsGagnes}</Text>
            <Text style={S.finStatKey}>POINTS GAGNÉS</Text>
          </View>
          <View style={S.finStatSep} />
          <View style={S.finStatCol}>
            <Text style={S.finStatVal}>{duel.pointsJoueur}</Text>
            <Text style={S.finStatKey}>TOTAL POINTS</Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={onRetour} style={S.finBtnPrimary} activeOpacity={0.85}>
          <LinearGradient colors={[C.blueDark, C.blue]} style={{ paddingVertical: 15, borderRadius: 14, alignItems: 'center' }}>
            <Text style={[S.finBtnText, { color: '#fff' }]}>← MENU</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN DÉFAITE PAR ABANDON (pour l'abandonneur)
//  MODIFIÉ: couleur rouge
// ═══════════════════════════════════════════════════════════════════════════════

const EcranDefaiteParAbandon: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string; onRetour: () => void }> = ({
  duel, pseudo, onRetour,
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.2, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <Animated.View style={{ opacity: bounceAnim, transform: [{ scale: bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }] }}>
      <LinearGradient colors={['#200404', '#5a0808', '#b91c1c']} style={S.resultatCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Animated.View style={[S.resultatGlow, { backgroundColor: C.red, opacity: glowAnim }]} />
        
        <Text style={S.resultatEmoji}>💀</Text>
        <Text style={S.resultatTitre}>DÉFAITE PAR ABANDON</Text>
        <Text style={S.resultatMystere}>Vous avez abandonné le match</Text>
        
        <View style={S.finStats}>
          <View style={S.finStatCol}>
            <Text style={[S.finStatVal, { color: C.red }]}>0</Text>
            <Text style={S.finStatKey}>POINTS GAGNÉS</Text>
          </View>
          <View style={S.finStatSep} />
          <View style={S.finStatCol}>
            <Text style={S.finStatVal}>{duel.pointsJoueur}</Text>
            <Text style={S.finStatKey}>TOTAL POINTS</Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={onRetour} style={S.finBtnPrimary} activeOpacity={0.85}>
          <LinearGradient colors={[C.blueDark, C.blue]} style={{ paddingVertical: 15, borderRadius: 14, alignItems: 'center' }}>
            <Text style={[S.finBtnText, { color: '#fff' }]}>← MENU</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN RÉSULTAT FINAL
// ═══════════════════════════════════════════════════════════════════════════════

const EcranResultat: React.FC<{ duel: ReturnType<typeof useDuel>; pseudo: string }> = ({
  duel, pseudo,
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0.3)).current;
  const { etat, resultat } = duel;

  useEffect(() => {
    Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.2, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  const isVictoire = etat === 'victoire';
  const isEgal     = etat === 'egal';

  const config = isVictoire ? {
    emoji:  '🏆', titre: 'VICTOIRE !',
    colors: ['#04200e', '#0b4d20', '#16a34a'] as [string,string,string],
    glow:   C.green,
  } : isEgal ? {
    emoji:  '🤝', titre: 'ÉGALITÉ !',
    colors: ['#1a1004', '#3d2800', '#b07d0e'] as [string,string,string],
    glow:   C.gold,
  } : {
    emoji:  '💀', titre: 'DÉFAITE',
    colors: ['#200404', '#5a0808', '#b91c1c'] as [string,string,string],
    glow:   C.red,
  };

  return (
    <Animated.View style={{
      opacity: bounceAnim,
      transform: [{ scale: bounceAnim.interpolate({ inputRange: [0,1], outputRange: [0.65,1] }) }],
    }}>
      <LinearGradient colors={config.colors} style={S.resultatCard} start={{ x:0,y:0 }} end={{ x:1,y:1 }}>
        <Animated.View style={[S.resultatGlow, { backgroundColor: config.glow, opacity: glowAnim }]} />

        <Text style={S.resultatEmoji}>{config.emoji}</Text>
        <Text style={S.resultatTitre}>{config.titre}</Text>

        {resultat && (
          <>
            <Text style={S.resultatMystere}>
              Nombre mystère : <Text style={S.resultatMystereVal}>{resultat.nombreMystere}</Text>
            </Text>

            <View style={S.resultatStats}>
              <View style={S.resultatStatCol}>
                <Text style={S.resultatStatVal}>{resultat.essaisJoueur}</Text>
                <Text style={S.resultatStatKey}>TES ESSAIS</Text>
              </View>
              <View style={S.resultatStatSep} />
              <View style={S.resultatStatCol}>
                <Text style={[S.resultatStatVal, { color: C.gold }]}>+{resultat.pointsJoueur}</Text>
                <Text style={S.resultatStatKey}>POINTS</Text>
              </View>
              <View style={S.resultatStatSep} />
              <View style={S.resultatStatCol}>
                <Text style={S.resultatStatVal}>{resultat.duree}s</Text>
                <Text style={S.resultatStatKey}>DURÉE</Text>
              </View>
            </View>

            <View style={S.resultatAdversaire}>
              <Text style={S.resultatAdvLabel}>Adversaire :</Text>
              <Text style={S.resultatAdvVal}>{resultat.vainqueur && resultat.vainqueur !== pseudo ? resultat.vainqueur : duel.adversairePseudo}</Text>
              <Text style={S.resultatAdvPoints}>+{resultat.pointsAdversaire} pts</Text>
            </View>
          </>
        )}

        <View style={S.resultatBtns}>
          <TouchableOpacity onPress={duel.reinitialiser} style={S.resultatBtnSecond} activeOpacity={0.82}>
            <Text style={S.resultatBtnSecondText}>🔄  Rejouer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={duel.reinitialiser} style={S.resultatBtnSecond} activeOpacity={0.82}>
            <Text style={S.resultatBtnSecondText}>← Menu</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ÉCRAN ADVERSAIRE PARTI
// ═══════════════════════════════════════════════════════════════════════════════

const EcranAdversaireParti: React.FC<{ duel: ReturnType<typeof useDuel> }> = ({ duel }) => (
  <View style={S.centreEcran}>
    <Text style={{ fontSize: 64, marginBottom: 16 }}>🔌</Text>
    <Text style={S.adversairePartiTitle}>Adversaire déconnecté</Text>
    <Text style={S.adversairePartiSub}>Ton adversaire a quitté la partie.{'\n'}Victoire par forfait !</Text>
    <TouchableOpacity onPress={duel.reinitialiser} activeOpacity={0.85} style={{ marginTop: 32, width: '100%' }}>
      <LinearGradient colors={['#3d1a8a','#6d28d9']} style={S.btnPrimary}>
        <Text style={S.btnPrimaryText}>🔄  Nouveau duel</Text>
      </LinearGradient>
    </TouchableOpacity>
    <TouchableOpacity onPress={duel.reinitialiser} style={[S.btnAnnuler, { marginTop: 12 }]} activeOpacity={0.75}>
      <Text style={S.btnAnnulerText}>← Retour au menu</Text>
    </TouchableOpacity>
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES (ajout des nouveaux styles)
// ═══════════════════════════════════════════════════════════════════════════════

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bgCard,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.bgCardLit,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  backBtnText: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  headerMid: { flex: 1 },
  headerTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 2.5 },
  headerBadgeRow: { flexDirection: 'row', marginTop: 5 },
  headerStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerStateText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  classementBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.bgCardLit,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  classementBtnText: { fontSize: 20 },
  scroll: { padding: 16, paddingBottom: 52 },

  // Banner duel
  duelBanner: { borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 20, overflow: 'hidden', shadowColor: '#6d28d9', shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  duelBannerBg: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ffffff08', top: -60, right: -40 },
  duelBannerEmoji: { fontSize: 52, marginBottom: 10 },
  duelBannerTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 3, marginBottom: 8 },
  duelBannerSub: { color: '#ffffffcc', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Onglets
  ongletRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  onglet: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  ongletActif: { backgroundColor: '#1a0a3a', borderColor: '#6d28d9' },
  ongletText: { color: C.textSecond, fontSize: 13, fontWeight: '700' },
  ongletTextActif: { color: '#9d5ff5' },

  // Niveau info
  niveauInfoCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  niveauInfoGrad: { padding: 24, alignItems: 'center' },
  niveauInfoEmoji: { fontSize: 48, marginBottom: 8 },
  niveauInfoTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 2, marginBottom: 8 },
  niveauInfoDesc: { fontSize: 14, color: '#ffffffcc', marginBottom: 4 },
  niveauInfoEssais: { fontSize: 13, color: '#ffffffaa', fontWeight: '600', marginBottom: 4 },
  niveauInfoPoints: { fontSize: 13, color: '#f0b429', fontWeight: '800' },

  // Section label
  sectionLabel: { color: C.textSecond, fontSize: 11, fontWeight: '900', letterSpacing: 2.5, marginBottom: 12 },

  // Code input
  codeInputCard: { backgroundColor: C.bgCard, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  codeInputLabel: { color: C.textSecond, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  codeInput: { backgroundColor: C.bgCardLit, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderLit, paddingVertical: 18, paddingHorizontal: 20, color: C.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 8, marginBottom: 10 },
  codeInputHint: { color: C.textHint, fontSize: 12, textAlign: 'center' },

  // Erreur
  erreurBox: { backgroundColor: C.redBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.redDark, marginBottom: 16 },
  erreurRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  erreurDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red },
  erreurText: { color: C.red, fontSize: 13, fontWeight: '700' },

  // Boutons
  btnPrimary: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  btnAnnuler: { paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard },
  btnAnnulerText: { color: C.textBody, fontSize: 14, fontWeight: '700' },

  // Centre écran
  centreEcran: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },

  // Attente
  attenteIndicateur: { marginBottom: 20 },
  attenteTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  attenteSub: { color: C.textBody, fontSize: 15, marginBottom: 28, textAlign: 'center' },
  attenteNote: { color: C.textHint, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  // Code card
  codeCard: { backgroundColor: C.bgCard, borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#3d1a8a', alignItems: 'center', width: '100%', marginBottom: 24 },
  codeCardLabel: { color: C.textSecond, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  codeCardValue: { color: '#9d5ff5', fontSize: 42, fontWeight: '900', letterSpacing: 12, marginBottom: 18, textShadowColor: '#6d28d9', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  codeBtnsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  codeCopyBtn: { flex: 1, backgroundColor: C.bgCardLit, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  codeCopyText: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  codeShareBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  codeShareGrad: { paddingVertical: 13, alignItems: 'center' },
  codeShareText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Adversaire connecté (READY CHECK)
  adversaireConnecteCard: {
    backgroundColor: C.greenBg,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.green,
    width: '100%',
  },
  adversaireConnecteEmoji: { fontSize: 48, marginBottom: 12 },
  adversaireConnecteText: { color: C.green, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  adversaireConnecteSub: { color: C.textBody, fontSize: 14, textAlign: 'center' },

  // Chargement
  spinnerEmoji: { fontSize: 48, marginBottom: 20 },
  chargementText: { color: C.textBody, fontSize: 16, fontWeight: '600' },

  // Compte à rebours
  compteAdversaire: { color: C.textBody, fontSize: 16, fontWeight: '700', marginBottom: 20 },
  compteChiffre: { color: C.gold, fontSize: 96, fontWeight: '900', textShadowColor: C.gold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  compteSous: { color: C.textBody, fontSize: 18, fontWeight: '600', marginTop: 12 },

  // VS bandeau
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

  // Intervalle
  intervalleCard: { backgroundColor: C.bgCard, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  intervalleLabel: { color: C.textSecond, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  intervalleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intervalleNum: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  intervalleBar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: C.border },

  // Indice
  indiceBox: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard },
  indicePlus: { backgroundColor: C.blueBg, borderColor: C.blue },
  indiceMoins: { backgroundColor: C.redBg, borderColor: C.red },
  indiceEgal: { backgroundColor: C.greenBg, borderColor: C.green },
  indiceNum: { color: C.textPrimary, fontSize: 24, fontWeight: '900', minWidth: 50, textAlign: 'center' },
  indiceSep: { width: 1.5, height: 32, backgroundColor: C.border },
  indiceMsg: { fontSize: 15, fontWeight: '800' },
  indiceHint: { fontSize: 12, color: C.textBody, marginTop: 2, fontWeight: '500' },

  // Saisie
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
 btnAbandonner: { 
  width: 70,  // Élargi pour accueillir le texte
  backgroundColor: C.redBg, 
  borderRadius: 12, 
  alignItems: 'center', 
  justifyContent: 'center', 
  borderWidth: 1, 
  borderColor: C.redDark,
  paddingVertical: 8,
},
btnAbandonnerText: { 
  fontSize: 20,
  color: C.red,
  fontWeight: '700',
},

  // Historique
  histSection: { marginBottom: 8 },
  histTitle: { color: C.textSecond, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  histChip: { backgroundColor: C.bgCard, borderRadius: 10, padding: 10, marginRight: 8, minWidth: 54, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  histChipPlus: { backgroundColor: C.blueBg, borderColor: C.blue },
  histChipMoins: { backgroundColor: C.redBg, borderColor: C.red },
  histChipEgal: { backgroundColor: C.greenBg, borderColor: C.green },
  histChipVal: { color: C.textPrimary, fontSize: 15, fontWeight: '900' },
  histChipIco: { color: C.textBody, fontSize: 13, marginTop: 2 },

  // Notification abandon
  notificationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCard: {
    backgroundColor: C.bgCard,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    borderWidth: 1,
    borderColor: C.gold,
  },
  notificationEmoji: { fontSize: 48, marginBottom: 16 },
  notificationTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  notificationMessage: { color: C.textBody, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  notificationBtn: { borderRadius: 12, overflow: 'hidden', width: '100%' },
  notificationBtnGrad: { paddingVertical: 12, alignItems: 'center' },
  notificationBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // NOUVEAUX STYLES: boutons Quitter sur les écrans de manche
 btnsRowManche: { 
  flexDirection: 'row', 
  gap: 12, 
  width: '100%', 
  marginTop: 8 
},
btnQuitterManche: { 
  borderRadius: 16, 
  overflow: 'hidden',
  flex: 1,
},
btnQuitterMancheGrad: { 
  paddingVertical: 16, 
  paddingHorizontal: 12,
  alignItems: 'center',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: C.border,
},
btnQuitterMancheText: { 
  fontSize: 14, 
  fontWeight: '700',
  letterSpacing: 0.5,
},
  // Résultat
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

  // Adversaire parti
  adversairePartiTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  adversairePartiSub: { color: C.textBody, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Statut tour
  statutTour: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, marginBottom: 12 },
  statutTourActif: { backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.green },
  statutTourInactif: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  statutTourTexte: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginLeft: 8 },

  // Victoire manche
  victoireMancheCard: { borderRadius: 26, padding: 28, alignItems: 'center', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, elevation: 16 },
  victoireMancheGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -40, alignSelf: 'center' },
  victoireMancheEmoji: { fontSize: 72, marginBottom: 8 },
  victoireMancheTitre: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  victoireManchePoints: { color: C.gold, fontSize: 24, fontWeight: '900', marginBottom: 16 },
  victoireMancheScore: { flexDirection: 'row', backgroundColor: '#00000028', borderRadius: 16, padding: 16, marginBottom: 24, width: '100%', justifyContent: 'center', gap: 16 },
  victoireMancheScoreJoueur: { color: '#fff', fontSize: 16, fontWeight: '800' },
  victoireMancheScoreSep: { color: '#ffffff80', fontSize: 16 },
  victoireMancheScoreAdversaire: { color: '#ffffffcc', fontSize: 16 },
  btnSuivant: { borderRadius: 16, overflow: 'hidden', flex: 2 },
  btnSuivantGrad: { paddingVertical: 16, alignItems: 'center' },
  btnSuivantText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  btnSuivantPoints: { color: C.gold, fontSize: 12, fontWeight: '700', marginTop: 4 },

  // Confirmation attente
  attenteConfirmation: { backgroundColor: '#00000040', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16, width: '100%' },
  attenteConfirmationText: { color: '#f0b429', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  attenteConfirmationSub: { color: '#ffffffaa', fontSize: 12, marginTop: 8, textAlign: 'center' },

  // Écrans fin
  finStats: { flexDirection: 'row', backgroundColor: '#00000028', borderRadius: 16, padding: 18, marginBottom: 24, width: '100%', borderWidth: 1, borderColor: '#ffffff18' },
  finStatCol: { flex: 1, alignItems: 'center' },
  finStatVal: { color: '#ffffff', fontSize: 26, fontWeight: '900' },
  finStatKey: { color: '#ffffff80', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 3 },
  finStatSep: { width: 1, backgroundColor: '#ffffff20' },
  finBtnPrimary: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  finBtnText: { fontSize: 15, fontWeight: '900' },
});

export default MondeDuel;