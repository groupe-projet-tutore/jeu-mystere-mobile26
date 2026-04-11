// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, StyleSheet, BackHandler, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SplashScreen }  from './src/screens/SplashScreen';
import { PseudoScreen }  from './src/screens/PseudoScreen';
import { MenuPrincipal } from './src/screens/MenuPrincipal';
import { MondeSolo }     from './src/screens/MondeSolo';
import { MondeDuel }     from './src/screens/MondeDuel';
import { Classement }    from './src/screens/Classement';
import { Profil }        from './src/screens/Profil';
import { SyncBadge }     from './src/services/SyncBadge';
import { verifierConnexion, getNombreEnAttente, syncroniserScoresEnAttente, type StatutConnexion } from './src/services/syncService';

type Ecran = 'menu' | 'solo' | 'duel' | 'classement' | 'profil';

export default function App() {
  const [splashFini,     setSplashFini]     = useState(false);
  const [pseudo,         setPseudo]         = useState<string | null>(null);
  const [ecranActuel,    setEcranActuel]    = useState<Ecran>('menu');
  const [statutSync,     setStatutSync]     = useState<StatutConnexion>('connecte');
  const [scoresEnAttente, setScoresEnAttente] = useState<number>(0);

  // ── Synchronisation en arrière-plan ──────────────────────────────────────
  const rafraichirStatutSync = useCallback(async () => {
    const connecte = await verifierConnexion();
    const attente  = await getNombreEnAttente();
    setStatutSync(connecte ? (attente > 0 ? 'sync_en_cours' : 'connecte') : 'hors_ligne');
    setScoresEnAttente(attente);
  }, []);

  const tenterSync = useCallback(async () => {
    setStatutSync('sync_en_cours');
    const result = await syncroniserScoresEnAttente();
    setStatutSync(result.statut);
    setScoresEnAttente(result.enAttente);
  }, []);

  useEffect(() => {
    if (splashFini && pseudo) {
      rafraichirStatutSync();
      const interval = setInterval(rafraichirStatutSync, 30000);
      return () => clearInterval(interval);
    }
  }, [splashFini, pseudo, rafraichirStatutSync]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePseudoChange = (nouveauPseudo: string) => {
    setPseudo(nouveauPseudo);
  };

  const handleMenuClick = (menuId: string) => {
    const map: Record<string, Ecran> = {
      solo: 'solo', duel: 'duel', classement: 'classement', profil: 'profil',
    };
    setEcranActuel(map[menuId] ?? 'menu');
  };

  // ✅ FONCTION POUR ALLER AU CLASSEMENT
  const handleGoToClassement = () => {
    setEcranActuel('classement');
  };

  // ── Gestion du bouton retour Android ────────────────────────────────────
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ecranActuel === 'menu') {
        Alert.alert(
          'Quitter le jeu',
          'Veux-tu vraiment fermer l\'application ?',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: () => BackHandler.exitApp() },
          ]
        );
        return true;
      }
      setEcranActuel('menu');
      return true;
    });
    return () => backHandler.remove();
  }, [ecranActuel]);

  // ── Rendu principal ──────────────────────────────────────────────────────
  const renderContenu = () => {
    // 1. SPLASH
    if (!splashFini) {
      return <SplashScreen onFinish={() => setSplashFini(true)} />;
    }

    // 2. SAISIE PSEUDO
    if (!pseudo) {
      return (
        <SafeAreaView style={S.root}>
          <PseudoScreen onValidPseudo={(p) => setPseudo(p)} />
        </SafeAreaView>
      );
    }

    // 3. JEU — avec indicateur de synchronisation en overlay
    const ecran = (() => {
      switch (ecranActuel) {
        case 'menu':
          return (
            <MenuPrincipal
              onMenuClick={handleMenuClick}
              onPseudoChange={handlePseudoChange}
              pseudo={pseudo}
            />
          );
        case 'solo':
          return (
            <MondeSolo
              onRetour={() => setEcranActuel('menu')}
              pseudo={pseudo}
              onPseudoChange={handlePseudoChange}
              onGoToClassement={handleGoToClassement}  // ← AJOUTÉ
            />
          );
        case 'duel':
          return (
            <MondeDuel
              onRetour={() => setEcranActuel('menu')}
              pseudo={pseudo}
              onPseudoChange={handlePseudoChange}
            />
          );
        case 'classement':
          return (
            <Classement
              onRetour={() => setEcranActuel('menu')}
              
             
            />
          );
        case 'profil':
          return (
            <Profil
              pseudo={pseudo}
              onRetour={() => setEcranActuel('menu')}
              
            />
          );
        default:
          return null;
      }
    })();

    return (
      <SafeAreaView style={S.root}>
        {ecran}
        {/* Badge de synchronisation (en haut à droite, toujours visible) */}
        {ecranActuel !== 'menu' && (
          <SyncBadge
            statut={statutSync}
            scoresEnAttente={scoresEnAttente}
            onReessayer={tenterSync}
          />
        )}
      </SafeAreaView>
    );
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {renderContenu()}
    </SafeAreaProvider>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080c18' },
});