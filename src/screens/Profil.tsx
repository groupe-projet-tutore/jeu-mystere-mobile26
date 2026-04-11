import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  pseudo: string;
  onRetour: () => void;
};

export const Profil: React.FC<Props> = ({ pseudo, onRetour }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil de {pseudo}</Text>
      <Text style={styles.text}>
        Ici on mettra plus tard les statistiques, l&apos;historique des parties, les succès, etc.
      </Text>

      <TouchableOpacity style={styles.button} onPress={onRetour}>
        <Text style={styles.buttonText}>Retour au menu</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#e5e7eb',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: 180,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});