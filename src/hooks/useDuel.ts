// src/hooks/useDuel.ts
// ═══════════════════════════════════════════════════════════════════════════════
//  HOOK DUEL — Version avec READY CHECK et timer serveur unique
//  - Ready Check: synchronisation parfaite des deux joueurs avant le duel
//  - Timer serveur UNIQUE (socketio.sleep) - client uniquement affichage
//  - Événements distincts pour les abandons
//  - CORRECTION: Envoi automatique de 'pret' quand l'adversaire est connu
//  - NOUVEAU: Quitter proprement une salle sans conséquence (quitter_salle)
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration, Alert } from 'react-native';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { API_URL, TEMPS_CONFIG, NIVEAUX_CONFIG } from '../config/serveur';

// ── Types ────────────────────────────────────────────────────────────────────
export type EtatDuel =
  | 'idle'
  | 'creation'
  | 'attente'
  | 'rejoindre'
  | 'compte_a_rebours'
  | 'en_cours'
  | 'victoire_manche'
  | 'defaite_manche'
  | 'victoire_par_abandon'
  | 'defaite_par_abandon'
  | 'victoire'
  | 'defaite'
  | 'egal'
  | 'adversaire_parti'
  | 'adversaire_a_quitte';

export type PropositionDuel = {
  id: string;
  valeur: number;
  indice: 'plus' | 'moins' | 'egal';
  temps: number;
  timestamp: number;
};

export type ResultatDuel = {
  vainqueur: string | null;
  pointsJoueur: number;
  pointsAdversaire: number;
  duree: number;
  niveauMax: number;
  nombreMystere: number;
  essaisJoueur: number;
  essaisAdversaire: number;
};

export type AbandonData = {
  niveau: number;
  pointsGagnes: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const useDuel = (pseudo: string) => {
  // ── États de jeu ──────────────────────────────────────────────────────────
  const [etat, setEtat] = useState<EtatDuel>('idle');
  const [codeSalle, setCodeSalle] = useState<string>('');
  const [niveau, setNiveau] = useState<number>(1);
  const [prochainNiveau, setProchainNiveau] = useState<number>(2);
  const [nombreMystere, setNombreMystere] = useState<number>(0);
  const [propositions, setPropositions] = useState<PropositionDuel[]>([]);
  const [resultat, setResultat] = useState<ResultatDuel | null>(null);
  const [erreur, setErreur] = useState<string>('');
  const [abandonData, setAbandonData] = useState<AbandonData | null>(null);
  const [estHote, setEstHote] = useState<boolean>(false);

  // ── États de progression ───────────────────────────────────────────────────
  const [tempsRestant, setTempsRestant] = useState<number>(0);
  const [compteARebours, setCompteARebours] = useState<number>(0);
  const [essaisRestants, setEssaisRestants] = useState<number>(10);
  const [essaisAdversaire, setEssaisAdversaire] = useState<number>(0);
  const [adversairePseudo, setAdversairePseudo] = useState<string | null>(null);

  // ── États de score ─────────────────────────────────────────────────────────
  const [pointsJoueur, setPointsJoueur] = useState<number>(0);
  const [pointsAdversaire, setPointsAdversaire] = useState<number>(0);
  const [pointsNiveauGagnes, setPointsNiveauGagnes] = useState<number>(0);

  // ── États de contrôle ──────────────────────────────────────────────────────
  const [estConnecte, setEstConnecte] = useState<boolean>(false);
  const [monTour, setMonTour] = useState<boolean>(false);
  const [confirmationEnvoyee, setConfirmationEnvoyee] = useState<boolean>(false);
  const [adversaireAConfirme, setAdversaireAConfirme] = useState<boolean>(false);
  const [pretEnvoye, setPretEnvoye] = useState<boolean>(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const timerAffichageRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debutPartieRef = useRef<number>(0);
  const dernierTourRef = useRef<boolean>(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMER CLIENT - UNIQUEMENT POUR L'AFFICHAGE
  // ═══════════════════════════════════════════════════════════════════════════

  const arreterTimerAffichage = useCallback(() => {
    if (timerAffichageRef.current) {
      clearInterval(timerAffichageRef.current);
      timerAffichageRef.current = null;
    }
  }, []);

  const demarrerTimerAffichage = useCallback((duree: number = TEMPS_CONFIG.TOUR_LIMITE) => {
    arreterTimerAffichage();
    setTempsRestant(duree);
    
    timerAffichageRef.current = setInterval(() => {
      setTempsRestant(prev => {
        if (prev <= 1) {
          arreterTimerAffichage();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [arreterTimerAffichage]);

  const nettoyerTimers = useCallback(() => {
    arreterTimerAffichage();
  }, [arreterTimerAffichage]);

  // Effet vibration quand c'est notre tour
  useEffect(() => {
    if (monTour && etat === 'en_cours' && !dernierTourRef.current) {
      Vibration.vibrate(200);
      dernierTourRef.current = true;
    } else if (!monTour) {
      dernierTourRef.current = false;
    }
  }, [monTour, etat]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONNEXION SOCKET
  // ═══════════════════════════════════════════════════════════════════════════

  const connecterSocket = useCallback((): Promise<Socket> => {
    const baseUrl = API_URL.replace('/api', '');
    const socketUrl = baseUrl.replace('http://', 'ws://');
    
    console.log('🔍 [useDuel] connecterSocket appelé');
    console.log('🔍 [useDuel] API_URL =', API_URL);
    console.log('🔍 [useDuel] socketUrl =', socketUrl);
    
    return new Promise((resolve, reject) => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socket = io(socketUrl, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 10000,
        forceNew: true,
      });

      const timeout = setTimeout(() => {
        console.log('❌ [useDuel] Timeout connexion');
        socket.disconnect();
        reject(new Error('Délai de connexion dépassé (10s)'));
      }, 10000);

      socket.on('connect', () => {
        console.log('✅ [useDuel] Socket connecté avec succès, ID:', socket.id);
        clearTimeout(timeout);
        socketRef.current = socket;
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        console.log('❌ [useDuel] Socket connect_error:', err.message || 'serveur indisponible');
        clearTimeout(timeout);
        reject(new Error(`Erreur connexion: ${err.message || 'serveur indisponible'}`));
      });
      
      socket.on('error', (err) => {
        console.log('❌ [useDuel] Socket error:', err);
      });
    });
  }, [API_URL]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONFIGURATION DES LISTENERS (avec READY CHECK)
  // ═══════════════════════════════════════════════════════════════════════════

  const configurerListeners = useCallback((socket: Socket) => {
    // PHASE 1: CRÉATION/REJOINTE DE SALLE
    socket.on('salle_creee', (data: { code: string; niveau: number; estHote: boolean }) => {
      console.log('✅ [useDuel] Salle créée:', data);
      setCodeSalle(data.code);
      setEstHote(true);
      setNiveau(data.niveau);
      setEtat('attente');
      setPretEnvoye(false);
    });

    socket.on('vous_avez_rejoint', (data: { adversaire: string; estHote: boolean; niveau: number }) => {
      console.log('✅ [useDuel] Vous avez rejoint la salle:', data);
      setAdversairePseudo(data.adversaire);
      setEstHote(false);
      setNiveau(data.niveau);
      setEtat('attente');
      setPretEnvoye(false);
    });

    socket.on('adversaire_rejoint', (data: { pseudo: string }) => {
      console.log('✅ [useDuel] Adversaire rejoint:', data);
      setAdversairePseudo(data.pseudo);
    });

    // PHASE 2: READY CHECK ET COMPTE À REBOURS
    socket.on('compte_a_rebours', (data: { valeur: number }) => {
      console.log('⏰ [useDuel] Compte à rebours:', data.valeur);
      setCompteARebours(data.valeur);
      setEtat('compte_a_rebours');
      Vibration.vibrate(100);
    });

    socket.on('duel_lance', (data: {
      nombreMystere: number;
      niveau: number;
      essaisMax: number;
      premierTour: string;
      pointsNiveau: number;
      temps: number;
    }) => {
      console.log('✅ [useDuel] Duel lancé:', data);
      setNombreMystere(data.nombreMystere);
      setNiveau(data.niveau);
      setProchainNiveau(data.niveau + 1);
      setEssaisRestants(data.essaisMax);
      setPointsNiveauGagnes(data.pointsNiveau);
      setPointsJoueur(0);
      setPointsAdversaire(0);
      setCompteARebours(0);
      debutPartieRef.current = Date.now();
      setEtat('en_cours');
      
      const estMonTour = data.premierTour === pseudo;
      setMonTour(estMonTour);
      
      if (estMonTour) {
        demarrerTimerAffichage(data.temps);
      } else {
        arreterTimerAffichage();
        setTempsRestant(0);
      }
      
      setConfirmationEnvoyee(false);
      setAdversaireAConfirme(false);
      setAbandonData(null);
    });

    // PHASE 3: JEU EN COURS
    socket.on('victoire_manche', (data: {
      vainqueur: string;
      niveau: number;
      pointsGagnes: number;
      pointsJoueur1: number;
      pointsJoueur2: number;
      prochainNiveau: number;
      pointsProchainNiveau: number;
    }) => {
      console.log('✅ [useDuel] Victoire manche:', data);
      nettoyerTimers();
      setPointsJoueur(data.pointsJoueur1);
      setPointsAdversaire(data.pointsJoueur2);
      setPointsNiveauGagnes(data.pointsGagnes);
      setProchainNiveau(data.prochainNiveau);
      setNiveau(data.niveau);
      setConfirmationEnvoyee(false);
      setAdversaireAConfirme(false);
      
      if (data.vainqueur === pseudo) {
        setEtat('victoire_manche');
      } else {
        setEtat('defaite_manche');
      }
    });

    socket.on('victoire_par_abandon', (data: {
      niveau: number;
      pointsGagnes: number;
      pointsJoueur: number;
      pointsAdversaire: number;
      adversaire: string;
    }) => {
      console.log('🏆 [useDuel] Victoire par abandon reçue:', data);
      nettoyerTimers();
      setPointsJoueur(data.pointsJoueur);
      setPointsAdversaire(data.pointsAdversaire);
      setPointsNiveauGagnes(data.pointsGagnes);
      setNiveau(data.niveau);
      setAbandonData({ niveau: data.niveau, pointsGagnes: data.pointsGagnes });
      setEtat('victoire_par_abandon');
    });

    socket.on('defaite_par_abandon', (data: {
      niveau: number;
      pointsPerdus: number;
      pointsJoueur: number;
      pointsAdversaire: number;
    }) => {
      console.log('💀 [useDuel] Défaite par abandon reçue:', data);
      nettoyerTimers();
      setPointsJoueur(data.pointsJoueur);
      setPointsAdversaire(data.pointsAdversaire);
      setNiveau(data.niveau);
      setAbandonData(null);
      setEtat('defaite_par_abandon');
    });

    socket.on('nouvelle_manche', (data: {
      niveau: number;
      nombreMystere: number;
      essaisMax: number;
      premierTour: string;
      pointsNiveau: number;
      pointsJoueur1: number;
      pointsJoueur2: number;
      temps: number;
    }) => {
      console.log('✅ [useDuel] Nouvelle manche:', data);
      setNiveau(data.niveau);
      setProchainNiveau(data.niveau + 1);
      setNombreMystere(data.nombreMystere);
      setEssaisRestants(data.essaisMax);
      setPointsNiveauGagnes(data.pointsNiveau);
      setPointsJoueur(data.pointsJoueur1);
      setPointsAdversaire(data.pointsJoueur2);
      setPropositions([]);
      setEssaisAdversaire(0);
      setEtat('en_cours');
      
      const estMonTour = data.premierTour === pseudo;
      setMonTour(estMonTour);
      
      if (estMonTour) {
        demarrerTimerAffichage(data.temps);
      } else {
        arreterTimerAffichage();
        setTempsRestant(0);
      }
      
      setConfirmationEnvoyee(false);
      setAdversaireAConfirme(false);
      setAbandonData(null);
    });

    socket.on('proposition_adversaire', (data: {
      pseudo: string;
      nbPropositions: number;
      prochainTour: string;
      temps: number;
    }) => {
      console.log('🔄 [useDuel] Proposition adversaire:', data);
      setEssaisAdversaire(data.nbPropositions);
      
      const estMonTour = data.prochainTour === pseudo;
      setMonTour(estMonTour);
      
      if (estMonTour) {
        demarrerTimerAffichage(data.temps);
      } else {
        arreterTimerAffichage();
        setTempsRestant(0);
      }
    });

    socket.on('timeout_serveur', (data: {
      joueur: string;
      essaisRestants: number;
      prochainTour: string;
      temps: number;
    }) => {
      console.log('⏰ [useDuel] Timeout serveur reçu:', data);
      
      if (data.joueur === pseudo) {
        setEssaisRestants(data.essaisRestants);
      } else {
        setEssaisAdversaire(data.essaisRestants);
      }
      
      const estMonTour = data.prochainTour === pseudo;
      setMonTour(estMonTour);
      
      if (estMonTour) {
        demarrerTimerAffichage(data.temps);
      } else {
        arreterTimerAffichage();
        setTempsRestant(0);
      }
    });

    socket.on('duel_termine', (data: {
      vainqueur: string | null;
      nombreMystere: number;
      pointsJoueur1: number;
      pointsJoueur2: number;
      niveau: number;
    }) => {
      console.log('✅ [useDuel] Duel terminé:', data);
      nettoyerTimers();
      const duree = Math.floor((Date.now() - debutPartieRef.current) / 1000);
      const aGagne = data.vainqueur === pseudo;
      const egalite = data.vainqueur === null;

      setResultat({
        vainqueur: data.vainqueur,
        pointsJoueur: aGagne ? data.pointsJoueur1 : data.pointsJoueur2,
        pointsAdversaire: aGagne ? data.pointsJoueur2 : data.pointsJoueur1,
        duree,
        niveauMax: data.niveau,
        nombreMystere: data.nombreMystere,
        essaisJoueur: propositions.length,
        essaisAdversaire: essaisAdversaire,
      });

      if (egalite) setEtat('egal');
      else if (aGagne) setEtat('victoire');
      else setEtat('defaite');
    });

    socket.on('adversaire_deconnecte', () => {
      console.log('⚠️ [useDuel] Adversaire déconnecté');
      nettoyerTimers();
      setEtat('adversaire_parti');
    });

    socket.on('adversaire_a_quitte', (data: { message: string }) => {
      console.log('🚪 [useDuel] Adversaire a quitté proprement:', data.message);
      nettoyerTimers();
      setEtat('adversaire_a_quitte');
    });

    socket.on('erreur', (data: { message: string }) => {
      console.log('❌ [useDuel] Erreur reçue:', data.message);
      setErreur(data.message);
      if (data.message === 'Salle introuvable' || data.message === 'Salle déjà en cours') {
        setEtat('idle');
      }
    });

    socket.on('confirmation_enregistree', (data: { message: string }) => {
      console.log('✅ [useDuel] Confirmation enregistrée:', data.message);
      setConfirmationEnvoyee(true);
    });

    socket.on('adversaire_a_confirme', (data: { message: string }) => {
      console.log('✅ [useDuel] Adversaire a confirmé:', data.message);
      setAdversaireAConfirme(true);
    });

    socket.on('connect', () => setEstConnecte(true));
    socket.on('disconnect', () => {
      console.log('⚠️ [useDuel] Socket déconnecté');
      setEstConnecte(false);
      arreterTimerAffichage();
      if (etat === 'en_cours') setEtat('adversaire_parti');
    });
  }, [pseudo, demarrerTimerAffichage, arreterTimerAffichage, nettoyerTimers, etat]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  ACTIONS PUBLIQUES
  // ═══════════════════════════════════════════════════════════════════════════

  const creerSalle = useCallback(async (niveauChoisi: number) => {
    console.log('🔍 [useDuel] creerSalle appelé avec niveau:', niveauChoisi);
    setErreur('');
    setEtat('creation');

    try {
      const socket = await connecterSocket();
      configurerListeners(socket);
      
      if (!socket.connected) {
        await new Promise<void>((resolve) => socket.once('connect', resolve));
      }
      
      socket.emit('creer_salle', { pseudo, niveau: niveauChoisi });
      console.log('✅ [useDuel] creer_salle émis');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer la salle';
      setErreur(message);
      setEtat('idle');
      Alert.alert('Erreur', message);
    }
  }, [pseudo, connecterSocket, configurerListeners]);

  const rejoindreSalle = useCallback(async (code: string) => {
    console.log('🔍 [useDuel] rejoindreSalle appelé avec code:', code);
    setErreur('');
    setEtat('rejoindre');

    try {
      const socket = await connecterSocket();
      configurerListeners(socket);
      socket.emit('rejoindre_salle', { code: code.toUpperCase(), pseudo });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Code invalide ou salle inexistante';
      setErreur(message);
      setEtat('idle');
      Alert.alert('Erreur', message);
    }
  }, [pseudo, connecterSocket, configurerListeners]);

  const envoyerPret = useCallback(() => {
    if (socketRef.current?.connected && etat === 'attente' && !pretEnvoye) {
      console.log('✅ [useDuel] Envoi de la confirmation PRET');
      socketRef.current.emit('pret', { pseudo });
      setPretEnvoye(true);
    }
  }, [pseudo, etat, pretEnvoye]);

  const proposerNombre = useCallback((valeur: number) => {
    if (!monTour) {
      setErreur("Ce n'est pas votre tour");
      return;
    }
    if (etat !== 'en_cours') {
      setErreur("La partie n'est pas en cours");
      return;
    }

    const config = NIVEAUX_CONFIG[niveau as keyof typeof NIVEAUX_CONFIG];
    if (valeur < config.min || valeur > config.max) {
      setErreur(`Le nombre doit être entre ${config.min} et ${config.max}`);
      return;
    }

    if (propositions.some(p => p.valeur === valeur)) {
      setErreur('Vous avez déjà proposé ce nombre');
      return;
    }

    const indice: PropositionDuel['indice'] =
      valeur === nombreMystere ? 'egal' :
      valeur < nombreMystere ? 'plus' : 'moins';

    const nouvelleProposition: PropositionDuel = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      valeur,
      indice,
      temps: tempsRestant,
      timestamp: Date.now(),
    };

    setPropositions(prev => [...prev, nouvelleProposition]);
    setEssaisRestants(prev => prev - 1);
    setMonTour(false);
    
    arreterTimerAffichage();
    setTempsRestant(0);

    if (socketRef.current?.connected) {
      socketRef.current.emit('proposition', { pseudo, valeur });
    }

    if (valeur === nombreMystere) {
      nettoyerTimers();
    }
  }, [monTour, etat, niveau, nombreMystere, propositions, tempsRestant, pseudo, nettoyerTimers, arreterTimerAffichage]);

  const continuerMancheSuivante = useCallback(() => {
    if (socketRef.current?.connected && (etat === 'victoire_manche' || etat === 'defaite_manche')) {
      if (!confirmationEnvoyee) {
        socketRef.current.emit('continuer_manche', { pseudo });
        setConfirmationEnvoyee(true);
      }
    }
  }, [pseudo, etat, confirmationEnvoyee]);

  const quitterProprement = useCallback(() => {
    Alert.alert(
      "Quitter le duel",
      "Voulez-vous vraiment quitter ce duel ?\n\n✓ Vous gardez vos points déjà gagnés\n✓ L'adversaire sera notifié\n✓ Aucune pénalité ne sera appliquée",
      [
        { text: "Non", style: "cancel" },
        { 
          text: "Oui", 
          style: "default",
          onPress: () => {
            arreterTimerAffichage();
            
            if (socketRef.current?.connected) {
              socketRef.current.emit('quitter_salle', { pseudo });
            }
            
            nettoyerTimers();
            setEtat('idle');
            setPropositions([]);
            setResultat(null);
            setCodeSalle('');
            setErreur('');
            setAdversairePseudo(null);
            setEssaisAdversaire(0);
            setMonTour(false);
            setTempsRestant(0);
            setCompteARebours(0);
            setConfirmationEnvoyee(false);
            setAdversaireAConfirme(false);
            setPretEnvoye(false);
            setAbandonData(null);
            setPointsJoueur(0);
            setPointsAdversaire(0);
          }
        }
      ]
    );
  }, [pseudo, nettoyerTimers, arreterTimerAffichage]);

  const annulerSalle = useCallback(() => {
    arreterTimerAffichage();
    
    if (socketRef.current?.connected) {
      socketRef.current.emit('annuler_salle', { pseudo });
    }
    
    nettoyerTimers();
    setEtat('idle');
    setPropositions([]);
    setResultat(null);
    setCodeSalle('');
    setErreur('');
    setAdversairePseudo(null);
    setEssaisAdversaire(0);
    setMonTour(false);
    setTempsRestant(0);
    setCompteARebours(0);
    setConfirmationEnvoyee(false);
    setAdversaireAConfirme(false);
    setPretEnvoye(false);
    setAbandonData(null);
    setEstHote(false);
    setPointsJoueur(0);
    setPointsAdversaire(0);
  }, [pseudo, nettoyerTimers, arreterTimerAffichage]);

  const abandonner = useCallback(() => {
    Alert.alert(
      "Abandonner le duel",
      "Voulez-vous vraiment abandonner ce match ? Vous perdrez la partie en cours.",
      [
        { text: "Non", style: "cancel" },
        { 
          text: "Oui", 
          style: "destructive",
          onPress: () => {
            arreterTimerAffichage();
            
            if (socketRef.current?.connected) {
              socketRef.current.emit('abandonner', { pseudo });
            }
            
            nettoyerTimers();
            setEtat('defaite_par_abandon');
            setPropositions([]);
            setResultat(null);
            setCodeSalle('');
            setErreur('');
            setAdversairePseudo(null);
            setEssaisAdversaire(0);
            setMonTour(false);
            setTempsRestant(0);
            setCompteARebours(0);
            setConfirmationEnvoyee(false);
            setAdversaireAConfirme(false);
            setPretEnvoye(false);
          }
        }
      ]
    );
  }, [pseudo, nettoyerTimers, arreterTimerAffichage]);

  const reinitialiser = useCallback(() => {
    arreterTimerAffichage();
    if (socketRef.current?.connected) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setEtat('idle');
    setPropositions([]);
    setResultat(null);
    setCodeSalle('');
    setErreur('');
    setAdversairePseudo(null);
    setEssaisAdversaire(0);
    setPointsJoueur(0);
    setPointsAdversaire(0);
    setMonTour(false);
    setTempsRestant(0);
    setCompteARebours(0);
    setConfirmationEnvoyee(false);
    setAdversaireAConfirme(false);
    setAbandonData(null);
    setEstHote(false);
    setPretEnvoye(false);
  }, [arreterTimerAffichage]);

  const niveauConfig = NIVEAUX_CONFIG[niveau as keyof typeof NIVEAUX_CONFIG] ?? NIVEAUX_CONFIG[1];
  const derniereProposition = propositions[propositions.length - 1] ?? null;

  // Nettoyage final
  useEffect(() => {
    return () => {
      arreterTimerAffichage();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [arreterTimerAffichage]);

  return {
    etat,
    codeSalle,
    niveau,
    prochainNiveau,
    nombreMystere,
    propositions,
    resultat,
    erreur,
    adversairePseudo,
    tempsRestant,
    compteARebours,
    essaisRestants,
    essaisAdversaire,
    pointsJoueur,
    pointsAdversaire,
    pointsNiveauGagnes,
    estHote,
    estConnecte,
    monTour,
    derniereProposition,
    niveauConfig,
    confirmationEnvoyee,
    adversaireAConfirme,
    abandonData,
    creerSalle,
    rejoindreSalle,
    envoyerPret,
    proposerNombre,
    continuerMancheSuivante,
    abandonner,
    quitterProprement,
    annulerSalle,
    reinitialiser,
  };
};

export default useDuel;