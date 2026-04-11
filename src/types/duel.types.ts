// src/types/duel.types.ts
// ═══════════════════════════════════════════════════════════════════════════════
//  TYPES DU MODE DUEL — Architecture complète pour les affrontements en temps réel
//  Contient toutes les structures de données nécessaires au fonctionnement du duel
//  Garantit l'intégrité des échanges entre clients via TypeScript strict
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ============================================================================
 *  ENTITÉS DE BASE
 * ============================================================================
 */

/**
 * Représente un joueur dans le contexte du duel
 * Contient toutes les informations nécessaires pour identifier et contacter un joueur
 */
export interface Joueur {
  /** Identifiant unique du joueur (généré côté serveur) */
  id: string;
  
  /** Nom d'utilisateur affiché dans l'interface */
  pseudo: string;
  
  /** Adresse IP pour la connexion P2P (WebSocket direct) */
  ip: string;
  
  /** Niveau actuel du joueur (1-4) */
  niveau: number;
  
  /** Nombre total de victoires en duel (statistiques cumulées) */
  victoires: number;
  
  /** Nombre total de défaites en duel (statistiques cumulées) */
  defaites: number;
  
  /** Ratio victoires/défaites en pourcentage (ex: 68 = 68%) */
  ratio: number;
  
  /** Points totaux gagnés en duel (toutes parties confondues) */
  points: number;
  
  /** Indique si le joueur est actuellement en ligne et joignable */
  estConnecte: boolean;
}

/**
 * ============================================================================
 *  PROPOSITIONS ET INDICES
 * ============================================================================
 */

/**
 * Indice retourné après une proposition
 * - 'plus' : le nombre mystère est supérieur à la proposition
 * - 'moins' : le nombre mystère est inférieur à la proposition
 * - 'egal' : proposition correcte, victoire de la manche
 */
export type Indice = 'plus' | 'moins' | 'egal';

/**
 * Structure d'une proposition faite par un joueur
 */
export interface Proposition {
  /** Identifiant du joueur qui a fait la proposition */
  joueurId: string;
  
  /** Valeur numérique proposée */
  valeur: number;
  
  /** Indice retourné par le système (null si non encore évalué) */
  indice: Indice | null;
  
  /** Temps écoulé avant la proposition (en secondes, 0-30) */
  temps: number;
  
  /** Horodatage exact de la proposition (pour ordre chronologique) */
  timestamp: Date;
}

/**
 * ============================================================================
 *  MANCHES (chacune correspond à un niveau)
 * ============================================================================
 */

/**
 * Structure d'une manche individuelle dans un duel
 * Une manche = un niveau du jeu (1,2,3 ou 4)
 */
export interface Manche {
  /** Numéro de la manche dans l'ordre du duel (1,2,3,4) */
  numero: number;
  
  /** Niveau de difficulté (1,2,3,4) */
  niveau: number;
  
  /** Nombre mystère généré aléatoirement pour cette manche */
  nombreMystere: number;
  
  /** Liste des propositions faites pendant cette manche */
  propositions: Proposition[];
  
  /** Pseudo du joueur qui a gagné cette manche (null si personne ou si match nul) */
  vainqueur: string | null;
  
  /** Indique si la manche est terminée (victoire ou double élimination) */
  terminee: boolean;
  
  /** Points attribués au vainqueur de la manche (1000,2000,3000,5000 selon niveau) */
  pointsAttribues: number;
}

/**
 * ============================================================================
 *  DUEL COMPLET
 * ============================================================================
 */

/**
 * État global d'un duel
 * - 'attente' : en attente d'adversaire
 * - 'en_cours' : duel actif
 * - 'termine' : duel terminé (victoire/défaite/égalité)
 */
export type StatutDuel = 'attente' | 'en_cours' | 'termine';

/**
 * Raison de la fin d'un duel
 * - 'double_elimination' : les deux joueurs ont épuisé leurs essais
 * - 'victoire_niveau4' : un joueur a gagné au niveau 4
 * - 'abandon' : un joueur a abandonné
 */
export type RaisonFin = 'double_elimination' | 'victoire_niveau4' | 'abandon';

/**
 * Structure complète d'un duel en cours
 */
export interface Duel {
  /** Identifiant unique du duel */
  id: string;
  
  /** Joueur hôte (celui qui a créé la partie) */
  hote: Joueur;
  
  /** Joueur invité (celui qui a rejoint) */
  invite: Joueur | null;
  
  /** Niveau actuel du duel (1-4) */
  niveauActuel: number;
  
  /** État global du duel */
  statut: StatutDuel;
  
  /** Liste des manches jouées */
  manches: Manche[];
  
  /** Points cumulés de l'hôte (somme des points des manches gagnées) */
  pointsHote: number;
  
  /** Points cumulés de l'invité (somme des points des manches gagnées) */
  pointsInvite: number;
  
  /** Pseudo du vainqueur final (null si match nul) */
  vainqueur: string | null;
  
  /** Date et heure de début du duel */
  dateDebut: Date;
  
  /** Date et heure de fin du duel (null si duel en cours) */
  dateFin: Date | null;
  
  /** Raison de la fin du duel (null si duel en cours) */
  raisonFin?: RaisonFin;
}

/**
 * ============================================================================
 *  RÉSULTATS ET STATISTIQUES
 * ============================================================================
 */

/**
 * Structure pour sauvegarder un résultat de duel (persistance)
 */
export interface ResultatDuel {
  /** Identifiant unique du résultat */
  id: string;
  
  /** Pseudo du premier joueur */
  joueur1: string;
  
  /** Pseudo du second joueur */
  joueur2: string;
  
  /** Pseudo du vainqueur (null = match nul) */
  vainqueur: string | null;
  
  /** Points gagnés par le joueur 1 */
  pointsJoueur1: number;
  
  /** Points gagnés par le joueur 2 */
  pointsJoueur2: number;
  
  /** Score final formaté (ex: "3-1" ou "0-0") */
  scoreManches: string;
  
  /** Date et heure du duel */
  date: Date;
  
  /** Durée totale du duel en secondes */
  duree: number;
  
  /** Niveau maximum atteint pendant le duel */
  niveauMax: number;
}

/**
 * ============================================================================
 *  STATISTIQUES JOUEUR
 * ============================================================================
 */

/**
 * Statistiques détaillées d'un joueur pour le mode duel
 */
export interface StatistiquesJoueur {
  /** Nombre total de duels joués */
  totalDuels: number;
  
  /** Nombre de victoires */
  victoires: number;
  
  /** Nombre de défaites */
  defaites: number;
  
  /** Ratio victoires/défaites (en pourcentage) */
  ratio: number;
  
  /** Meilleure série de victoires consécutives */
  meilleureSerie: number;
  
  /** Points totaux gagnés en duel */
  pointsGagnes: number;
  
  /** Temps de réflexe moyen (en secondes) */
  tempsMoyenReflexe: number;
  
  /** Liste des adversaires fréquents avec statistiques de confrontations */
  adversairesFrequents: AdversaireFrequent[];
}

/**
 * Structure pour un adversaire fréquent
 */
export interface AdversaireFrequent {
  /** Pseudo de l'adversaire */
  pseudo: string;
  
  /** Nombre de rencontres avec cet adversaire */
  rencontres: number;
  
  /** Nombre de victoires contre cet adversaire */
  victoires: number;
}

/**
 * Statistiques cumulées d'un joueur (version simplifiée pour classement)
 */
export interface StatsDuel {
  /** Pseudo du joueur */
  pseudo: string;
  
  /** Nombre total de duels joués */
  totalDuels: number;
  
  /** Nombre de victoires */
  victoires: number;
  
  /** Nombre de défaites */
  defaites: number;
  
  /** Nombre de matchs nuls */
  matchsNuls: number;
  
  /** Points totaux gagnés */
  pointsTotal: number;
  
  /** Meilleure série de victoires */
  meilleureSerie: number;
  
  /** Série actuelle de victoires/défaites */
  serieActuelle: number;
  
  /** Niveau maximum atteint en duel */
  niveauMax: number;
  
  /** Précision par niveau (pourcentage de réussite) */
  precisionParNiveau: PrecisionParNiveau;
  
  /** Temps de réflexe moyen en secondes */
  tempsMoyenReflexe: number;
  
  /** Liste des adversaires fréquents */
  adversairesFrequents: AdversaireFrequent[];
}

/**
 * Précision par niveau (pourcentage de manches gagnées)
 */
export interface PrecisionParNiveau {
  niveau1: number;   // % de réussite au niveau 1
  niveau2: number;   // % de réussite au niveau 2
  niveau3: number;   // % de réussite au niveau 3
  niveau4: number;   // % de réussite au niveau 4
}

/**
 * ============================================================================
 *  HISTORIQUE DES DUELS
 * ============================================================================
 */

/**
 * Entrée d'historique pour un duel (vue simplifiée)
 */
export interface HistoriqueDuel {
  /** Identifiant unique du duel */
  id: string;
  
  /** Pseudo de l'adversaire */
  adversaire: string;
  
  /** Niveau maximum atteint */
  niveau: number;
  
  /** Résultat du duel pour le joueur */
  resultat: 'victoire' | 'defaite';
  
  /** Score formaté (ex: "3-1") */
  score: string;
  
  /** Points gagnés lors de ce duel */
  points: number;
  
  /** Durée du duel en secondes */
  duree: number;
  
  /** Date et heure du duel */
  date: Date;
}

/**
 * ============================================================================
 *  MESSAGES RÉSEAU
 * ============================================================================
 */

/**
 * Types de messages échangeables via WebSocket
 */
export type MessageReseauType = 
  | 'connexion'           // Premier handshake
  | 'creer_partie'        // Création d'une partie (hôte)
  | 'rejoindre_partie'    // Rejoint une partie (client)
  | 'partie_creee'        // Confirmation de création
  | 'partie_rejointe'     // Confirmation de jonction
  | 'joueur_connecte'     // Adversaire connecté
  | 'proposition'         // Proposition d'un nombre
  | 'nouvelle_manche'     // Passage au niveau suivant
  | 'fin_duel'            // Fin du duel
  | 'chat'                // Message texte
  | 'temps_ecoule'        // Timer expiré
  | 'abandon'             // Abandon du duel
  | 'erreur';             // Erreur réseau

/**
 * Structure d'un message réseau
 */
export interface MessageReseau {
  /** Identifiant unique du message */
  id: string;
  
  /** Type de message */
  type: MessageReseauType;
  
  /** Données du message (dépend du type) */
  donnees: any;
  
  /** Horodatage d'envoi */
  timestamp: number;
  
  /** Expéditeur du message (null = système) */
  expediteur: string | null;
  
  /** Identifiant de la partie concernée */
  idPartie: string;
}

/**
 * ============================================================================
 *  CONFIGURATION DU DUEL
 * ============================================================================
 */

/**
 * Configuration d'un niveau de duel
 */
export interface NiveauDuelConfig {
  id: number;
  label: string;
  min: number;
  max: number;
  essaisMax: number;
  points: number;
  icon: string;
  couleur: string;
}

/**
 * Configuration complète des 4 niveaux
 */
export const NIVEAUX_DUEL_CONFIG: NiveauDuelConfig[] = [
  { id: 1, label: 'Débutant', min: 1, max: 100,  essaisMax: 10, points: 1000, icon: '🌱', couleur: '#16a34a' },
  { id: 2, label: 'Confirmé', min: 1, max: 500,  essaisMax: 8,  points: 2000, icon: '🌿', couleur: '#3b82f6' },
  { id: 3, label: 'Expert',   min: 1, max: 1000, essaisMax: 6,  points: 3000, icon: '🔥', couleur: '#f97316' },
  { id: 4, label: 'Légendaire', min: 1, max: 9999, essaisMax: 5, points: 5000, icon: '👑', couleur: '#ef4444' },
];

/**
 * ============================================================================
 *  FONCTIONS UTILITAIRES DE TYPE (type guards)
 * ============================================================================
 */

/**
 * Vérifie si une valeur est un type d'indice valide
 */
export const estIndiceValide = (valeur: any): valeur is Indice => {
  return valeur === 'plus' || valeur === 'moins' || valeur === 'egal';
};

/**
 * Vérifie si un message réseau est valide
 */
export const estMessageReseauValide = (message: any): message is MessageReseau => {
  return message && typeof message === 'object' && 
         typeof message.id === 'string' &&
         typeof message.type === 'string' &&
         typeof message.timestamp === 'number';
};

/**
 * Vérifie si un duel est terminé
 */
export const estDuelTermine = (duel: Duel): boolean => {
  return duel.statut === 'termine' || duel.dateFin !== null;
};

/**
 * Vérifie si un joueur peut encore proposer
 */
export const peutEncoreProposer = (manche: Manche, joueurId: string): boolean => {
  const propositionsJoueur = manche.propositions.filter(p => p.joueurId === joueurId);
  const essaisMax = manche.niveau === 1 ? 10 : manche.niveau === 2 ? 8 : manche.niveau === 3 ? 5 : 3;
  return !manche.terminee && propositionsJoueur.length < essaisMax;
};