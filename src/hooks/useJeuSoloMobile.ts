// src/hooks/useJeuSoloMobile.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NIVEAUX } from './../data/niveaux';
import type { PartieEnCours, Proposition } from '../types/jeu';
import {
  chargerProgression,
  sauvegarderProgression,
  enregistrerScore,
  syncroniserScoresEnAttente,
  type StatutConnexion,
} from '../services/syncService';

export const useJeuSoloMobile = (pseudo: string = 'Joueur') => {
  const [partieEnCours,     setPartieEnCours]     = useState<PartieEnCours | null>(null);
  const [niveauxDebloques,  setNiveauxDebloques]  = useState<number[]>([1]);
  const [niveauxCompletes,  setNiveauxCompletes]  = useState<number[]>([]);
  const [totalPoints,       setTotalPoints]        = useState<number>(0);

  // ── Statut de connexion / sync ──
  const [statutConnexion,   setStatutConnexion]   = useState<StatutConnexion>('connecte');
  const [scoresEnAttente,   setScoresEnAttente]   = useState<number>(0);
  const [chargementInitial, setChargementInitial] = useState<boolean>(true);

  // Ref pour éviter les doubles sauvegardes en cours
  const syncEnCoursRef = useRef(false);

  // ══════════════════════════════════════════════════════
  //  CHARGEMENT INITIAL — restaure la progression locale
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const charger = async () => {
      try {
        const prog = await chargerProgression(pseudo);
        if (prog) {
          setTotalPoints(prog.totalPoints);
          setNiveauxDebloques(prog.niveauxDebloques);
          setNiveauxCompletes(prog.niveauxCompletes);
        }
        // Tenter une sync des scores en attente au démarrage
        const result = await syncroniserScoresEnAttente();
        setStatutConnexion(result.statut);
        setScoresEnAttente(result.enAttente);
      } catch (e) {
        console.warn('[useJeuSoloMobile] chargement initial error:', e);
        setStatutConnexion('hors_ligne');
      } finally {
        setChargementInitial(false);
      }
    };
    charger();
  }, [pseudo]);

  // ══════════════════════════════════════════════════════
  //  SYNC AU RETOUR EN PREMIER PLAN (AppState)
  //  Quand l'utilisateur revient dans l'appli → retry sync
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const handleAppState = async (nextState: AppStateStatus) => {
      if (nextState === 'active' && !syncEnCoursRef.current) {
        syncEnCoursRef.current = true;
        setStatutConnexion('sync_en_cours');
        try {
          const result = await syncroniserScoresEnAttente();
          setStatutConnexion(result.statut);
          setScoresEnAttente(result.enAttente);
        } catch {
          setStatutConnexion('hors_ligne');
        } finally {
          syncEnCoursRef.current = false;
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  // ══════════════════════════════════════════════════════
  //  SAUVEGARDE PROGRESSION (appelée après chaque victoire)
  // ══════════════════════════════════════════════════════
  const sauvegarderEtat = useCallback(async (
    points: number,
    debloques: number[],
    completes: number[],
  ) => {
    const statut = await sauvegarderProgression({
      pseudo,
      totalPoints:      points,
      niveauxDebloques: debloques,
      niveauxCompletes: completes,
      derniereMaj:      new Date().toISOString(),
    });
    setStatutConnexion(statut);
  }, [pseudo]);

  // ══════════════════════════════════════════════════════
  //  POINTS FIXES PAR NIVEAU
  // ══════════════════════════════════════════════════════
  const getPointsFixes = (niveauId: number): number => {
    switch (niveauId) {
      case 1: return 1000;
      case 2: return 2000;
      case 3: return 3000;
      case 4: return 5000;
      default: return 0;
    }
  };

  // ══════════════════════════════════════════════════════
  //  DÉMARRER PARTIE
  // ══════════════════════════════════════════════════════
  const demarrerPartie = useCallback((niveauId: number) => {
    const niveau = NIVEAUX.find((n) => n.id === niveauId);
    if (!niveau || !niveauxDebloques.includes(niveauId)) return;

    const nombreMystere =
      Math.floor(Math.random() * (niveau.max - niveau.min + 1)) + niveau.min;

    setPartieEnCours({
      niveau,
      nombreMystere,
      essaisRestants: niveau.essaisMax,
      propositions: [],
      statut: 'en_cours',
    });
  }, [niveauxDebloques]);

  // ══════════════════════════════════════════════════════
  //  PERTE D'ESSAI PAR TIMEOUT
  // ══════════════════════════════════════════════════════
  const perdreEssai = useCallback(() => {
    if (!partieEnCours || partieEnCours.statut !== 'en_cours') return;

    const { essaisRestants } = partieEnCours;
    const nouveauEssaisRestants = essaisRestants - 1;
    const nouveauStatut: 'en_cours' | 'defaite' =
      nouveauEssaisRestants === 0 ? 'defaite' : 'en_cours';

    setPartieEnCours((prev) =>
      prev ? { ...prev, essaisRestants: nouveauEssaisRestants, statut: nouveauStatut } : prev
    );
  }, [partieEnCours]);

  // ══════════════════════════════════════════════════════
  //  PROPOSER UN NOMBRE
  // ══════════════════════════════════════════════════════
  const proposerNombre = useCallback(
    async (valeur: number) => {
      if (!partieEnCours || partieEnCours.statut !== 'en_cours') return;
      if (valeur < 0) return;

      const { nombreMystere, essaisRestants, niveau } = partieEnCours;

      let indice: 'plus' | 'moins' | 'egal' = 'plus';
      let nouveauStatut: 'en_cours' | 'victoire' | 'defaite' = 'en_cours';
      const nouveauEssaisRestants = essaisRestants - 1;

      if (valeur === nombreMystere) {
        indice = 'egal';
        nouveauStatut = 'victoire';
      } else if (valeur < nombreMystere) {
        indice = 'plus';
      } else {
        indice = 'moins';
      }

      if (nouveauEssaisRestants === 0 && valeur !== nombreMystere) {
        nouveauStatut = 'defaite';
      }

      const nouvelleProposition: Proposition = {
        valeur,
        indice,
        timestamp: new Date(),
      };

      setPartieEnCours((prev) =>
        prev
          ? {
              ...prev,
              essaisRestants: nouveauEssaisRestants,
              propositions: [...prev.propositions, nouvelleProposition],
              statut: nouveauStatut,
            }
          : prev
      );

      // ── Victoire : points + sauvegarde + score ──
      if (nouveauStatut === 'victoire') {
        const pointsGagnes = getPointsFixes(niveau.id);
        const dejaComplete = niveauxCompletes.includes(niveau.id);

        // Nouveaux états calculés localement
        const nouveauxPoints    = dejaComplete ? totalPoints : totalPoints + pointsGagnes;
        const nouveauxCompletes = dejaComplete ? niveauxCompletes : [...niveauxCompletes, niveau.id];
        const nouveauxDebloques = niveau.id < 4 && !niveauxDebloques.includes(niveau.id + 1)
          ? [...niveauxDebloques, niveau.id + 1]
          : niveauxDebloques;

        if (!dejaComplete) {
          setTotalPoints(nouveauxPoints);
          setNiveauxCompletes(nouveauxCompletes);
        }
        if (niveau.id < 4 && !niveauxDebloques.includes(niveau.id + 1)) {
          setNiveauxDebloques(nouveauxDebloques);
        }

        // ✅ Sauvegarder progression (local + tentative serveur)
        sauvegarderEtat(nouveauxPoints, nouveauxDebloques, nouveauxCompletes);

        // ✅ Enregistrer le score dans la file (local + tentative serveur)
        if (!dejaComplete) {
          setStatutConnexion('sync_en_cours');
          enregistrerScore({
            pseudo,
            niveauId:  niveau.id,
            points:    pointsGagnes,
            essais:    nouveauxCompletes.length,
            date:      new Date().toISOString(),
          }).then((statut) => {
            setStatutConnexion(statut);
            if (statut === 'hors_ligne') {
              setScoresEnAttente(prev => prev + 1);
            }
          });
        }
      }
    },
    [partieEnCours, niveauxDebloques, niveauxCompletes, totalPoints, pseudo, sauvegarderEtat]
  );

  // ══════════════════════════════════════════════════════
  //  RÉINITIALISATIONS
  // ══════════════════════════════════════════════════════
  const reinitialiserPartie = useCallback(() => {
    setPartieEnCours(null);
  }, []);

  const reinitialiserNiveau = useCallback(() => {
    if (!partieEnCours) return;
    demarrerPartie(partieEnCours.niveau.id);
  }, [partieEnCours, demarrerPartie]);

  const reinitialiserProgression = useCallback(() => {
    setNiveauxDebloques([1]);
    setNiveauxCompletes([]);
    setTotalPoints(0);
    setPartieEnCours(null);
    // Réinitialiser aussi en local
    sauvegarderEtat(0, [1], []);
  }, [sauvegarderEtat]);

  // ══════════════════════════════════════════════════════
  //  SYNC MANUELLE (bouton retry dans l'UI si besoin)
  // ══════════════════════════════════════════════════════
  const reessayerSync = useCallback(async () => {
    if (syncEnCoursRef.current) return;
    syncEnCoursRef.current = true;
    setStatutConnexion('sync_en_cours');
    try {
      const result = await syncroniserScoresEnAttente();
      setStatutConnexion(result.statut);
      setScoresEnAttente(result.enAttente);
    } catch {
      setStatutConnexion('hors_ligne');
    } finally {
      syncEnCoursRef.current = false;
    }
  }, []);

  // ── Niveaux avec débloqué ──
  const getNiveauxAvecDebloque = () =>
    NIVEAUX.map((n) => ({ ...n, debloque: niveauxDebloques.includes(n.id) }));

  return {
    // Jeu
    partieEnCours,
    niveaux: getNiveauxAvecDebloque(),
    totalPoints,
    chargementInitial,

    // Actions jeu
    demarrerPartie,
    proposerNombre,
    perdreEssai,
    reinitialiserPartie,
    reinitialiserNiveau,
    reinitialiserProgression,

    // Sync & connexion
    statutConnexion,
    scoresEnAttente,
    reessayerSync,
  };
};