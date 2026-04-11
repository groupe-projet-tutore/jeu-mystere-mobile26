// src/hooks/useReseau.ts
// ═══════════════════════════════════════════════════════════════════════════════
//  HOOK DE COMMUNICATION RÉSEAU — Architecture P2P avec WebSocket
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { SERVEUR_CONFIG } from '../config/serveur';
import type { Joueur } from '../types/duel.types';

// ── Types ────────────────────────────────────────────────────────────────────
export type MessageType = 
  | 'connexion'
  | 'salle_creee'
  | 'adversaire_rejoint'
  | 'duel_lance'
  | 'proposition'
  | 'proposition_adversaire'
  | 'duel_termine'
  | 'adversaire_deconnecte'
  | 'abandon'
  | 'timeout'
  | 'chat'
  | 'erreur'
  | 'creer_salle'           // ← AJOUTÉ
  | 'rejoindre_salle';      // ← AJOUTÉ

export interface MessageReseau {
  id: string;
  type: MessageType;
  donnees: any;
  timestamp: number;
  expediteur: string;
}

export type StatutConnexion = 'deconnecte' | 'connexion_serveur' | 'connexion_client' | 'connecte' | 'erreur';

// ── Configuration ────────────────────────────────────────────────────────────
const WS_URL = SERVEUR_CONFIG.WS_URL;
const MAX_TENTATIVES_RECONNEXION = 5;
const DELAI_BASE_RECONNEXION = 1000;

// ═══════════════════════════════════════════════════════════════════════════════
//  HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const useReseau = () => {
  const [statut, setStatut] = useState<StatutConnexion>('deconnecte');
  const [estHote, setEstHote] = useState<boolean>(false);
  const [monPseudo, setMonPseudo] = useState<string>('');
  const [joueurConnecte, setJoueurConnecte] = useState<Joueur | null>(null);
  const [messages, setMessages] = useState<MessageReseau[]>([]);
  const [derniereErreur, setDerniereErreur] = useState<string | null>(null);
  const [monIp, setMonIp] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const idPartieRef = useRef<string>(Date.now().toString());
  const tentativeReconnexionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compteurTentativesRef = useRef<number>(0);

  // ── Utilitaires ────────────────────────────────────────────────────────────
  const genererId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ── Nettoyage ──────────────────────────────────────────────────────────────
  const nettoyerConnexion = useCallback(() => {
    if (tentativeReconnexionRef.current) {
      clearTimeout(tentativeReconnexionRef.current);
      tentativeReconnexionRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    compteurTentativesRef.current = 0;
  }, []);

  // ── Envoi de message ───────────────────────────────────────────────────────
  const envoyer = useCallback((type: MessageType, donnees: any) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[useReseau] Tentative d\'envoi sans connexion active');
      return false;
    }
    
    const message = {
      id: genererId(),
      type,
      donnees: { ...donnees, expediteur: monPseudo, idPartie: idPartieRef.current },
      timestamp: Date.now(),
      expediteur: monPseudo,
    };
    
    wsRef.current.send(`42${JSON.stringify([type, message.donnees])}`);
    setMessages(prev => [...prev, message]);
    return true;
  }, [monPseudo]);

  // ── Traitement des messages ────────────────────────────────────────────────
  const gererMessageRecu = useCallback((raw: string) => {
    try {
      if (!raw.startsWith('4')) return;
      const json = JSON.parse(raw.slice(1));
      if (!Array.isArray(json)) return;
      
      const [type, donnees] = json as [string, any];
      
      const message: MessageReseau = {
        id: genererId(),
        type: type as MessageType,
        donnees,
        timestamp: Date.now(),
        expediteur: donnees?.expediteur ?? 'serveur',
      };
      
      setMessages(prev => [...prev, message]);
    } catch (e) {
      console.error('[useReseau] Erreur parsing message:', e);
    }
  }, []);

  // ── Établir connexion ──────────────────────────────────────────────────────
  const etablirConnexion = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}/?EIO=4&transport=websocket`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Délai de connexion dépassé'));
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        wsRef.current = ws;
        setStatut('connecte');
        setDerniereErreur(null);
        compteurTentativesRef.current = 0;
        resolve(ws);
      };
      
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Impossible de contacter le serveur'));
      };
      
      ws.onmessage = (e) => gererMessageRecu(e.data);
      
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setStatut('erreur');
      };
    });
  }, [gererMessageRecu]);

  // ── Créer une partie (hôte) ────────────────────────────────────────────────
  const creerPartie = useCallback(async (pseudo: string): Promise<string | null> => {
    if (statut !== 'deconnecte') return null;
    
    setStatut('connexion_serveur');
    setMonPseudo(pseudo);
    setEstHote(true);
    
    try {
      await etablirConnexion();
      const code = idPartieRef.current.slice(-6).toUpperCase();
      envoyer('creer_salle', { pseudo, niveau: 1 });
      return code;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setDerniereErreur(message);
      setStatut('erreur');
      return null;
    }
  }, [statut, etablirConnexion, envoyer]);

  // ── Rejoindre une partie (client) ──────────────────────────────────────────
  const rejoindrePartie = useCallback(async (code: string, pseudo: string): Promise<boolean> => {
    if (statut !== 'deconnecte') return false;
    
    setStatut('connexion_client');
    setMonPseudo(pseudo);
    setEstHote(false);
    
    try {
      await etablirConnexion();
      envoyer('rejoindre_salle', { code: code.toUpperCase(), pseudo });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setDerniereErreur(message);
      setStatut('erreur');
      return false;
    }
  }, [statut, etablirConnexion, envoyer]);

  // ── Actions publiques ──────────────────────────────────────────────────────
  const envoyerProposition = useCallback((valeur: number) => {
    envoyer('proposition', { valeur });
  }, [envoyer]);
  
  const envoyerChat = useCallback((texte: string) => {
    if (!texte.trim()) return;
    envoyer('chat', { texte });
  }, [envoyer]);
  
  const abandonnerDuel = useCallback(() => {
    envoyer('abandon', {});
    nettoyerConnexion();
    setStatut('deconnecte');
    setEstHote(false);
    setJoueurConnecte(null);
    setMessages([]);
  }, [envoyer, nettoyerConnexion]);
  
  const deconnecter = useCallback(() => {
    nettoyerConnexion();
    setStatut('deconnecte');
    setEstHote(false);
    setJoueurConnecte(null);
    setMessages([]);
    setDerniereErreur(null);
  }, [nettoyerConnexion]);

  // ── Reconnexion automatique ────────────────────────────────────────────────
  useEffect(() => {
    if (statut !== 'erreur') return;
    if (compteurTentativesRef.current >= MAX_TENTATIVES_RECONNEXION) return;
    
    compteurTentativesRef.current++;
    const delai = Math.min(
      DELAI_BASE_RECONNEXION * Math.pow(2, compteurTentativesRef.current - 1),
      30000
    );
    
    tentativeReconnexionRef.current = setTimeout(() => {
      if (monPseudo) {
        if (estHote) creerPartie(monPseudo);
        else if (joueurConnecte?.ip) rejoindrePartie(idPartieRef.current.slice(-6), monPseudo);
      }
    }, delai);
    
    return () => {
      if (tentativeReconnexionRef.current) clearTimeout(tentativeReconnexionRef.current);
    };
  }, [statut, monPseudo, estHote, joueurConnecte, creerPartie, rejoindrePartie]);

  // ── IP locale ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setMonIp(data.ip))
      .catch(() => setMonIp('192.168.1.' + Math.floor(Math.random() * 254 + 1)));
  }, []);

  useEffect(() => {
    return () => nettoyerConnexion();
  }, [nettoyerConnexion]);

  return {
    statut,
    estHote,
    estConnecte: statut === 'connecte',
    monPseudo,
    monIp,
    joueurConnecte,
    messages,
    derniereErreur,
    idPartie: idPartieRef.current.slice(-6),
    
    creerPartie,
    rejoindrePartie,
    envoyerProposition,
    envoyerChat,
    envoyerMessage: envoyer,
    abandonnerDuel,
    deconnecter,
  };
};

export default useReseau;