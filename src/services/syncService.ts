// src/services/syncService.ts (mise à jour avec la config centralisée)
// ═══════════════════════════════════════════════════════════════════════════════
//  SERVICE DE SYNCHRONISATION INTELLIGENTE
// ═══════════════════════════════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, SYNC_CONFIG } from '../config/serveur';

// ── Types ────────────────────────────────────────────────────────────────────
export type StatutConnexion = 'connecte' | 'hors_ligne' | 'sync_en_cours';

export type ScoreLocal = {
  id:         string;
  pseudo:     string;
  niveauId:   number;
  points:     number;
  essais:     number;
  date:       string;
  synced:     boolean;
};

export type ProgressionLocale = {
  pseudo:           string;
  totalPoints:      number;
  niveauxDebloques: number[];
  niveauxCompletes: number[];
  derniereMaj:      string;
};

// ── Clés AsyncStorage ────────────────────────────────────────────────────────
const KEYS = {
  SCORES_FILE:    'nm_scores_queue',
  PROGRESSION:    'nm_progression',
  LAST_SYNC:      'nm_last_sync',
} as const;

// ── Utilisation de la configuration centralisée ─────────────────────────────
const TIMEOUT_MS = SYNC_CONFIG.TIMEOUT_MS;

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const fetchAvecTimeout = (url: string, options?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

export const verifierConnexion = async (): Promise<boolean> => {
  try {
    const res = await fetchAvecTimeout(`${API_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PROGRESSION — lecture / écriture locale
// ═══════════════════════════════════════════════════════════════════════════════

export const chargerProgression = async (pseudo: string): Promise<ProgressionLocale | null> => {
  try {
    const raw = await AsyncStorage.getItem(`${KEYS.PROGRESSION}_${pseudo}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[syncService] chargerProgression error:', e);
    return null;
  }
};

export const sauvegarderProgressionLocale = async (prog: ProgressionLocale): Promise<void> => {
  try {
    const data = { ...prog, derniereMaj: new Date().toISOString() };
    await AsyncStorage.setItem(`${KEYS.PROGRESSION}_${prog.pseudo}`, JSON.stringify(data));
  } catch (e) {
    console.warn('[syncService] sauvegarderProgressionLocale error:', e);
  }
};

export const sauvegarderProgression = async (prog: ProgressionLocale): Promise<StatutConnexion> => {
  await sauvegarderProgressionLocale(prog);
  // La progression est déduite des scores, pas besoin d'appel serveur
  return 'connecte';
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SCORES — file d'attente avec sync différée
// ═══════════════════════════════════════════════════════════════════════════════

const chargerFile = async (): Promise<ScoreLocal[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SCORES_FILE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const sauvegarderFile = async (file: ScoreLocal[]): Promise<void> => {
  await AsyncStorage.setItem(KEYS.SCORES_FILE, JSON.stringify(file));
};

export const enregistrerScore = async (
  scoreData: Omit<ScoreLocal, 'id' | 'synced'>
): Promise<StatutConnexion> => {
  const score: ScoreLocal = { ...scoreData, id: genId(), synced: false };

  try {
    const res = await fetchAvecTimeout(`${API_URL}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(score),
    });

    if (res.ok) {
      score.synced = true;
      await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
      const file = await chargerFile();
      await sauvegarderFile([...file, score]);
      return 'connecte';
    }
  } catch {
    // Serveur indisponible
  }

  const file = await chargerFile();
  await sauvegarderFile([...file, score]);
  return 'hors_ligne';
};

export const syncroniserScoresEnAttente = async (): Promise<{
  syncronises: number;
  enAttente:   number;
  statut:      StatutConnexion;
}> => {
  const file = await chargerFile();
  const nonSynces = file.filter(s => !s.synced);

  if (nonSynces.length === 0) return { syncronises: 0, enAttente: 0, statut: 'connecte' };

  const connecte = await verifierConnexion();
  if (!connecte) return { syncronises: 0, enAttente: nonSynces.length, statut: 'hors_ligne' };

  let syncronises = 0;
  const fileMAJ = [...file];

  for (const score of nonSynces) {
    try {
      const res = await fetchAvecTimeout(`${API_URL}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(score),
      });

      if (res.ok) {
        const idx = fileMAJ.findIndex(s => s.id === score.id);
        if (idx !== -1) fileMAJ[idx] = { ...fileMAJ[idx], synced: true };
        syncronises++;
      }
    } catch {
      break;
    }
  }

  await sauvegarderFile(fileMAJ);

  if (syncronises > 0) {
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  }

  const restants = fileMAJ.filter(s => !s.synced).length;
  return {
    syncronises,
    enAttente: restants,
    statut: restants === 0 ? 'connecte' : 'hors_ligne',
  };
};

export const getDernierSync = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.LAST_SYNC);
};

export const getNombreEnAttente = async (): Promise<number> => {
  const file = await chargerFile();
  return file.filter(s => !s.synced).length;
};