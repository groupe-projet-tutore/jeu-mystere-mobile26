// src/config/serveur.ts
// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION CENTRALISÉE — Point unique de vérité pour toutes les constantes
// ═══════════════════════════════════════════════════════════════════════════════

// ── IP du serveur (à modifier selon l'environnement) ─────────────────────────
export const SERVEUR_IP = '10.53.2.180';

// ── Configuration des ports ──────────────────────────────────────────────────
export const PORT_API = 5000;
export const PORT_WS = 5000;

// ── Protocoles ───────────────────────────────────────────────────────────────
export const API_PROTOCOL = 'http';
export const WS_PROTOCOL = 'ws';

// ── URLs complètes ──────────────────────────────────────────────────────────
export const API_URL = `${API_PROTOCOL}://${SERVEUR_IP}:${PORT_API}/api`;
export const WS_URL = `${WS_PROTOCOL}://${SERVEUR_IP}:${PORT_WS}/socket.io`;

// ── Configuration de synchronisation ────────────────────────────────────────
export const SYNC_CONFIG = {
  TIMEOUT_MS: 5000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// ── Configuration des temps de jeu ──────────────────────────────────────────
export const TEMPS_CONFIG = {
  TOUR_LIMITE: 30,
  COMPTE_A_REBOURS: 3,
  TIMEOUT_SERVEUR: 5000,
} as const;

// ── Configuration des niveaux ────────────────────────────────────────────────
export const NIVEAUX_CONFIG = {
  1: { min: 1, max: 100, essaisMax: 10, points: 1000, label: 'Débutant', icon: '🌱' },
  2: { min: 1, max: 200, essaisMax: 8, points: 2000, label: 'Intermédiaire', icon: '🌿' },
  3: { min: 1, max: 300, essaisMax: 5, points: 3000, label: 'Expert', icon: '🔥' },
  4: { min: 1, max: 500, essaisMax: 3, points: 5000, label: 'Maître', icon: '👑' },
} as const;

// ── Export groupé pour useReseau ────────────────────────────────────────────
export const SERVEUR_CONFIG = {
  IP: SERVEUR_IP,
  PORT_API,
  PORT_WS,
  API_PROTOCOL,
  WS_PROTOCOL,
  API_URL,
  WS_URL,
};

export default {
  SERVEUR_IP,
  API_URL,
  WS_URL,
  SYNC_CONFIG,
  TEMPS_CONFIG,
  NIVEAUX_CONFIG,
  SERVEUR_CONFIG,
};