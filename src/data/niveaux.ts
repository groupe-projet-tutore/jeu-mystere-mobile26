// src/data/niveaux.ts
import type { Niveau } from '../types/jeu';

export const NIVEAUX: Niveau[] = [
  {
    id: 1,
    nom: 'Débutant',
    min: 1,
    max: 100,
    essaisMax: 10,
    points: 1000,
    description: 'Trouvez le nombre entre 1 et 100',
    debloque: true,
  },
  {
    id: 2,
    nom: 'Confirmé',
    min: 1,
    max: 200,
    essaisMax: 8,
    points: 2000,
    description: 'Trouvez le nombre entre 1 et 200',
    debloque: false,
  },
  {
    id: 3,
    nom: 'Expert',
    min: 1,
    max: 300,
    essaisMax: 5,
    points: 3000,
    description: 'Trouvez le nombre entre 1 et 300',
    debloque: false,
  },
  {
    id: 4,
    nom: 'Maître',
    min: 1,
    max: 500,
    essaisMax: 3,
    points: 5000,
    description: 'Trouvez le nombre entre 1 et 500',
    debloque: false,
  },
];