export type Indice = 'plus' | 'moins' | 'egal';

export type StatutPartie = 'en_cours' | 'victoire' | 'defaite';

export type Niveau = {
  id: number;
  nom: string;
  min: number;
  max: number;
  essaisMax: number;
  points: number;
  description: string;
  debloque: boolean;
};

export type Proposition = {
  valeur: number;
  indice: Indice | null;
  timestamp: Date;
};

export type PartieEnCours = {
  niveau: Niveau;
  nombreMystere: number;
  essaisRestants: number;
  propositions: Proposition[];
  statut: StatutPartie;
};