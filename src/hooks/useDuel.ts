// src/hooks/useDuel.ts
// ═══════════════════════════════════════════════════════════════════════════════
//  HOOK DUEL — Version avec nouveau système post-manche
//  - Intervalle FIXE (ne se réduit pas)
//  - Créateur : peut choisir niveau ou recommencer
//  - Invité : confirme après choix du créateur
//  - Communication WebSocket pour les nouvelles actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration, Alert } from 'react-native';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { API_URL, TEMPS_CONFIG, NIVEAUX_CONFIG } from '../config/serveur';

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

export const useDuel = (pseudo: string) => {
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
  const [tempsRestant, setTempsRestant] = useState<number>(0);
  const [compteARebours, setCompteARebours] = useState<number>(0);
  const [essaisRestants, setEssaisRestants] = useState<number>(10);
  const [essaisAdversaire, setEssaisAdversaire] = useState<number>(0);
  const [adversairePseudo, setAdversairePseudo] = useState<string | null>(null);
  const [pointsJoueur, setPointsJoueur] = useState<number>(0);
  const [pointsAdversaire, setPointsAdversaire] = useState<number>(0);
  const [pointsNiveauGagnes, setPointsNiveauGagnes] = useState<number>(0);
  const [estConnecte, setEstConnecte] = useState<boolean>(false);
  const [monTour, setMonTour] = useState<boolean>(false);
  const [confirmationEnvoyee, setConfirmationEnvoyee] = useState<boolean>(false);
  const [adversaireAConfirme, setAdversaireAConfirme] = useState<boolean>(false);
  
  // Nouveaux états pour le système post-manche
  const [actionCreateur, setActionCreateur] = useState<string | null>(null);
  const [prochainNiveauChoisi, setProchainNiveauChoisi] = useState<number>(1);
  const [victoiresJoueur1, setVictoiresJoueur1] = useState<number>(0);
  const [victoiresJoueur2, setVictoiresJoueur2] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);
  const timerAffichageRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debutPartieRef = useRef<number>(0);
  const dernierTourRef = useRef<boolean>(false);
  const pretEnvoyeRef = useRef<boolean>(false);
  const tentativeReconnexionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compteurTentativesRef = useRef<number>(0);
  const pseudoRef = useRef(pseudo);
  const estHoteRef = useRef(false);

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

  useEffect(() => {
    if (monTour && etat === 'en_cours' && !dernierTourRef.current) {
      Vibration.vibrate(200);
      dernierTourRef.current = true;
    } else if (!monTour) {
      dernierTourRef.current = false;
    }
  }, [monTour, etat]);

  const connecterSocket = useCallback((): Promise<Socket> => {
    const baseUrl = API_URL.replace('/api', '');
    const socketUrl = baseUrl.replace('http://', 'ws://');
    
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
        socket.disconnect();
        reject(new Error('Délai de connexion dépassé (10s)'));
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socketRef.current = socket;
        setEstConnecte(true);
        compteurTentativesRef.current = 0;
        if (tentativeReconnexionRef.current) {
          clearTimeout(tentativeReconnexionRef.current);
          tentativeReconnexionRef.current = null;
        }
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Erreur connexion: ${err.message || 'serveur indisponible'}`));
      });
      
      socket.on('disconnect', () => {
        setEstConnecte(false);
        arreterTimerAffichage();
        
        if (etat === 'en_cours' && compteurTentativesRef.current < 3) {
          compteurTentativesRef.current++;
          tentativeReconnexionRef.current = setTimeout(() => {
            connecterSocket().then(socket => {
              configurerListeners(socket);
              if (codeSalle) {
                socket.emit('rejoindre_salle', { code: codeSalle, pseudo: pseudoRef.current });
              }
            }).catch(() => {});
          }, 1000 * Math.pow(2, compteurTentativesRef.current));
        } else if (etat === 'en_cours') {
          setEtat('adversaire_parti');
        }
      });
    });
  }, [API_URL, codeSalle, etat, arreterTimerAffichage]);

  const configurerListeners = useCallback((socket: Socket) => {
    socket.on('salle_creee', (data: { code: string; niveau: number; estHote: boolean }) => {
      setCodeSalle(data.code);
      setEstHote(true);
      setNiveau(data.niveau);
      setEtat('attente');
      estHoteRef.current = true;
      pretEnvoyeRef.current = false;
      setActionCreateur(null);
    });

    socket.on('vous_avez_rejoint', (data: { adversaire: string; estHote: boolean; niveau: number }) => {
      setAdversairePseudo(data.adversaire);
      console.log('📡 vous_avez_rejoint - estHote reçu:', data.estHote);  
      setEstHote(data.estHote);
      setNiveau(data.niveau);
      setEtat('attente');
      estHoteRef.current = data.estHote;
      pretEnvoyeRef.current = false;
      setActionCreateur(null);
    });

    socket.on('adversaire_rejoint', (data: { pseudo: string }) => {
      setAdversairePseudo(data.pseudo);
    });

    socket.on('compte_a_rebours', (data: { valeur: number }) => {
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
      setActionCreateur(null);
      setConfirmationEnvoyee(false);
      setAdversaireAConfirme(false);
      
      const estMonTour = data.premierTour === pseudoRef.current;
      setMonTour(estMonTour);
      
      if (estMonTour) {
        demarrerTimerAffichage(data.temps);
      } else {
        arreterTimerAffichage();
        setTempsRestant(0);
      }
      
      setAbandonData(null);
    });

    socket.on('victoire_manche', (data: {
      vainqueur: string;
      niveau: number;
      victoiresJoueur1: number;
      victoiresJoueur2: number;
      joueur1: string;
      joueur2: string;
    }) => {
      nettoyerTimers();

      setVictoiresJoueur1(data.victoiresJoueur1);
      setVictoiresJoueur2(data.victoiresJoueur2);

      const mesVictoires = data.joueur1 === pseudoRef.current
        ? data.victoiresJoueur1
        : data.victoiresJoueur2;

      const sesVictoires = data.joueur1 === pseudoRef.current
        ? data.victoiresJoueur2
        : data.victoiresJoueur1;

      setPointsJoueur(mesVictoires);
      setPointsAdversaire(sesVictoires);

      setNiveau(data.niveau);
      setConfirmationEnvoyee(false);
      setAdversaireAConfirme(false);

      if (data.vainqueur === pseudoRef.current) {
        setEtat('victoire_manche');
      } else {
        setEtat('defaite_manche');
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  NOUVEAU: Le créateur a choisi une action (niveau ou recommencer)
    //  ⚠️ CRITIQUE: C'est cet événement qui permet à l'invité de voir le choix !
    // ═══════════════════════════════════════════════════════════════════════
    socket.on('createur_a_choisi', (data: { action: string; niveau: number }) => {
      console.log('📡 createur_a_choisi reçu:', data);
      setActionCreateur(data.action);
      setProchainNiveauChoisi(data.niveau);
    });

    socket.on('nouveau_duel_prepare', (data: {
      niveau: number;
      nombreMystere: number;
      essaisMax: number;
      premierTour: string;
      temps: number;
    }) => {
      setNiveau(data.niveau);
      setNombreMystere(data.nombreMystere);
      setEssaisRestants(data.essaisMax);
      setPropositions([]);
      setEssaisAdversaire(0);
      setCompteARebours(3);
      setEtat('compte_a_rebours');
      setActionCreateur(null);
      setConfirmationEnvoyee(false);
      setAdversaireAConfirme(false);
      
      const estMonTour = data.premierTour === pseudoRef.current;
      setMonTour(estMonTour);
      
      if (estMonTour) {
        demarrerTimerAffichage(data.temps);
      } else {
        arreterTimerAffichage();
        setTempsRestant(0);
      }
    });

    socket.on('victoire_par_abandon', (data: {
      niveau: number;
      pointsGagnes: number;
      pointsJoueur: number;
      pointsAdversaire: number;
      adversaire: string;
    }) => {
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
      nettoyerTimers();
      setPointsJoueur(data.pointsJoueur);
      setPointsAdversaire(data.pointsAdversaire);
      setNiveau(data.niveau);
      setAbandonData(null);
      setEtat('defaite_par_abandon');
    });

    socket.on('proposition_adversaire', (data: {
      pseudo: string;
      nbPropositions: number;
      prochainTour: string;
      temps: number;
    }) => {
      setEssaisAdversaire(data.nbPropositions);
      
      const estMonTour = data.prochainTour === pseudoRef.current;
      setMonTour(estMonTour);
      
      if (estMonTour) {
        demarrerTimerAffichage(data.temps);
        Vibration.vibrate(100);
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
      Vibration.vibrate([200, 100, 200]);
      
      if (data.joueur === pseudoRef.current) {
        setEssaisRestants(data.essaisRestants);
      } else {
        setEssaisAdversaire(data.essaisRestants);
      }
      
      const estMonTour = data.prochainTour === pseudoRef.current;
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
      nettoyerTimers();
      const duree = Math.floor((Date.now() - debutPartieRef.current) / 1000);
      const aGagne = data.vainqueur === pseudoRef.current;
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
      nettoyerTimers();
      setEtat('adversaire_parti');
    });

    socket.on('adversaire_a_quitte', () => {
      nettoyerTimers();
      setEtat('adversaire_a_quitte');
    });

    socket.on('erreur', (data: { message: string }) => {
      setErreur(data.message);
      if (data.message === 'Salle introuvable' || data.message === 'Salle déjà en cours') {
        setEtat('idle');
      }
    });

    socket.on('confirmation_enregistree', () => {
      setConfirmationEnvoyee(true);
    });

        socket.on('adversaire_a_confirme', () => {
      setAdversaireAConfirme(true);
    });

    // ⬇️ AJOUTE ICI LE NOUVEAU LISTENER ⬇️
    socket.on('match_nul_attente', (data: {
      niveau: number;
      pointsJoueur1: number;
      pointsJoueur2: number;
      joueur1: string;
      joueur2: string;
      nombreMystere: number;
    }) => {
      console.log('📡 match_nul_attente reçu:', data);
      nettoyerTimers();
      
      // Mettre à jour les points
      if (pseudoRef.current === data.joueur1) {
        setPointsJoueur(data.pointsJoueur1);
        setPointsAdversaire(data.pointsJoueur2);
      } else {
        setPointsJoueur(data.pointsJoueur2);
        setPointsAdversaire(data.pointsJoueur1);
      }
      
      setNiveau(data.niveau);
      setNombreMystere(data.nombreMystere);
      setEtat('egal');  // ← déclenche l'écran match nul
      setActionCreateur(null);  // ← l'invité attend le choix du créateur
      setConfirmationEnvoyee(false);
      setAdversaireAConfirme(false);
    });

  }, [demarrerTimerAffichage, arreterTimerAffichage, nettoyerTimers, propositions.length, essaisAdversaire]);

  const creerSalle = useCallback(async (niveauChoisi: number) => {
    setErreur('');
    setEtat('creation');
    setActionCreateur(null);

    try {
      const socket = await connecterSocket();
      configurerListeners(socket);
      
      if (!socket.connected) {
        await new Promise<void>((resolve) => socket.once('connect', resolve));
      }
      
      socket.emit('creer_salle', { pseudo: pseudoRef.current, niveau: niveauChoisi });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer la salle';
      setErreur(message);
      setEtat('idle');
      Alert.alert('Erreur', message);
    }
  }, [connecterSocket, configurerListeners]);

  const rejoindreSalle = useCallback(async (code: string) => {
    setErreur('');
    setEtat('rejoindre');
    setActionCreateur(null);

    try {
      const socket = await connecterSocket();
      configurerListeners(socket);
      socket.emit('rejoindre_salle', { code: code.toUpperCase(), pseudo: pseudoRef.current });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Code invalide ou salle inexistante';
      setErreur(message);
      setEtat('idle');
      Alert.alert('Erreur', message);
    }
  }, [connecterSocket, configurerListeners]);

  const envoyerPret = useCallback(() => {
    if (socketRef.current?.connected && etat === 'attente' && !pretEnvoyeRef.current && adversairePseudo) {
      socketRef.current.emit('pret', { pseudo: pseudoRef.current });
      pretEnvoyeRef.current = true;
    }
  }, [etat, adversairePseudo]);

  const proposerNombre = useCallback((valeur: number) => {
    if (!monTour) {
      setErreur("Ce n'est pas votre tour");
      return;
    }
    if (etat !== 'en_cours') {
      setErreur("La partie n'est pas en cours");
      return;
    }
    if (essaisRestants <= 0) {
      setErreur("Vous n'avez plus d'essais");
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
      socketRef.current.emit('proposition', { pseudo: pseudoRef.current, valeur });
    }

    if (valeur === nombreMystere) {
      nettoyerTimers();
    }
  }, [monTour, etat, niveau, nombreMystere, propositions, tempsRestant, essaisRestants, nettoyerTimers, arreterTimerAffichage]);

  // Le créateur choisit un niveau
  const choisirNiveau = useCallback((niveauChoisi: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('createur_choisit_niveau', { pseudo: pseudoRef.current, niveau: niveauChoisi });
      setActionCreateur(`Niveau ${niveauChoisi}`);
      setProchainNiveauChoisi(niveauChoisi);
    }
  }, []);

  // Le créateur recommence le niveau actuel
  const recommencerNiveau = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('createur_choisit_niveau', { pseudo: pseudoRef.current, recommencer: true });
      setActionCreateur(`Niveau ${niveau} (replay)`);
      setProchainNiveauChoisi(niveau);
    }
  }, [niveau]);

  // ═══════════════════════════════════════════════════════════════════════
  //  L'invité confirme pour le nouveau duel
  //  ⚠️ CRITIQUE: Utilise actionCreateur pour savoir si le créateur a choisi
  // ═══════════════════════════════════════════════════════════════════════
const confirmerNouveauDuel = useCallback(() => {
  if (socketRef.current?.connected && !estHoteRef.current && actionCreateur && 
      (etat === 'victoire_manche' || etat === 'defaite_manche' || etat === 'egal') && !confirmationEnvoyee) {
    socketRef.current.emit('invite_confirme', { pseudo: pseudoRef.current });
    setConfirmationEnvoyee(true);
  }
}, [estHoteRef, actionCreateur, etat, confirmationEnvoyee]);

  const continuerMancheSuivante = useCallback(() => {
    if (socketRef.current?.connected && (etat === 'victoire_manche' || etat === 'defaite_manche')) {
      if (!confirmationEnvoyee) {
        socketRef.current.emit('continuer_manche', { pseudo: pseudoRef.current });
        setConfirmationEnvoyee(true);
      }
    }
  }, [etat, confirmationEnvoyee]);

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
              socketRef.current.emit('quitter_salle', { pseudo: pseudoRef.current });
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
            pretEnvoyeRef.current = false;
            setAbandonData(null);
            setPointsJoueur(0);
            setPointsAdversaire(0);
            setActionCreateur(null);
          }
        }
      ]
    );
  }, [nettoyerTimers, arreterTimerAffichage]);

  const annulerSalle = useCallback(() => {
    arreterTimerAffichage();
    
    if (socketRef.current?.connected) {
      socketRef.current.emit('annuler_salle', { pseudo: pseudoRef.current });
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
    pretEnvoyeRef.current = false;
    setAbandonData(null);
    setEstHote(false);
    setPointsJoueur(0);
    setPointsAdversaire(0);
    setActionCreateur(null);
  }, [nettoyerTimers, arreterTimerAffichage]);

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
              socketRef.current.emit('abandonner', { pseudo: pseudoRef.current });
              setEtat('defaite_par_abandon');
            } else {
              Alert.alert("Erreur", "Impossible de contacter le serveur");
              setEtat('idle');
            }
            
            nettoyerTimers();
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
            pretEnvoyeRef.current = false;
            setActionCreateur(null);
          }
        }
      ]
    );
  }, [nettoyerTimers, arreterTimerAffichage]);

  const reinitialiser = useCallback(() => {
    arreterTimerAffichage();
    if (socketRef.current?.connected) {
      // ✅ FIX : émettre quitter_salle AVANT de déconnecter
      // Sans ça, handle_disconnect côté serveur peut ne pas trouver la salle
      // si l'adversaire l'a déjà supprimée, et les stats ne sont jamais sauvegardées
      socketRef.current.emit('quitter_salle', { pseudo: pseudoRef.current });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (tentativeReconnexionRef.current) {
      clearTimeout(tentativeReconnexionRef.current);
      tentativeReconnexionRef.current = null;
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
    pretEnvoyeRef.current = false;
    compteurTentativesRef.current = 0;
    setActionCreateur(null);
    setVictoiresJoueur1(0);
    setVictoiresJoueur2(0);
  }, [arreterTimerAffichage]);
  
  const niveauConfig = NIVEAUX_CONFIG[niveau as keyof typeof NIVEAUX_CONFIG] ?? NIVEAUX_CONFIG[1];
  const derniereProposition = propositions[propositions.length - 1] ?? null;

  useEffect(() => {
    return () => {
      arreterTimerAffichage();
      if (tentativeReconnexionRef.current) {
        clearTimeout(tentativeReconnexionRef.current);
      }
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
    actionCreateur,
    prochainNiveauChoisi,
    victoiresJoueur1,
    victoiresJoueur2,
    creerSalle,
    rejoindreSalle,
    envoyerPret,
    proposerNombre,
    continuerMancheSuivante,
    choisirNiveau,
    recommencerNiveau,
    confirmerNouveauDuel,
    abandonner,
    quitterProprement,
    annulerSalle,
    reinitialiser,
    socketRef,
  };
};

export default useDuel;