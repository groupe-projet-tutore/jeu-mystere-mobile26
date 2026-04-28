// src/screens/MondeSolo.tsx
// ═══════════════════════════════════════════════════════════════════════════════
//  MONDE SOLO — Version avec intervalle FIXE + SYSTÈME DE JOKERS
//  - Joker Parité (début de partie)
//  - Joker +2 Coups (milieu de partie)
//  - Les jokers s'accumulent et peuvent être utilisés dans les niveaux suivants
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Animated, Easing, Vibration, Modal, BackHandler, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, LEVEL_THEMES as LT } from '../styles/theme';
import { useJeuSoloMobile } from '../hooks/useJeuSoloMobile';
import type { PartieEnCours } from '../types/jeu';
import { PseudoBadge } from '../components/PseudoBadge';
import { Classement} from './Classement';

const TEMPS_LIMITE = 30;

// Types pour les jokers
type JokerType = 'parite' | 'plus2coups';
type JokersDisponibles = {
  parite: number;      // Nombre de jokers Parité disponibles
  plus2coups: number;  // Nombre de jokers +2 Coups disponibles
};

type Props = { 
  onRetour: () => void; 
  pseudo?: string; 
  onPseudoChange?: (p: string) => void;
};

type EcranFinProps = { 
  partie: PartieEnCours; 
  onRejouer: () => void; 
  onRetour: () => void;
};

// Structure pour suivre les jokers trouvés par niveau
type JokerTrouve = {
  niveauId: number;
  jokerType: JokerType;
  moment: string;
};

/* ══════════════════════════════════════════
   MODALE GÉNÉRIQUE
══════════════════════════════════════════ */
const ModalePremium: React.FC<{ visible: boolean; onClose: () => void; children: React.ReactNode }> = ({ visible, onClose, children }) => {
  const sc = useRef(new Animated.Value(0.9)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else { sc.setValue(0.9); op.setValue(0); }
  }, [visible]);
  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Animated.View style={[S.modaleOverlay, { opacity: op }]}>
        <Animated.View style={[S.modaleBox, { transform: [{ scale: sc }] }]}>{children}</Animated.View>
      </Animated.View>
    </Modal>
  );
};

/* ══════════════════════════════════════════
   MODALE JOKER PARITÉ
══════════════════════════════════════════ */
const ModaleJokerParite: React.FC<{
  visible: boolean;
  onClose: () => void;
  onUtiliser: () => void;
  niveauId: number;
}> = ({ visible, onClose, onUtiliser, niveauId }) => {
  return (
    <ModalePremium visible={visible} onClose={onClose}>
      <View style={S.modaleCard}>
        <View style={[S.modaleAccentBar, { backgroundColor: C.blue }]} />
        <View style={S.modaleContent}>
          <View style={[S.modaleIconWrap, { backgroundColor: C.blueBg, borderColor: C.blue }]}>
            <Text style={S.modaleIconEmoji}>🔮</Text>
          </View>
          <Text style={S.modaleTitre}>Joker Parité</Text>
          <Text style={S.modaleSub}>
            Le nombre mystère est {'\n'}
            <Text style={{ fontWeight: 'bold', color: C.blue, fontSize: 20 }}>
              {Math.random() < 0.5 ? 'PAIR' : 'IMP AIR'}
            </Text>
          </Text>
          
          <TouchableOpacity activeOpacity={0.85} onPress={onUtiliser} style={{ marginTop: 10 }}>
            <LinearGradient colors={[C.blueDark, C.blue]} style={S.modaleActionBtn}>
              <Text style={S.modaleActionLabel}>Utiliser le joker</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onClose} style={S.modaleCancelBtn}>
            <Text style={S.modaleCancelText}>Plus tard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ModalePremium>
  );
};

/* ══════════════════════════════════════════
   MODALE JOKER +2 COUPS
══════════════════════════════════════════ */
const ModaleJokerPlus2Coups: React.FC<{
  visible: boolean;
  onClose: () => void;
  onUtiliser: () => void;
  niveauId: number;
}> = ({ visible, onClose, onUtiliser, niveauId }) => {
  return (
    <ModalePremium visible={visible} onClose={onClose}>
      <View style={S.modaleCard}>
        <View style={[S.modaleAccentBar, { backgroundColor: C.gold }]} />
        <View style={S.modaleContent}>
          <View style={[S.modaleIconWrap, { backgroundColor: C.goldBg, borderColor: C.gold }]}>
            <Text style={S.modaleIconEmoji}>⚡</Text>
          </View>
          <Text style={S.modaleTitre}>+2 Coups</Text>
          <Text style={S.modaleSub}>
            Tu reçois{' '}
            <Text style={{ fontWeight: 'bold', color: C.gold, fontSize: 24 }}>+2 essais</Text>
            {'\n'}pour continuer ta progression !
          </Text>
          
          <TouchableOpacity activeOpacity={0.85} onPress={onUtiliser} style={{ marginTop: 10 }}>
            <LinearGradient colors={[C.goldDark, C.gold]} style={S.modaleActionBtn}>
              <Text style={[S.modaleActionLabel, { color: C.bgDeep }]}>Utiliser le joker</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onClose} style={S.modaleCancelBtn}>
            <Text style={S.modaleCancelText}>Plus tard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ModalePremium>
  );
};

/* ══════════════════════════════════════════
   MODALE DÉCOUVERTE JOKER
══════════════════════════════════════════ */
const ModaleDecouverteJoker: React.FC<{
  visible: boolean;
  onClose: () => void;
  jokerType: JokerType;
  niveauId: number;
}> = ({ visible, onClose, jokerType, niveauId }) => {
  const config = jokerType === 'parite' 
    ? { icon: '🔮', title: 'Joker Parité débloqué !', color: C.blue, bg: C.blueBg, desc: 'Tu pourras connaître la parité du nombre mystère au début d\'un niveau.' }
    : { icon: '⚡', title: 'Joker +2 Coups débloqué !', color: C.gold, bg: C.goldBg, desc: 'Tu pourras ajouter 2 essais supplémentaires quand tu seras bloqué.' };
  
  return (
    <ModalePremium visible={visible} onClose={onClose}>
      <View style={S.modaleCard}>
        <View style={[S.modaleAccentBar, { backgroundColor: config.color }]} />
        <View style={S.modaleContent}>
          <View style={[S.modaleIconWrap, { backgroundColor: config.bg, borderColor: config.color }]}>
            <Text style={S.modaleIconEmoji}>{config.icon}</Text>
          </View>
          <Text style={[S.modaleTitre, { color: config.color }]}>{config.title}</Text>
          <Text style={S.modaleSub}>{config.desc}</Text>
          <Text style={[S.modaleSub, { fontSize: 12, marginTop: 5 }]}>✓ Disponible pour les prochains niveaux</Text>
          
          <TouchableOpacity onPress={onClose} style={S.modaleCancelBtn}>
            <Text style={S.modaleCancelText}>Génial !</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ModalePremium>
  );
};

/* ══════════════════════════════════════════
   MODALE PAUSE
══════════════════════════════════════════ */
const ModaleQuitter: React.FC<{ visible: boolean; onFermer: () => void; onReinitialiserNiveau: () => void; onQuitterApp: () => void }> = ({
  visible, onFermer, onReinitialiserNiveau, onQuitterApp,
}) => (
  <ModalePremium visible={visible} onClose={onFermer}>
    <View style={S.modaleCard}>
      <View style={[S.modaleAccentBar, { backgroundColor: C.gold }]} />
      <View style={S.modaleContent}>
        <View style={S.modaleIconWrap}><Text style={S.modaleIconEmoji}>⏸</Text></View>
        <Text style={S.modaleTitre}>Partie en pause</Text>
        <Text style={S.modaleSub}>Que souhaites-tu faire ?</Text>

        <TouchableOpacity activeOpacity={0.85} onPress={() => { onFermer(); onReinitialiserNiveau(); }}>
          <LinearGradient colors={[C.blueDark, C.blue]} style={S.modaleActionBtn}>
            <View style={S.modaleActionIcon}><Text style={{ fontSize: 18 }}>🔄</Text></View>
            <View style={S.modaleActionText}>
              <Text style={S.modaleActionLabel}>Réinitialiser</Text>
              <Text style={S.modaleActionSub}>Nouveau nombre, mêmes essais</Text>
            </View>
            <Text style={S.modaleActionArrow}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} onPress={() => { onFermer(); onQuitterApp(); }}>
          <LinearGradient colors={[C.redDark, C.red]} style={[S.modaleActionBtn, { marginTop: 10 }]}>
            <View style={S.modaleActionIcon}><Text style={{ fontSize: 18 }}>🚪</Text></View>
            <View style={S.modaleActionText}>
              <Text style={S.modaleActionLabel}>Quitter le jeu</Text>
              <Text style={S.modaleActionSub}>Fermer l'application</Text>
            </View>
            <Text style={S.modaleActionArrow}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onFermer} style={S.modaleCancelBtn}>
          <Text style={S.modaleCancelText}>↩  Reprendre la partie</Text>
        </TouchableOpacity>
      </View>
    </View>
  </ModalePremium>
);

/* ══════════════════════════════════════════
   MODALE ABANDONNER
══════════════════════════════════════════ */
const ModaleAbandonner: React.FC<{ visible: boolean; onFermer: () => void; onConfirmer: () => void }> = ({
  visible, onFermer, onConfirmer,
}) => (
  <ModalePremium visible={visible} onClose={onFermer}>
    <View style={S.modaleCard}>
      <View style={[S.modaleAccentBar, { backgroundColor: C.red }]} />
      <View style={S.modaleContent}>
        <View style={[S.modaleIconWrap, { backgroundColor: C.redBg, borderColor: C.redDark }]}>
          <Text style={S.modaleIconEmoji}>🏳️</Text>
        </View>
        <Text style={S.modaleTitre}>Abandonner ?</Text>
        <Text style={S.modaleSub}>
          Tu vas perdre cette manche.{'\n'}Le nombre mystère sera révélé à la fin.
        </Text>

        <View style={S.modaleAbandonBtns}>
          <TouchableOpacity activeOpacity={0.85} onPress={onConfirmer} style={{ flex: 1 }}>
            <LinearGradient colors={[C.redDark, C.red]} style={S.modaleAbandonConfirm}>
              <Text style={S.modaleAbandonConfirmText}>Oui, abandonner</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} onPress={onFermer} style={S.modaleAbandonCancel}>
            <Text style={S.modaleAbandonCancelText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </ModalePremium>
);

/* ══════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════ */
export const MondeSolo: React.FC<Props> = ({ onRetour, pseudo = 'Joueur', onPseudoChange }) => {
  const {
    partieEnCours, niveaux, totalPoints,
    demarrerPartie, proposerNombre, perdreEssai, ajouterEssais,
    reinitialiserPartie, reinitialiserNiveau, reinitialiserProgression,
  } = useJeuSoloMobile(pseudo);

  const [mqv, setMqv] = useState(false);
  const [mav, setMav] = useState(false);
  const [showClassementSolo, setShowClassementSolo] = useState(false);
  
  // État des jokers
  const [jokersDisponibles, setJokersDisponibles] = useState<JokersDisponibles>({ parite: 0, plus2coups: 0 });
  const [showJokerParite, setShowJokerParite] = useState(false);
  const [showJokerPlus2Coups, setShowJokerPlus2Coups] = useState(false);
  const [showDecouverteJoker, setShowDecouverteJoker] = useState<{ visible: boolean; type: JokerType; niveauId: number }>({ visible: false, type: 'parite', niveauId: 1 });
  
  // Compteur de propositions pour déterminer l'activation des jokers
  const [propositionCount, setPropositionCount] = useState(0);
  const [jokerUtiliseCeNiveau, setJokerUtiliseCeNiveau] = useState({ parite: false, plus2coups: false });
  
  // Jokers trouvés par niveau
  const [jokersTrouves, setJokersTrouves] = useState<JokerTrouve[]>([]);

  const niveauVisible = useMemo(() => {
    if (partieEnCours) return niveaux.find(n => n.id === partieEnCours.niveau.id) ?? niveaux[0];
    const d = niveaux.filter(n => n.debloque);
    return d[d.length - 1] ?? niveaux[0];
  }, [niveaux, partieEnCours]);

  const niveauActuelIndex = useMemo(
    () => niveaux.findIndex(n => n.id === niveauVisible?.id),
    [niveaux, niveauVisible]
  );
  
  const niveauActuelId = niveauVisible?.id || 1;

  // Vérifier si un joker doit être débloqué à la fin du niveau
  const verifierJokerNiveau = useCallback((niveauId: number, coupUtilises: number) => {
    let jokerTrouve: JokerType | null = null;
    
    if (niveauId === 1) {
      // Niveau 1 : Joker Parité (coups 1-3) OU Joker +2 Coups (coups 4-6)
      if (coupUtilises >= 1 && coupUtilises <= 3 && !jokersTrouves.some(j => j.niveauId === 1 && j.jokerType === 'parite')) {
        jokerTrouve = 'parite';
      } else if (coupUtilises >= 4 && coupUtilises <= 6 && !jokersTrouves.some(j => j.niveauId === 1 && j.jokerType === 'plus2coups')) {
        jokerTrouve = 'plus2coups';
      }
    } else if (niveauId === 2) {
      // Niveau 2 : Joker Parité (coups 1-2) OU Joker +2 Coups (coups 3-5)
      if (coupUtilises >= 1 && coupUtilises <= 2 && !jokersTrouves.some(j => j.niveauId === 2 && j.jokerType === 'parite')) {
        jokerTrouve = 'parite';
      } else if (coupUtilises >= 3 && coupUtilises <= 5 && !jokersTrouves.some(j => j.niveauId === 2 && j.jokerType === 'plus2coups')) {
        jokerTrouve = 'plus2coups';
      }
    } else if (niveauId === 3) {
      // Niveau 3 : Joker Parité (coup 1) OU Joker +2 Coups (coup 2)
      if (coupUtilises === 1 && !jokersTrouves.some(j => j.niveauId === 3 && j.jokerType === 'parite')) {
        jokerTrouve = 'parite';
      } else if (coupUtilises === 2 && !jokersTrouves.some(j => j.niveauId === 3 && j.jokerType === 'plus2coups')) {
        jokerTrouve = 'plus2coups';
      }
    }
    
    if (jokerTrouve) {
      const nouveauJoker = {
        niveauId,
        jokerType: jokerTrouve,
        moment: `coup ${coupUtilises}`
      };
      setJokersTrouves(prev => [...prev, nouveauJoker]);
      setJokersDisponibles(prev => ({
        ...prev,
        [jokerTrouve === 'parite' ? 'parite' : 'plus2coups']: prev[jokerTrouve === 'parite' ? 'parite' : 'plus2coups'] + 1
      }));
      setShowDecouverteJoker({ visible: true, type: jokerTrouve, niveauId });
    }
  }, [jokersTrouves]);

  // Vérifier si un joker peut être utilisé maintenant
  const verifierActivationJoker = useCallback((niveauId: number, coupCount: number) => {
    if (partieEnCours?.statut !== 'en_cours') return;
    
    const essaisRestants = partieEnCours.essaisRestants;
    
    // Joker Parité : début de partie (coups 1-3 pour niveau 1, 1-2 pour niveau 2, 1 pour niveau 3)
    let pariteActive = false;
    if (niveauId === 1 && coupCount >= 1 && coupCount <= 3 && !jokerUtiliseCeNiveau.parite && jokersDisponibles.parite > 0) {
      pariteActive = true;
    } else if (niveauId === 2 && coupCount >= 1 && coupCount <= 2 && !jokerUtiliseCeNiveau.parite && jokersDisponibles.parite > 0) {
      pariteActive = true;
    } else if (niveauId === 3 && coupCount === 1 && !jokerUtiliseCeNiveau.parite && jokersDisponibles.parite > 0) {
      pariteActive = true;
    }
    
    // Joker +2 Coups : milieu de partie (coups 4-6 pour niveau 1, 3-5 pour niveau 2, 2 pour niveau 3)
    let plus2CoupsActive = false;
    if (niveauId === 1 && coupCount >= 4 && coupCount <= 6 && !jokerUtiliseCeNiveau.plus2coups && jokersDisponibles.plus2coups > 0 && essaisRestants <= 3) {
      plus2CoupsActive = true;
    } else if (niveauId === 2 && coupCount >= 3 && coupCount <= 5 && !jokerUtiliseCeNiveau.plus2coups && jokersDisponibles.plus2coups > 0 && essaisRestants <= 3) {
      plus2CoupsActive = true;
    } else if (niveauId === 3 && coupCount === 2 && !jokerUtiliseCeNiveau.plus2coups && jokersDisponibles.plus2coups > 0 && essaisRestants <= 3) {
      plus2CoupsActive = true;
    }
    
    if (pariteActive) {
      setShowJokerParite(true);
    } else if (plus2CoupsActive) {
      setShowJokerPlus2Coups(true);
    }
  }, [partieEnCours, jokersDisponibles, jokerUtiliseCeNiveau]);

  // Utiliser le joker Parité
  const utiliserJokerParite = useCallback(() => {
    if (jokersDisponibles.parite <= 0) return;
    
    setJokersDisponibles(prev => ({ ...prev, parite: prev.parite - 1 }));
    setJokerUtiliseCeNiveau(prev => ({ ...prev, parite: true }));
    setShowJokerParite(false);
    
    // Afficher un message dans l'interface (via l'état ou une notification)
    // La parité sera affichée dans la modale
  }, [jokersDisponibles.parite]);

  // Utiliser le joker +2 Coups
  const utiliserJokerPlus2Coups = useCallback(() => {
    if (jokersDisponibles.plus2coups <= 0 || !partieEnCours) return;
    
    // Ajouter 2 essais
    ajouterEssais(2);
    
    setJokersDisponibles(prev => ({ ...prev, plus2coups: prev.plus2coups - 1 }));
    setJokerUtiliseCeNiveau(prev => ({ ...prev, plus2coups: true }));
    setShowJokerPlus2Coups(false);
  }, [jokersDisponibles.plus2coups, partieEnCours, ajouterEssais]);

  const handleQuitterApp = useCallback(() => {
    if (Platform.OS === 'android') BackHandler.exitApp(); else onRetour();
  }, [onRetour]);

  const handleAbandonnerConfirme = useCallback(() => {
    setMav(false); reinitialiserPartie();
    setPropositionCount(0);
    setJokerUtiliseCeNiveau({ parite: false, plus2coups: false });
  }, [reinitialiserPartie]);

  const handleDemarrerPartie = useCallback((niveauId: number) => {
    demarrerPartie(niveauId);
    setPropositionCount(0);
    setJokerUtiliseCeNiveau({ parite: false, plus2coups: false });
  }, [demarrerPartie]);

  const handleProposition = useCallback((valeur: number) => {
    proposerNombre(valeur);
    setPropositionCount(prev => prev + 1);
  }, [proposerNombre]);

  const contenu = useMemo(() => {
    if (!partieEnCours) return (
      <SelectionNiveau
        niveau={niveauVisible}
        totalPoints={totalPoints}
        niveaux={niveaux}
        niveauIndex={niveauActuelIndex}
        onSelectionner={() => handleDemarrerPartie(niveauVisible.id)}
        onRetour={onRetour}
        onReinitialiser={reinitialiserProgression}
        jokersDisponibles={jokersDisponibles}
        jokersTrouves={jokersTrouves}
      />
    );
    if (partieEnCours.statut === 'en_cours') return (
      <JeuEnCours
        partie={partieEnCours}
        onProposition={handleProposition}
        onPerdreEssai={perdreEssai}
        onPause={() => setMqv(true)}
        onAbandonner={() => setMav(true)}
        totalPoints={totalPoints}
        propositionCount={propositionCount}
        onVerifierJoker={() => verifierActivationJoker(niveauActuelId, propositionCount + 1)}
        jokersDisponibles={jokersDisponibles}
        jokerUtiliseCeNiveau={jokerUtiliseCeNiveau}
      />
    );
    if (partieEnCours.statut === 'victoire') {
      // Vérifier si un joker a été trouvé pendant cette partie
      const coupsUtilises = partieEnCours.propositions.length;
      verifierJokerNiveau(partieEnCours.niveau.id, coupsUtilises);
      
      return (
        <EcranVictoire
          partie={partieEnCours}
          onRejouer={() => handleDemarrerPartie(partieEnCours.niveau.id)}
          onRetour={reinitialiserPartie}
          onNiveauSuivant={() => {
            const idx = niveaux.findIndex(n => n.id === partieEnCours.niveau.id);
            const next = niveaux[idx + 1]; if (next) handleDemarrerPartie(next.id);
          }}
          aProchainNiveau={niveaux.findIndex(n => n.id === partieEnCours.niveau.id) < niveaux.length - 1}
          jokerTrouve={jokersTrouves.find(j => j.niveauId === partieEnCours.niveau.id && !j.moment.includes('déjà'))}
        />
      );
    }
    return <EcranDefaite partie={partieEnCours} onRejouer={() => handleDemarrerPartie(partieEnCours.niveau.id)} onRetour={reinitialiserPartie} />;
  }, [partieEnCours, niveauVisible, niveaux, totalPoints, niveauActuelIndex, niveauActuelId,
    handleDemarrerPartie, handleProposition, perdreEssai, reinitialiserPartie, reinitialiserProgression, onRetour,
    propositionCount, jokersDisponibles, jokersTrouves, jokerUtiliseCeNiveau, verifierJokerNiveau, verifierActivationJoker]);

  return (
    <View style={S.root}>
      <LinearGradient colors={[C.bgDeep, C.bg, '#0d1628']} style={StyleSheet.absoluteFill} />

      <View style={S.header}>
        <TouchableOpacity onPress={onRetour} style={S.backBtn} activeOpacity={0.75}>
          <Text style={S.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={S.headerMid}>
          <Text style={S.headerTitle}>MONDE SOLO</Text>
          <View style={S.headerPillsRow}>
            {niveaux.map((_, i) => (
              <View key={i} style={[S.pill,
                i < niveauActuelIndex  && S.pillDone,
                i === niveauActuelIndex && S.pillActive]} />
            ))}
          </View>
        </View>
        
        {/* Affichage des jokers disponibles */}
        <View style={S.jokersHeader}>
          {jokersDisponibles.parite > 0 && (
            <TouchableOpacity 
              onPress={() => setShowJokerParite(true)}
              style={S.jokerHeaderBadge}
              activeOpacity={0.7}
            >
              <Text style={S.jokerHeaderIcon}>🔮</Text>
              <Text style={S.jokerHeaderCount}>{jokersDisponibles.parite}</Text>
            </TouchableOpacity>
          )}
          {jokersDisponibles.plus2coups > 0 && (
            <TouchableOpacity 
              onPress={() => setShowJokerPlus2Coups(true)}
              style={S.jokerHeaderBadge}
              activeOpacity={0.7}
            >
              <Text style={S.jokerHeaderIcon}>⚡</Text>
              <Text style={S.jokerHeaderCount}>{jokersDisponibles.plus2coups}</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Bouton classement solo */}
        <TouchableOpacity onPress={() => setShowClassementSolo(true)} style={S.classementIconBtn} activeOpacity={0.7}>
          <LinearGradient colors={[C.blueDark, C.blue]} style={S.classementIconGrad}>
            <Text style={S.classementIconText}>🏆</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <PseudoBadge
          pseudo={pseudo}
          onPseudoChange={onPseudoChange}
          compact
        />
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {contenu}
      </ScrollView>

      <ModaleQuitter visible={mqv} onFermer={() => setMqv(false)}
        onReinitialiserNiveau={() => { setMqv(false); reinitialiserNiveau(); setPropositionCount(0); setJokerUtiliseCeNiveau({ parite: false, plus2coups: false }); }}
        onQuitterApp={handleQuitterApp} />
      <ModaleAbandonner visible={mav} onFermer={() => setMav(false)} onConfirmer={handleAbandonnerConfirme} />

      {/* Modales Jokers */}
      <ModaleJokerParite
        visible={showJokerParite}
        onClose={() => setShowJokerParite(false)}
        onUtiliser={utiliserJokerParite}
        niveauId={niveauActuelId}
      />
      <ModaleJokerPlus2Coups
        visible={showJokerPlus2Coups}
        onClose={() => setShowJokerPlus2Coups(false)}
        onUtiliser={utiliserJokerPlus2Coups}
        niveauId={niveauActuelId}
      />
      <ModaleDecouverteJoker
        visible={showDecouverteJoker.visible}
        onClose={() => setShowDecouverteJoker(prev => ({ ...prev, visible: false }))}
        jokerType={showDecouverteJoker.type}
        niveauId={showDecouverteJoker.niveauId}
      />

      {/* Modal Classement Solo */}
      <Modal visible={showClassementSolo} animationType="slide" presentationStyle="fullScreen">
        <Classement onRetour={() => setShowClassementSolo(false)} pseudo={pseudo} />
      </Modal>
    </View>
  );
};

/* ══════════════════════════════════════════
   SÉLECTION NIVEAU (avec affichage des jokers trouvés)
══════════════════════════════════════════ */
const SelectionNiveau: React.FC<{
  niveau: any; totalPoints: number; niveaux: any[]; niveauIndex: number;
  onSelectionner: () => void; onRetour: () => void; onReinitialiser: () => void;
  jokersDisponibles: JokersDisponibles;
  jokersTrouves: JokerTrouve[];
}> = ({ niveau, totalPoints, niveaux, niveauIndex, onSelectionner, onRetour, onReinitialiser, jokersDisponibles, jokersTrouves }) => {
  const fa = useRef(new Animated.Value(0)).current;
  const sl = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fa, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sl, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  const theme = LT[niveau.id] ?? LT[1];
  
  const jokersNiveau = jokersTrouves.filter(j => j.niveauId === niveau.id);

  return (
    <Animated.View style={{ opacity: fa, transform: [{ translateY: sl }] }}>
      <LinearGradient colors={[C.goldBg, '#1a1004']} style={S.pointsCard}>
        <View style={S.pointsRow}>
          <View>
            <Text style={S.pointsLabel}>POINTS TOTAUX</Text>
            <Text style={S.pointsValue}>{totalPoints.toLocaleString()}</Text>
          </View>
          <View style={S.trophyCircle}>
            <Text style={{ fontSize: 32 }}>🏆</Text>
          </View>
        </View>
        
        {/* Affichage des jokers disponibles */}
        {(jokersDisponibles.parite > 0 || jokersDisponibles.plus2coups > 0) && (
          <View style={S.jokersInventory}>
            <Text style={S.jokersInventoryLabel}>JOKERS DISPONIBLES</Text>
            <View style={S.jokersInventoryRow}>
              {jokersDisponibles.parite > 0 && (
                <View style={S.jokerInventoryItem}>
                  <Text style={S.jokerInventoryIcon}>🔮</Text>
                  <Text style={S.jokerInventoryCount}>×{jokersDisponibles.parite}</Text>
                </View>
              )}
              {jokersDisponibles.plus2coups > 0 && (
                <View style={S.jokerInventoryItem}>
                  <Text style={S.jokerInventoryIcon}>⚡</Text>
                  <Text style={S.jokerInventoryCount}>×{jokersDisponibles.plus2coups}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        <View style={S.progressRow}>
          {niveaux.map((_, i) => (
            <View key={i} style={[S.progressSeg, { backgroundColor: i <= niveauIndex ? C.gold : C.border }]} />
          ))}
        </View>
        <Text style={S.progressLabel}>Niveau {niveauIndex + 1} sur {niveaux.length} débloqué</Text>
      </LinearGradient>

      <LinearGradient colors={theme.grad} style={S.niveauCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={S.niveauDecoBg} />
        <View style={[S.niveauGlow, { backgroundColor: theme.glow }]} />

        <View style={S.niveauHeader}>
          <View style={S.niveauBadge}><Text style={S.niveauBadgeText}>NIVEAU {niveau.id}</Text></View>
          <Text style={{ fontSize: 40 }}>{theme.icon}</Text>
        </View>

        <Text style={S.niveauNom}>{niveau.nom}</Text>
        <Text style={S.niveauDesc}>{niveau.description}</Text>

        {/* Jokers trouvés dans ce niveau */}
        {jokersNiveau.length > 0 && (
          <View style={S.jokersTrouvesCard}>
            <Text style={S.jokersTrouvesTitle}>✨ Jokers débloqués ✨</Text>
            <View style={S.jokersTrouvesRow}>
              {jokersNiveau.map((j, idx) => (
                <View key={idx} style={S.jokerTrouveItem}>
                  <Text style={S.jokerTrouveIcon}>{j.jokerType === 'parite' ? '🔮' : '⚡'}</Text>
                  <Text style={S.jokerTrouveText}>
                    {j.jokerType === 'parite' ? 'Parité' : '+2 Coups'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={S.niveauStats}>
          {[
            { label: 'INTERVALLE', val: `${niveau.min} – ${niveau.max}` },
            { label: 'ESSAIS MAX', val: `${niveau.essaisMax}` },
            { label: 'RÉCOMPENSE', val: `+${niveau.points} pts`, gold: true },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={S.statSep} />}
              <View style={S.statCol}>
                <Text style={[S.statVal, s.gold && { color: C.gold }]}>{s.val}</Text>
                <Text style={S.statKey}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity onPress={onSelectionner} activeOpacity={0.88} style={S.playBtn}>
          <LinearGradient colors={theme.gradBtn} style={S.playBtnGrad}>
            <Text style={S.playBtnText}>▶  JOUER CE NIVEAU</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      <View style={S.navRow}>
        <TouchableOpacity onPress={onRetour} style={S.navBtn} activeOpacity={0.75}>
          <Text style={S.navBtnText}> Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onReinitialiser} style={[S.navBtn, S.navBtnDanger]} activeOpacity={0.75}>
          <Text style={S.navBtnDangerText}>↺ Réinitialiser tout</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

/* ══════════════════════════════════════════
   JEU EN COURS — AVEC INTERVALLE FIXE + JOKERS
══════════════════════════════════════════ */
const JeuEnCours: React.FC<{
  partie: PartieEnCours; onProposition: (v: number) => void;
  onPerdreEssai: () => void; onPause: () => void; onAbandonner: () => void;
  totalPoints: number;
  propositionCount: number;
  onVerifierJoker: () => void;
  jokersDisponibles: JokersDisponibles;
  jokerUtiliseCeNiveau: { parite: boolean; plus2coups: boolean };
}> = ({ partie, onProposition, onPerdreEssai, onPause, onAbandonner, totalPoints, propositionCount, onVerifierJoker, jokersDisponibles, jokerUtiliseCeNiveau }) => {
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');
  const [temps, setTemps]   = useState(TEMPS_LIMITE);
  const [showHintParite, setShowHintParite] = useState(false);
  const { niveau, essaisRestants, propositions } = partie;

  const twA   = useRef(new Animated.Value(1)).current;
  const pA    = useRef(new Animated.Value(1)).current;
  const isA   = useRef(new Animated.Value(0)).current;
  const plRef = useRef<Animated.CompositeAnimation | null>(null);

  // Vérifier l'activation des jokers après chaque proposition
  useEffect(() => {
    if (propositionCount > 0 && partie.statut === 'en_cours') {
      onVerifierJoker();
    }
  }, [propositionCount]);

  useEffect(() => {
    if (partie.statut !== 'en_cours') return;
    const iv = setInterval(() => {
      setTemps(prev => {
        if (prev <= 1) { Vibration.vibrate([0, 80, 60, 80]); onPerdreEssai(); return TEMPS_LIMITE; }
        return prev - 1;
      });
    }, 1000);
    return () => { clearInterval(iv); plRef.current?.stop(); plRef.current = null; };
  }, [partie.statut, onPerdreEssai]);

  useEffect(() => {
    Animated.timing(twA, { toValue: temps / TEMPS_LIMITE, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    if (temps <= 10 && !plRef.current) {
      plRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pA, { toValue: 1.1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pA, { toValue: 1,   duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      plRef.current.start();
    } else if (temps > 10 && plRef.current) {
      plRef.current.stop(); plRef.current = null; pA.setValue(1);
    }
  }, [temps]);

  const shakeInput = () => Animated.sequence([
    Animated.timing(isA, { toValue: 10,  duration: 55, useNativeDriver: true }),
    Animated.timing(isA, { toValue: -10, duration: 55, useNativeDriver: true }),
    Animated.timing(isA, { toValue: 6,   duration: 55, useNativeDriver: true }),
    Animated.timing(isA, { toValue: 0,   duration: 55, useNativeDriver: true }),
  ]).start();

  const handleSubmit = () => {
    const val = parseInt(saisie, 10);
    
    const minActuel = niveau.min;
    const maxActuel = niveau.max;
    
    if (isNaN(val))                                { setErreur('Entrez un nombre valide');               shakeInput(); return; }
    if (val < minActuel || val > maxActuel)        { setErreur(`Entre ${minActuel} et ${maxActuel}`);    shakeInput(); return; }
    if (propositions.some(p => p.valeur === val))   { setErreur('Déjà proposé !');                       shakeInput(); return; }
    setErreur(''); setSaisie(''); setTemps(TEMPS_LIMITE); onProposition(val);
  };

  const derniere   = propositions[propositions.length - 1];
  const pct        = essaisRestants / niveau.essaisMax;
  const ec         = pct > 0.6 ? C.green : pct > 0.3 ? C.amber : C.red;
  const tc         = temps > 20 ? C.green  : temps > 10 ? C.amber  : C.red;
  const theme      = LT[niveau.id] ?? LT[1];
  
  const minAffiche = niveau.min;
  const maxAffiche = niveau.max;

  return (
    <View>
      <View style={S.jeuBandeau}>
        <LinearGradient colors={theme.grad} style={S.jeuBandeauTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        <View style={S.jeuBandeauBody}>
          <View style={S.jeuLeft}>
            <Text style={S.jeuNiveauBadge}>NIVEAU {niveau.id}</Text>
            <Text style={S.jeuNiveauNom}>{niveau.nom}</Text>
            
            <View style={S.jeuIntervalleWrapper}>
              <View style={S.jeuIntervalleRow}>
                <Text style={S.jeuIntervalleNum}>{minAffiche}</Text>
                <View style={S.jeuIntervalleBar}>
                  <LinearGradient colors={theme.grad} style={StyleSheet.absoluteFill} />
                </View>
                <Text style={S.jeuIntervalleNum}>{maxAffiche}</Text>
              </View>
            </View>
          </View>
          <View style={S.jeuEssaisBlock}>
            <Text style={[S.jeuEssaisVal, { color: ec }]}>{essaisRestants}</Text>
            <Text style={S.jeuEssaisMax}>/ {niveau.essaisMax}</Text>
            <Text style={S.jeuEssaisLbl}>ESSAIS</Text>
          </View>
          <Animated.View style={[S.jeuTimerBlock, { transform: [{ scale: pA }] }]}>
            <Text style={[S.jeuTimerVal, { color: tc }]}>{temps}</Text>
            <Text style={[S.jeuTimerSec, { color: tc }]}>sec</Text>
            <View style={S.jeuTimerTrack}>
              <Animated.View style={[S.jeuTimerFill, {
                width: twA.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: tc,
              }]} />
            </View>
          </Animated.View>
        </View>
      </View>

      <View style={S.pointsOnglet}>
        <Text style={S.pointsOngletIcon}>⭐</Text>
        <View style={S.pointsOngletTexts}>
          <Text style={S.pointsOngletLabel}>POINTS TOTAUX</Text>
          <Text style={S.pointsOngletValue}>{totalPoints.toLocaleString()}</Text>
        </View>
        <Text style={S.pointsOngletBonus}>+{niveau.points} à gagner</Text>
      </View>

      {/* Indicateur des jokers disponibles pendant le jeu */}
      {(jokersDisponibles.parite > 0 || jokersDisponibles.plus2coups > 0) && (
        <View style={S.jokersGameBar}>
          <Text style={S.jokersGameLabel}>🎲 Jokers disponibles</Text>
          <View style={S.jokersGameRow}>
            {jokersDisponibles.parite > 0 && !jokerUtiliseCeNiveau.parite && (
              <TouchableOpacity 
                style={[S.jokerGameBtn, { backgroundColor: C.blueBg, borderColor: C.blue }]}
                onPress={() => setShowHintParite(true)}
              >
                <Text style={S.jokerGameIcon}>🔮</Text>
                <Text style={S.jokerGameText}>Parité</Text>
              </TouchableOpacity>
            )}
            {jokersDisponibles.plus2coups > 0 && !jokerUtiliseCeNiveau.plus2coups && (
              <TouchableOpacity 
                style={[S.jokerGameBtn, { backgroundColor: C.goldBg, borderColor: C.gold }]}
              >
                <Text style={S.jokerGameIcon}>⚡</Text>
                <Text style={S.jokerGameText}>+2 Coups</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {derniere && (
        <View style={[S.indiceBox,
          derniere.indice === 'plus'  && S.indicePlus,
          derniere.indice === 'moins' && S.indiceMoins,
          derniere.indice === 'egal'  && S.indiceEgal,
        ]}>
          <Text style={S.indiceNum}>{derniere.valeur}</Text>
          <View style={S.indiceSep} />
          <View>
            <Text style={[S.indiceMsg,
              derniere.indice === 'plus'  && { color: C.blue  },
              derniere.indice === 'moins' && { color: C.red   },
              derniere.indice === 'egal'  && { color: C.green },
            ]}>
              {derniere.indice === 'plus'  && "↑  C'est PLUS GRAND"}
              {derniere.indice === 'moins' && "↓  C'est PLUS PETIT"}
              {derniere.indice === 'egal'  && '✓  TROUVÉ !'}
            </Text>
            <Text style={S.indiceHint}>
              {derniere.indice === 'plus'  && `Le nombre est > ${derniere.valeur}`}
              {derniere.indice === 'moins' && `Le nombre est < ${derniere.valeur}`}
              {derniere.indice === 'egal'  && 'Parfait, tu as gagné !'}
            </Text>
          </View>
        </View>
      )}

      <View style={S.saisieCard}>
        <Text style={S.saisieCardLabel}>TON NOMBRE</Text>
        <Text style={S.saisieIntervalleHint}>Intervalle : {minAffiche} → {maxAffiche}</Text>
        <Animated.View style={[S.saisieWrapper, { transform: [{ translateX: isA }] }, !!erreur && S.saisieError]}>
          <TextInput
            style={S.saisieInput}
            keyboardType="number-pad"
            value={saisie}
            onChangeText={t => { setSaisie(t); setErreur(''); }}
            onSubmitEditing={handleSubmit}
            placeholder={`${minAffiche} – ${maxAffiche}`}
            placeholderTextColor={C.textHint}
            returnKeyType="done"
          />
        </Animated.View>
        {erreur ? (
          <View style={S.erreurRow}>
            <Text style={S.erreurDot}>●</Text>
            <Text style={S.erreurText}>{erreur}</Text>
          </View>
        ) : null}
        <View style={S.saisieBtnsRow}>
          <TouchableOpacity onPress={handleSubmit} activeOpacity={0.85} disabled={essaisRestants === 0}
            style={[S.btnProposer, essaisRestants === 0 && { opacity: 0.35 }]}>
            <LinearGradient colors={essaisRestants === 0 ? [C.bgCardLit, C.bgCard] : [C.blueDark, C.blue]} style={S.btnProposerGrad}>
              <Text style={S.btnProposerText}>PROPOSER</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPause} style={S.btnPause} activeOpacity={0.75}>
            <Text style={S.btnPauseText}>⏸</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={onAbandonner} activeOpacity={0.8}>
        <View style={S.abandonBtn}>
          <Text style={S.abandonIcon}>🏳️</Text>
          <View style={S.abandonTexts}>
            <Text style={S.abandonLabel}>Abandonner ce niveau</Text>
            <Text style={S.abandonSub}>Le nombre mystère sera révélé</Text>
          </View>
          <Text style={S.abandonArrow}>›</Text>
        </View>
      </TouchableOpacity>

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
      
      {/* Modale d'indice Parité */}
      <ModalePremium visible={showHintParite} onClose={() => setShowHintParite(false)}>
        <View style={S.modaleCard}>
          <View style={[S.modaleAccentBar, { backgroundColor: C.blue }]} />
          <View style={S.modaleContent}>
            <View style={[S.modaleIconWrap, { backgroundColor: C.blueBg, borderColor: C.blue }]}>
              <Text style={S.modaleIconEmoji}>🔮</Text>
            </View>
            <Text style={S.modaleTitre}>Indice de Parité</Text>
            <Text style={S.modaleSub}>
              Le nombre mystère est {'\n'}
              <Text style={{ fontWeight: 'bold', color: C.blue, fontSize: 24 }}>
                {partie.nombreMystere % 2 === 0 ? 'PAIR' : 'IMPAIR'}
              </Text>
            </Text>
            <TouchableOpacity onPress={() => setShowHintParite(false)} style={S.modaleCancelBtn}>
              <Text style={S.modaleCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalePremium>
    </View>
  );
};

/* ══════════════════════════════════════════
   ÉCRAN VICTOIRE (avec affichage du joker trouvé)
══════════════════════════════════════════ */
const EcranVictoire: React.FC<{
  partie: PartieEnCours; onRejouer: () => void; onRetour: () => void;
  onNiveauSuivant: () => void; aProchainNiveau: boolean;
  jokerTrouve?: JokerTrouve;
}> = ({ partie, onRejouer, onRetour, onNiveauSuivant, aProchainNiveau, jokerTrouve }) => {
  const ba = useRef(new Animated.Value(0)).current;
  const ga = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.spring(ba, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(ga, { toValue: 1,   duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(ga, { toValue: 0.2, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);
  
  return (
    <Animated.View style={{ opacity: ba, transform: [{ scale: ba.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }] }}>
      <LinearGradient colors={[C.greenBg, '#0a3a1e', '#16a34a']} style={S.finCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Animated.View style={[S.finGlow, { opacity: ga, backgroundColor: C.green }]} />
        <Text style={S.finEmoji}>🏆</Text>
        <Text style={S.finTitre}>VICTOIRE !</Text>
        
        {/* Affichage du joker trouvé */}
        {jokerTrouve && (
          <View style={S.jokerTrouveVictoire}>
            <Text style={S.jokerTrouveVictoireIcon}>{jokerTrouve.jokerType === 'parite' ? '🔮' : '⚡'}</Text>
            <View>
              <Text style={S.jokerTrouveVictoireTitle}>
                Joker {jokerTrouve.jokerType === 'parite' ? 'Parité' : '+2 Coups'} débloqué !
              </Text>
              <Text style={S.jokerTrouveVictoireSub}>
                Disponible pour les prochains niveaux
              </Text>
            </View>
          </View>
        )}
        
        <Text style={S.finMystere}>Nombre mystère : <Text style={S.finMystereVal}>{partie.nombreMystere}</Text></Text>
        <View style={S.finStats}>
          {[
            { val: `${partie.propositions.length}`, key: 'ESSAIS' },
            { val: `+${partie.niveau.points}`, key: 'POINTS', gold: true },
            { val: `${partie.niveau.essaisMax - partie.propositions.length}`, key: 'ÉPARGNÉS' },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={S.finStatSep} />}
              <View style={S.finStatCol}>
                <Text style={[S.finStatVal, s.gold && { color: C.gold }]}>{s.val}</Text>
                <Text style={S.finStatKey}>{s.key}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={S.finBtns}>
          <TouchableOpacity onPress={onRejouer} style={S.finBtnSecond} activeOpacity={0.82}>
            <Text style={S.finBtnSecondText}>🔄  Rejouer</Text>
          </TouchableOpacity>
          
          {aProchainNiveau ? (
            <TouchableOpacity onPress={onNiveauSuivant} activeOpacity={0.9} style={{ flex: 1 }}>
              <LinearGradient colors={[C.goldDark, C.gold]} style={S.finBtnPrimary}>
                <Text style={[S.finBtnText, { color: C.bgDeep }]}>Niveau suivant  →</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onRetour} activeOpacity={0.9} style={{ flex: 1 }}>
              <LinearGradient colors={[C.blueDark, C.blue]} style={S.finBtnPrimary}>
                <Text style={[S.finBtnText, { color: '#fff' }]}>Retour au menu</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

/* ══════════════════════════════════════════
   ÉCRAN DÉFAITE
══════════════════════════════════════════ */
const EcranDefaite: React.FC<EcranFinProps> = ({ partie, onRejouer, onRetour }) => {
  const oa = useRef(new Animated.Value(0)).current;
  const sa = useRef(new Animated.Value(-18)).current;
  const sh = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(oa, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(sa, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(sh, { toValue: 9,  duration: 55, useNativeDriver: true }),
        Animated.timing(sh, { toValue: -9, duration: 55, useNativeDriver: true }),
        Animated.timing(sh, { toValue: 5,  duration: 55, useNativeDriver: true }),
        Animated.timing(sh, { toValue: 0,  duration: 55, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  
  return (
    <Animated.View style={{ opacity: oa, transform: [{ translateY: sa }, { translateX: sh }] }}>
      <LinearGradient colors={[C.redBg, '#3d0808', '#b91c1c']} style={S.finCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={S.finEmoji}>💀</Text>
        <Text style={S.finTitre}>DÉFAITE</Text>
        <Text style={S.finSub}>Plus aucun essai disponible</Text>
        
        <View style={S.defaiteReveal}>
          <Text style={S.defaiteRevealLabel}>LE NOMBRE MYSTÈRE ÉTAIT</Text>
          <Text style={S.defaiteRevealNum}>{partie.nombreMystere}</Text>
        </View>
        
        <View style={S.finBtns}>
          <TouchableOpacity onPress={onRejouer} style={S.finBtnSecond} activeOpacity={0.85}>
            <Text style={S.finBtnSecondText}>🔄  Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRetour} style={S.finBtnSecond} activeOpacity={0.85}>
            <Text style={S.finBtnSecondText}>← Menu</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

/* ══════════════════════════════════════════
   STYLES (avec ajouts pour les jokers)
══════════════════════════════════════════ */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 52 : 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgCard },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bgCardLit, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.border },
  backBtnText: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  headerMid: { flex: 1 },
  headerTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 2.5 },
  headerPillsRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  pill: { height: 3, flex: 1, backgroundColor: C.border, borderRadius: 2 },
  pillDone: { backgroundColor: C.textSecond },
  pillActive: { backgroundColor: C.gold },

  jokersHeader: { flexDirection: 'row', gap: 6, marginRight: 10 },
  jokerHeaderBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCardLit, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  jokerHeaderIcon: { fontSize: 14, marginRight: 2 },
  jokerHeaderCount: { color: C.textPrimary, fontSize: 12, fontWeight: '700' },

  classementIconBtn: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', marginRight: 10 },
  classementIconGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  classementIconText: { fontSize: 22 },

  scroll: { padding: 16, paddingBottom: 52 },

  pointsCard: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.goldDark },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pointsLabel: { fontSize: 12, fontWeight: '800', color: C.textSecond, letterSpacing: 2 },
  pointsValue: { fontSize: 42, fontWeight: '900', color: C.gold, marginTop: 2 },
  trophyCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#00000020', alignItems: 'center', justifyContent: 'center' },
  
  jokersInventory: { backgroundColor: '#00000030', borderRadius: 12, padding: 12, marginBottom: 16 },
  jokersInventoryLabel: { fontSize: 10, fontWeight: '800', color: C.textSecond, letterSpacing: 1.5, marginBottom: 8, textAlign: 'center' },
  jokersInventoryRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  jokerInventoryItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  jokerInventoryIcon: { fontSize: 18 },
  jokerInventoryCount: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  
  progressRow: { flexDirection: 'row', gap: 4, height: 6, marginBottom: 8 },
  progressSeg: { flex: 1, height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 13, color: C.textBody, fontWeight: '600' },

  niveauCard: { borderRadius: 24, padding: 24, marginBottom: 16, minHeight: 340, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, elevation: 12 },
  niveauDecoBg: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#ffffff08', top: -50, right: -50 },
  niveauGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, opacity: 0.07, top: -70, left: -50 },
  niveauHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  niveauBadge: { backgroundColor: '#ffffff22', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#ffffff30' },
  niveauBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  niveauNom: { color: '#ffffff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  niveauDesc: { color: '#ffffffdd', fontSize: 15, lineHeight: 22, marginBottom: 22 },
  
  jokersTrouvesCard: { backgroundColor: '#ffffff15', borderRadius: 14, padding: 12, marginBottom: 16 },
  jokersTrouvesTitle: { color: '#ffffff', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 8, letterSpacing: 1 },
  jokersTrouvesRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  jokerTrouveItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  jokerTrouveIcon: { fontSize: 16 },
  jokerTrouveText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  
  niveauStats: { flexDirection: 'row', backgroundColor: '#00000025', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#ffffff18' },
  statCol: { flex: 1, alignItems: 'center' },
  statVal: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
  statKey: { color: '#ffffff99', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 3 },
  statSep: { width: 1, backgroundColor: '#ffffff20' },
  playBtn: { borderRadius: 14, overflow: 'hidden' },
  playBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  playBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '900', letterSpacing: 2 },

  navRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  navBtn: { flex: 1, backgroundColor: C.bgCard, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  navBtnText: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  navBtnDanger: { backgroundColor: C.redBg, borderColor: C.redDark },
  navBtnDangerText: { color: C.red, fontSize: 14, fontWeight: '700' },

  jeuBandeau: { borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  jeuBandeauTop: { height: 4 },
  jeuBandeauBody: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
  jeuLeft: { flex: 1 },
  jeuNiveauBadge: { fontSize: 11, fontWeight: '800', color: C.textSecond, letterSpacing: 2, marginBottom: 4 },
  jeuNiveauNom: { fontSize: 18, fontWeight: '900', color: C.textPrimary, marginBottom: 10 },
  jeuIntervalleWrapper: { marginTop: 4 },
  jeuIntervalleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jeuIntervalleNum: { fontSize: 13, fontWeight: '700', color: C.textBody },
  jeuIntervalleBar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: C.border },
  jeuEssaisBlock: { alignItems: 'center', minWidth: 60 },
  jeuEssaisVal: { fontSize: 32, fontWeight: '900' },
  jeuEssaisMax: { color: C.textSecond, fontSize: 13, fontWeight: '600', marginTop: -2 },
  jeuEssaisLbl: { color: C.textSecond, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  jeuTimerBlock: { alignItems: 'center', minWidth: 64 },
  jeuTimerVal: { fontSize: 30, fontWeight: '900' },
  jeuTimerSec: { fontSize: 11, fontWeight: '700', marginTop: -3 },
  jeuTimerTrack: { width: 56, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  jeuTimerFill: { height: 4, borderRadius: 2 },

  pointsOnglet: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a1004',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11,
    marginBottom: 14,
    borderWidth: 1, borderColor: '#b07d0e',
  },
  pointsOngletIcon:   { fontSize: 18 },
  pointsOngletTexts:  { flex: 1 },
  pointsOngletLabel:  { fontSize: 10, fontWeight: '800', color: '#b07d0e', letterSpacing: 2 },
  pointsOngletValue:  { fontSize: 20, fontWeight: '900', color: '#f0b429', marginTop: 1 },
  pointsOngletBonus:  { fontSize: 11, fontWeight: '700', color: '#7a5a00', textAlign: 'right' },

  jokersGameBar: { backgroundColor: C.bgCard, borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  jokersGameLabel: { color: C.textSecond, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, textAlign: 'center' },
  jokersGameRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  jokerGameBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  jokerGameIcon: { fontSize: 16 },
  jokerGameText: { fontSize: 12, fontWeight: '700', color: C.textPrimary },

  indiceBox: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard },
  indicePlus:  { backgroundColor: C.blueBg,  borderColor: C.blue  },
  indiceMoins: { backgroundColor: C.redBg,   borderColor: C.red   },
  indiceEgal:  { backgroundColor: C.greenBg, borderColor: C.green },
  indiceNum: { color: C.textPrimary, fontSize: 26, fontWeight: '900', minWidth: 50, textAlign: 'center' },
  indiceSep: { width: 1.5, height: 32, backgroundColor: C.border },
  indiceMsg: { fontSize: 15, fontWeight: '800' },
  indiceHint: { fontSize: 12, color: C.textBody, marginTop: 2, fontWeight: '500' },

  saisieCard: { backgroundColor: C.bgCard, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  saisieCardLabel: { fontSize: 13, fontWeight: '800', color: C.textSecond, letterSpacing: 2, marginBottom: 8 },
  saisieIntervalleHint: { fontSize: 12, color: C.gold, marginBottom: 12, fontWeight: '600', textAlign: 'center' },
  saisieWrapper: { backgroundColor: C.bgCardLit, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderLit, marginBottom: 10 },
  saisieError: { borderColor: C.red },
  saisieInput: { paddingVertical: 18, paddingHorizontal: 20, color: C.textPrimary, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  erreurRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  erreurDot: { color: C.red, fontSize: 10 },
  erreurText: { color: C.red, fontSize: 14, fontWeight: '700' },
  saisieBtnsRow: { flexDirection: 'row', gap: 10 },
  btnProposer: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  btnProposerGrad: { paddingVertical: 15, alignItems: 'center' },
  btnProposerText: { color: '#ffffff', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  btnPause: { width: 52, backgroundColor: C.bgCardLit, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  btnPauseText: { fontSize: 20 },

  abandonBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.redBg, borderRadius: 16,
    padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.redDark,
  },
  abandonIcon: { fontSize: 22 },
  abandonTexts: { flex: 1 },
  abandonLabel: { color: C.red, fontSize: 14, fontWeight: '800' },
  abandonSub:   { color: '#aa4444', fontSize: 12, marginTop: 2, fontWeight: '500' },
  abandonArrow: { color: '#aa4444', fontSize: 22 },

  histSection: { marginBottom: 8 },
  histTitle: { color: C.textSecond, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  histChip: { backgroundColor: C.bgCard, borderRadius: 10, padding: 10, marginRight: 8, minWidth: 54, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  histChipPlus:  { backgroundColor: C.blueBg,  borderColor: C.blue  },
  histChipMoins: { backgroundColor: C.redBg,   borderColor: C.red   },
  histChipEgal:  { backgroundColor: C.greenBg, borderColor: C.green },
  histChipVal: { color: C.textPrimary, fontSize: 15, fontWeight: '900' },
  histChipIco: { color: C.textBody, fontSize: 13, marginTop: 2 },

  finCard: { borderRadius: 26, padding: 28, alignItems: 'center', overflow: 'hidden' },
  finGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -40, alignSelf: 'center' },
  finEmoji: { fontSize: 72, marginBottom: 8 },
  finTitre: { color: '#ffffff', fontSize: 36, fontWeight: '900', letterSpacing: 2.5, marginBottom: 6 },
  
  jokerTrouveVictoire: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff20', borderRadius: 16, padding: 12, marginBottom: 16 },
  jokerTrouveVictoireIcon: { fontSize: 32 },
  jokerTrouveVictoireTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  jokerTrouveVictoireSub: { color: '#ffffffcc', fontSize: 11, marginTop: 2 },
  
  finMystere: { color: '#ffffffcc', fontSize: 15, marginBottom: 24 },
  finMystereVal: { color: '#ffffff', fontWeight: '900', fontSize: 20 },
  finSub: { color: '#fca5a5', fontSize: 15, marginBottom: 24 },
  finStats: { flexDirection: 'row', backgroundColor: '#00000028', borderRadius: 16, padding: 18, marginBottom: 24, width: '100%', borderWidth: 1, borderColor: '#ffffff18' },
  finStatCol: { flex: 1, alignItems: 'center' },
  finStatVal: { color: '#ffffff', fontSize: 26, fontWeight: '900' },
  finStatKey: { color: '#ffffff80', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 3 },
  finStatSep: { width: 1, backgroundColor: '#ffffff20' },
  finBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  finBtnPrimary: { paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  finBtnSecond: { flex: 1, backgroundColor: '#ffffff22', paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#ffffff30' },
  finBtnText: { fontSize: 15, fontWeight: '900' },
  finBtnSecondText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },

  defaiteReveal: { backgroundColor: '#00000030', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, width: '100%', borderWidth: 1, borderColor: '#ffffff18' },
  defaiteRevealLabel: { color: '#fca5a5', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  defaiteRevealNum: { color: '#ffffff', fontSize: 60, fontWeight: '900' },

  modaleOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  modaleBox: { width: '100%', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.borderBright, shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 28, elevation: 22 },
  modaleCard: { backgroundColor: C.bgCard, borderRadius: 24, overflow: 'hidden' },
  modaleAccentBar: { height: 4 },
  modaleContent: { padding: 26 },
  modaleIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.bgCardLit, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1, borderColor: C.borderLit, alignSelf: 'center' },
  modaleIconEmoji: { fontSize: 28 },
  modaleTitre: { color: C.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
  modaleSub: { color: C.textBody, fontSize: 14, marginBottom: 22, textAlign: 'center', lineHeight: 21 },
  modaleActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, justifyContent: 'center' },
  modaleActionIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#ffffff15', alignItems: 'center', justifyContent: 'center' },
  modaleActionText: { flex: 1 },
  modaleActionLabel: { color: '#ffffff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  modaleActionSub: { color: '#ffffff99', fontSize: 12, marginTop: 2 },
  modaleActionArrow: { color: '#ffffff60', fontSize: 22 },
  modaleCancelBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  modaleCancelText: { color: C.textSecond, fontSize: 14, fontWeight: '700' },
  modaleAbandonBtns: { flexDirection: 'row', gap: 10 },
  modaleAbandonConfirm: { paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  modaleAbandonConfirmText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  modaleAbandonCancel: { flex: 1, backgroundColor: C.bgCardLit, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderWidth: 1, borderColor: C.border },
  modaleAbandonCancelText: { color: C.textBody, fontSize: 15, fontWeight: '700' },
});

export default MondeSolo;