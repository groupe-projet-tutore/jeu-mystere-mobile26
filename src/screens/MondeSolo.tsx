// src/screens/MondeSolo.tsx
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

const TEMPS_LIMITE = 30;
type Props = { 
  onRetour: () => void; 
  pseudo?: string; 
  onPseudoChange?: (p: string) => void;
  onGoToClassement?: () => void;  // ← AJOUTÉ
};
type EcranFinProps = { 
  partie: PartieEnCours; 
  onRejouer: () => void; 
  onRetour: () => void;
  onGoToClassement?: () => void;  // ← AJOUTÉ
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
export const MondeSolo: React.FC<Props> = ({ onRetour, pseudo = 'Joueur', onPseudoChange, onGoToClassement }) => {
  const {
    partieEnCours, niveaux, totalPoints,
    demarrerPartie, proposerNombre, perdreEssai,
    reinitialiserPartie, reinitialiserNiveau, reinitialiserProgression,
  } = useJeuSoloMobile(pseudo);

  const [mqv, setMqv] = useState(false);
  const [mav, setMav] = useState(false);

  const niveauVisible = useMemo(() => {
    if (partieEnCours) return niveaux.find(n => n.id === partieEnCours.niveau.id) ?? niveaux[0];
    const d = niveaux.filter(n => n.debloque);
    return d[d.length - 1] ?? niveaux[0];
  }, [niveaux, partieEnCours]);

  const niveauActuelIndex = useMemo(
    () => niveaux.findIndex(n => n.id === niveauVisible?.id),
    [niveaux, niveauVisible]
  );

  const handleQuitterApp = useCallback(() => {
    if (Platform.OS === 'android') BackHandler.exitApp(); else onRetour();
  }, [onRetour]);

  const handleAbandonnerConfirme = useCallback(() => {
    setMav(false); reinitialiserPartie();
  }, [reinitialiserPartie]);

  const contenu = useMemo(() => {
    if (!partieEnCours) return (
      <SelectionNiveau
        niveau={niveauVisible}
        totalPoints={totalPoints}
        niveaux={niveaux}
        niveauIndex={niveauActuelIndex}
        onSelectionner={() => demarrerPartie(niveauVisible.id)}
        onRetour={onRetour}
        onReinitialiser={reinitialiserProgression}
        onGoToClassement={onGoToClassement}  // ← AJOUTÉ
      />
    );
    if (partieEnCours.statut === 'en_cours') return (
      <JeuEnCours
        partie={partieEnCours} onProposition={proposerNombre}
        onPerdreEssai={perdreEssai}
        onPause={() => setMqv(true)}
        onAbandonner={() => setMav(true)}
        totalPoints={totalPoints}
      />
    );
    if (partieEnCours.statut === 'victoire') return (
      <EcranVictoire
        partie={partieEnCours}
        onRejouer={() => demarrerPartie(partieEnCours.niveau.id)}
        onRetour={reinitialiserPartie}
        onNiveauSuivant={() => {
          const idx = niveaux.findIndex(n => n.id === partieEnCours.niveau.id);
          const next = niveaux[idx + 1]; if (next) demarrerPartie(next.id);
        }}
        aProchainNiveau={niveaux.findIndex(n => n.id === partieEnCours.niveau.id) < niveaux.length - 1}
        onGoToClassement={onGoToClassement}  // ← AJOUTÉ
      />
    );
    return <EcranDefaite partie={partieEnCours} onRejouer={() => demarrerPartie(partieEnCours.niveau.id)} onRetour={reinitialiserPartie} onGoToClassement={onGoToClassement}  />;
  }, [partieEnCours, niveauVisible, niveaux, totalPoints, niveauActuelIndex,
    demarrerPartie, proposerNombre, perdreEssai, reinitialiserPartie, reinitialiserProgression, onRetour, onGoToClassement]);

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
        onReinitialiserNiveau={() => { setMqv(false); reinitialiserNiveau(); }}
        onQuitterApp={handleQuitterApp} />
      <ModaleAbandonner visible={mav} onFermer={() => setMav(false)} onConfirmer={handleAbandonnerConfirme} />
    </View>
  );
};

/* ══════════════════════════════════════════
   SÉLECTION NIVEAU
══════════════════════════════════════════ */
const SelectionNiveau: React.FC<{
  niveau: any; totalPoints: number; niveaux: any[]; niveauIndex: number;
  onSelectionner: () => void; onRetour: () => void; onReinitialiser: () => void;
  onGoToClassement?: () => void;  // ← AJOUTÉ
}> = ({ niveau, totalPoints, niveaux, niveauIndex, onSelectionner, onRetour, onReinitialiser, onGoToClassement }) => {
  const fa = useRef(new Animated.Value(0)).current;
  const sl = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fa, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sl, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  const theme = LT[niveau.id] ?? LT[1];

  return (
    <Animated.View style={{ opacity: fa, transform: [{ translateY: sl }] }}>

      {/* Carte points */}
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
        <View style={S.progressRow}>
          {niveaux.map((_, i) => (
            <View key={i} style={[S.progressSeg, { backgroundColor: i <= niveauIndex ? C.gold : C.border }]} />
          ))}
        </View>
        <Text style={S.progressLabel}>Niveau {niveauIndex + 1} sur {niveaux.length} débloqué</Text>
      </LinearGradient>

      {/* Carte niveau */}
      <LinearGradient colors={theme.grad} style={S.niveauCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={S.niveauDecoBg} />
        <View style={[S.niveauGlow, { backgroundColor: theme.glow }]} />

        <View style={S.niveauHeader}>
          <View style={S.niveauBadge}><Text style={S.niveauBadgeText}>NIVEAU {niveau.id}</Text></View>
          <Text style={{ fontSize: 40 }}>{theme.icon}</Text>
        </View>

        <Text style={S.niveauNom}>{niveau.nom}</Text>
        <Text style={S.niveauDesc}>{niveau.description}</Text>

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

      {/* Nav */}
      <View style={S.navRow}>
        <TouchableOpacity onPress={onRetour} style={S.navBtn} activeOpacity={0.75}>
          <Text style={S.navBtnText}>← Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onReinitialiser} style={[S.navBtn, S.navBtnDanger]} activeOpacity={0.75}>
          <Text style={S.navBtnDangerText}>↺ Réinitialiser tout</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ BOUTON CLASSEMENT */}
      {onGoToClassement && (
        <View style={S.classementBtnRow}>
          <TouchableOpacity onPress={onGoToClassement} style={S.classementBtn} activeOpacity={0.85}>
            <LinearGradient colors={[C.blueDark, C.blue]} style={S.classementBtnGrad}>
              <Text style={S.classementBtnText}> VOIR CLASSEMENT</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

/* ══════════════════════════════════════════
   JEU EN COURS
══════════════════════════════════════════ */
const JeuEnCours: React.FC<{
  partie: PartieEnCours; onProposition: (v: number) => void;
  onPerdreEssai: () => void; onPause: () => void; onAbandonner: () => void;
  totalPoints: number;
}> = ({ partie, onProposition, onPerdreEssai, onPause, onAbandonner, totalPoints }) => {
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');
  const [temps, setTemps]   = useState(TEMPS_LIMITE);
  const { niveau, essaisRestants, propositions } = partie;

  const twA   = useRef(new Animated.Value(1)).current;
  const pA    = useRef(new Animated.Value(1)).current;
  const isA   = useRef(new Animated.Value(0)).current;
  const plRef = useRef<Animated.CompositeAnimation | null>(null);

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
    if (isNaN(val))                                { setErreur('Entrez un nombre valide');               shakeInput(); return; }
    if (val < niveau.min || val > niveau.max)       { setErreur(`Entre ${niveau.min} et ${niveau.max}`); shakeInput(); return; }
    if (propositions.some(p => p.valeur === val))   { setErreur('Déjà proposé !');                       shakeInput(); return; }
    setErreur(''); setSaisie(''); setTemps(TEMPS_LIMITE); onProposition(val);
  };

  const derniere   = propositions[propositions.length - 1];
  const pct        = essaisRestants / niveau.essaisMax;
  const ec         = pct > 0.6 ? C.green : pct > 0.3 ? C.amber : C.red;
  const tc         = temps > 20 ? C.green  : temps > 10 ? C.amber  : C.red;
  const theme      = LT[niveau.id] ?? LT[1];

  return (
    <View>
      {/* Bandeau stats */}
      <View style={S.jeuBandeau}>
        <LinearGradient colors={theme.grad} style={S.jeuBandeauTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        <View style={S.jeuBandeauBody}>
          <View style={S.jeuLeft}>
            <Text style={S.jeuNiveauBadge}>NIVEAU {niveau.id}</Text>
            <Text style={S.jeuNiveauNom}>{niveau.nom}</Text>
            <View style={S.jeuIntervalleRow}>
              <Text style={S.jeuIntervalleNum}>{niveau.min}</Text>
              <View style={S.jeuIntervalleBar}>
                <LinearGradient colors={theme.grad} style={StyleSheet.absoluteFill} />
              </View>
              <Text style={S.jeuIntervalleNum}>{niveau.max}</Text>
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

      {/* Onglet points totaux */}
      <View style={S.pointsOnglet}>
        <Text style={S.pointsOngletIcon}>⭐</Text>
        <View style={S.pointsOngletTexts}>
          <Text style={S.pointsOngletLabel}>POINTS TOTAUX</Text>
          <Text style={S.pointsOngletValue}>{totalPoints.toLocaleString()}</Text>
        </View>
        <Text style={S.pointsOngletBonus}>+{niveau.points} à gagner</Text>
      </View>

      {/* Indice dernière proposition */}
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

      {/* Saisie */}
      <View style={S.saisieCard}>
        <Text style={S.saisieCardLabel}>TON NOMBRE</Text>
        <Animated.View style={[S.saisieWrapper, { transform: [{ translateX: isA }] }, !!erreur && S.saisieError]}>
          <TextInput
            style={S.saisieInput}
            keyboardType="number-pad"
            value={saisie}
            onChangeText={t => { setSaisie(t); setErreur(''); }}
            onSubmitEditing={handleSubmit}
            placeholder={`${niveau.min} – ${niveau.max}`}
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

      {/* Abandonner */}
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

      {/* Historique */}
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

/* ══════════════════════════════════════════
   ÉCRAN VICTOIRE
══════════════════════════════════════════ */
const EcranVictoire: React.FC<{
  partie: PartieEnCours; onRejouer: () => void; onRetour: () => void;
  onNiveauSuivant: () => void; aProchainNiveau: boolean;
  onGoToClassement?: () => void;  // ← AJOUTÉ
}> = ({ partie, onRejouer, onRetour, onNiveauSuivant, aProchainNiveau, onGoToClassement }) => {
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

        {/* Ligne des boutons principaux */}
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
            <TouchableOpacity onPress={onGoToClassement} activeOpacity={0.9} style={{ flex: 1 }}>
              <LinearGradient colors={[C.blueDark, C.blue]} style={S.finBtnPrimary}>
                <Text style={[S.finBtnText, { color: '#fff' }]}>Voir classement</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* ✅ BOUTON CLASSEMENT SUPPLÉMENTAIRE (pour niveaux 1-3) */}
        {aProchainNiveau && onGoToClassement && (
          <View style={S.classementBtnRow}>
            <TouchableOpacity onPress={onGoToClassement} activeOpacity={0.85} style={S.classementBtn}>
              <LinearGradient colors={[C.blueDark, C.blue]} style={S.classementBtnGrad}>
                <Text style={S.classementBtnText}>  VOIR CLASSEMENT</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

/* ══════════════════════════════════════════
   ÉCRAN DÉFAITE
══════════════════════════════════════════ */
/* ══════════════════════════════════════════
   ÉCRAN DÉFAITE — AVEC BOUTON CLASSEMENT
══════════════════════════════════════════ */
const EcranDefaite: React.FC<EcranFinProps> = ({ partie, onRejouer, onRetour, onGoToClassement }) => {
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
        
        {/* ✅ AJOUT : BOUTON CLASSEMENT EN DÉFAITE */}
        {onGoToClassement && (
          <View style={S.classementBtnRow}>
            <TouchableOpacity onPress={onGoToClassement} activeOpacity={0.85} style={S.classementBtn}>
              <LinearGradient colors={[C.blueDark, C.blue]} style={S.classementBtnGrad}>
                <Text style={S.classementBtnText}>🏆  VOIR CLASSEMENT</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 52 : 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgCard },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bgCardLit, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.border },
  backBtnText: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  headerMid: { flex: 1 },
  headerTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 2.5 },
  headerPillsRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  pill: { height: 3, flex: 1, backgroundColor: C.border, borderRadius: 2 },
  pillDone: { backgroundColor: C.textSecond },
  pillActive: { backgroundColor: C.gold },
  scroll: { padding: 16, paddingBottom: 52 },

  // Points
  pointsCard: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.goldDark },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pointsLabel: { fontSize: 12, fontWeight: '800', color: C.textSecond, letterSpacing: 2 },
  pointsValue: { fontSize: 42, fontWeight: '900', color: C.gold, marginTop: 2 },
  trophyCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#00000020', alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', gap: 4, height: 6, marginBottom: 8 },
  progressSeg: { flex: 1, height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 13, color: C.textBody, fontWeight: '600' },

  // Carte niveau
  niveauCard: { borderRadius: 24, padding: 24, marginBottom: 16, minHeight: 340, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, elevation: 12 },
  niveauDecoBg: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#ffffff08', top: -50, right: -50 },
  niveauGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, opacity: 0.07, top: -70, left: -50 },
  niveauHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  niveauBadge: { backgroundColor: '#ffffff22', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#ffffff30' },
  niveauBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  niveauNom: { color: '#ffffff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  niveauDesc: { color: '#ffffffdd', fontSize: 15, lineHeight: 22, marginBottom: 22 },
  niveauStats: { flexDirection: 'row', backgroundColor: '#00000025', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#ffffff18' },
  statCol: { flex: 1, alignItems: 'center' },
  statVal: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
  statKey: { color: '#ffffff99', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 3 },
  statSep: { width: 1, backgroundColor: '#ffffff20' },
  playBtn: { borderRadius: 14, overflow: 'hidden' },
  playBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  playBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '900', letterSpacing: 2 },

  // Nav
  navRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  navBtn: { flex: 1, backgroundColor: C.bgCard, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  navBtnText: { color: C.textBody, fontSize: 14, fontWeight: '700' },
  navBtnDanger: { backgroundColor: C.redBg, borderColor: C.redDark },
  navBtnDangerText: { color: C.red, fontSize: 14, fontWeight: '700' },

  // Jeu bandeau
  jeuBandeau: { borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  jeuBandeauTop: { height: 4 },
  jeuBandeauBody: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
  jeuLeft: { flex: 1 },
  jeuNiveauBadge: { fontSize: 11, fontWeight: '800', color: C.textSecond, letterSpacing: 2, marginBottom: 4 },
  jeuNiveauNom: { fontSize: 18, fontWeight: '900', color: C.textPrimary, marginBottom: 10 },
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

  // Onglet points
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

  // Indice
  indiceBox: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard },
  indicePlus:  { backgroundColor: C.blueBg,  borderColor: C.blue  },
  indiceMoins: { backgroundColor: C.redBg,   borderColor: C.red   },
  indiceEgal:  { backgroundColor: C.greenBg, borderColor: C.green },
  indiceNum: { color: C.textPrimary, fontSize: 26, fontWeight: '900', minWidth: 50, textAlign: 'center' },
  indiceSep: { width: 1.5, height: 32, backgroundColor: C.border },
  indiceMsg: { fontSize: 15, fontWeight: '800' },
  indiceHint: { fontSize: 12, color: C.textBody, marginTop: 2, fontWeight: '500' },

  // Saisie
  saisieCard: { backgroundColor: C.bgCard, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  saisieCardLabel: { fontSize: 13, fontWeight: '800', color: C.textSecond, letterSpacing: 2, marginBottom: 12 },
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

  // Abandonner
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

  // Historique
  histSection: { marginBottom: 8 },
  histTitle: { color: C.textSecond, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  histChip: { backgroundColor: C.bgCard, borderRadius: 10, padding: 10, marginRight: 8, minWidth: 54, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  histChipPlus:  { backgroundColor: C.blueBg,  borderColor: C.blue  },
  histChipMoins: { backgroundColor: C.redBg,   borderColor: C.red   },
  histChipEgal:  { backgroundColor: C.greenBg, borderColor: C.green },
  histChipVal: { color: C.textPrimary, fontSize: 15, fontWeight: '900' },
  histChipIco: { color: C.textBody, fontSize: 13, marginTop: 2 },

  // Écrans de fin communs
  finCard: { borderRadius: 26, padding: 28, alignItems: 'center', overflow: 'hidden' },
  finGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -40, alignSelf: 'center' },
  finEmoji: { fontSize: 72, marginBottom: 8 },
  finTitre: { color: '#ffffff', fontSize: 36, fontWeight: '900', letterSpacing: 2.5, marginBottom: 6 },
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

  // Défaite révélation
  defaiteReveal: { backgroundColor: '#00000030', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, width: '100%', borderWidth: 1, borderColor: '#ffffff18' },
  defaiteRevealLabel: { color: '#fca5a5', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  defaiteRevealNum: { color: '#ffffff', fontSize: 60, fontWeight: '900' },

  // Modales
  modaleOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  modaleBox: { width: '100%', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.borderBright, shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 28, elevation: 22 },
  modaleCard: { backgroundColor: C.bgCard, borderRadius: 24, overflow: 'hidden' },
  modaleAccentBar: { height: 4 },
  modaleContent: { padding: 26 },
  modaleIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.bgCardLit, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1, borderColor: C.borderLit, alignSelf: 'center' },
  modaleIconEmoji: { fontSize: 28 },
  modaleTitre: { color: C.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
  modaleSub: { color: C.textBody, fontSize: 14, marginBottom: 22, textAlign: 'center', lineHeight: 21 },
  modaleActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15 },
  modaleActionIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#ffffff15', alignItems: 'center', justifyContent: 'center' },
  modaleActionText: { flex: 1 },
  modaleActionLabel: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  modaleActionSub: { color: '#ffffff99', fontSize: 12, marginTop: 2 },
  modaleActionArrow: { color: '#ffffff60', fontSize: 22 },
  modaleCancelBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  modaleCancelText: { color: C.textSecond, fontSize: 14, fontWeight: '700' },
  modaleAbandonBtns: { flexDirection: 'row', gap: 10 },
  modaleAbandonConfirm: { paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  modaleAbandonConfirmText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  modaleAbandonCancel: { flex: 1, backgroundColor: C.bgCardLit, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderWidth: 1, borderColor: C.border },
  modaleAbandonCancelText: { color: C.textBody, fontSize: 15, fontWeight: '700' },

  // Styles à ajouter dans StyleSheet.create de MondeSolo.tsx (lignes ~1400)

classementBtnRow: {
  marginTop: 16,
  width: '100%',
},
classementBtn: {
  borderRadius: 14,
  overflow: 'hidden',
  shadowColor: '#27d51a',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 3,
},
classementBtnGrad: {
  paddingVertical: 14,
  alignItems: 'center',
},
classementBtnText: {
  color: '#bdb7b7',
  fontSize: 14,
  fontWeight: '800',
  letterSpacing: 1,
},
});

export default MondeSolo;