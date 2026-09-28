# 🎮 Jeu Mystère - Application Mobile

**Projet Tutoré - Licence Informatique - Université de Djibouti (2025/2026)**

Une version moderne et connectée du célèbre jeu du "Nombre Mystère", transformée en une application mobile compétitive avec mode Solo et mode Duel en temps réel.

---

## 📖 Table des matières
- [À propos du projet](#à-propos-du-projet)
- [Fonctionnalités principales](#fonctionnalités-principales)
- [Architecture technique](#architecture-technique)
- [Technologies utilisées](#technologies-utilisées)
- [Installation et lancement](#installation-et-lancement)
- [Structure du projet](#structure-du-projet)
- [Équipe du projet](#équipe-du-projet)
- [Perspectives d'évolution](#perspectives-dévolution)

---

## 🎯 À propos du projet

Ce projet est la finalisation d'un travail existant (un jeu du "Nombre Mystère" en langage C avec interface en ligne de commande). Notre mission était de le réinventer en une **application mobile moderne, fluide et compétitive**.

Le jeu repose sur un principe simple : deviner un nombre généré aléatoirement grâce à des indices "plus" ou "moins". Nous l'avons enrichi avec :
- **4 niveaux de difficulté croissante** (Débutant, Confirmé, Expert, Maître).
- **Un mode Duel en temps réel** permettant à deux joueurs de s'affronter sur un réseau local.
- **Un système de classement** global et par niveau.
- **Une architecture client-serveur complète** (API REST + WebSocket).

Ce projet a été réalisé dans un cadre académique simulant un environnement professionnel, avec une collaboration étroite entre une **équipe programmation** (développement mobile) et une **équipe réseau** (infrastructure serveur).

---

## ✨ Fonctionnalités principales

### Mode Solo
- **4 niveaux de difficulté** : 
  - Niveau 1 (Débutant) : Intervalle 1-100, 10 essais, 1000 pts
  - Niveau 2 (Confirmé) : Intervalle 1-200, 8 essais, 2000 pts
  - Niveau 3 (Expert) : Intervalle 1-300, 5 essais, 3000 pts
  - Niveau 4 (Maître) : Intervalle 1-500, 3 essais, 5000 pts
- **Timer de 30 secondes** par proposition.
- **Progression déblocable** : Le niveau suivant s'ouvre après une victoire.
- **Sauvegarde locale** (AsyncStorage) pour jouer hors ligne.

### Mode Duel (Temps réel)
- **Affrontement 1 contre 1** sur un réseau local.
- **Création/Rejoint une salle** avec un code à 6 caractères.
- **Synchronisation en temps réel** via WebSocket (Socket.IO).
- **4 manches** correspondant aux 4 niveaux.
- **Gestion des abandons et déconnexions** (notifications en temps réel).
- **Chat intégré** pour communiquer avec l'adversaire.

### Classements
- **Classement Solo** : Trié par points totaux, puis meilleur essai, puis pseudo.
- **Classement Duel** : Trié par victoires, puis défaites, puis pseudo.
- **Classement par niveau** en mode Duel.

### Profil Joueur
- Statistiques détaillées (parties jouées, victoires, ratio).
- Historique des parties.
- Système de succès et badges.

---

## 🏗️ Architecture technique

L'application repose sur une **architecture client-serveur hybride** :

- **Client mobile** : React Native (Expo) pour iOS et Android.
- **Communication** :
  - **API REST (HTTP)** : Pour les opérations stateless (classements, profils, sauvegarde des scores).
  - **WebSocket (Socket.IO)** : Pour la communication temps réel en mode Duel.
- **Serveur** : Node.js avec Socket.IO, déployé sur un serveur Ubuntu.
- **Base de données** : SQLite (fichier local, 7 tables relationnelles).

### Flux de communication
1.  Le client se connecte au serveur via WebSocket.
2.  En mode Solo, les scores sont envoyés via API REST.
3.  En mode Duel, les propositions et les états de jeu sont échangés en temps réel via WebSocket.
4.  En cas d'indisponibilité du serveur, les données sont stockées localement (AsyncStorage) et synchronisées plus tard.

---

## 🛠️ Technologies utilisées

| Composant | Technologie | Raison du choix |
| :--- | :--- | :--- |
| **Framework mobile** | React Native + Expo | Multiplateforme (iOS/Android), hot reload, écosystème riche |
| **Langage** | TypeScript | Typage fort, fiabilité, maintenabilité |
| **Temps réel** | Socket.IO (WebSocket) | Communication bidirectionnelle, faible latence |
| **Backend** | Node.js + Flask (Python) | API REST et gestion des WebSockets |
| **Base de données** | SQLite | Légère, incluse, suffisante pour les scores |
| **Serveur** | Ubuntu Server | Stable, gratuit, adapté au déploiement |
| **Reverse Proxy** | Nginx | Gestion des requêtes HTTP et WebSocket |

---

## 🚀 Installation et lancement

### Prérequis
- Node.js (v18 ou supérieur)
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)

### Installation
```bash
# Cloner le dépôt
git clone https://github.com/hamze-idriss-guelleh/Jeu_mystere.git
cd Jeu_mystere

# Installer les dépendances
npm install

# Lancer l'application
npx expo start
