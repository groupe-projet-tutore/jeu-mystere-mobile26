// src/styles/theme.ts
// ═══════════════════════════════════════════════════════════
//  PALETTE LISIBILITÉ MAXIMALE — contraste WCAG AA garanti
// ═══════════════════════════════════════════════════════════
export const C = {
  // ── Fonds (du plus profond au plus clair)
  bg:         '#080c18',   // fond principal
  bgCard:     '#111827',   // cartes / surfaces
  bgCardLit:  '#1a2438',   // cartes surélevées / inputs
  bgDeep:     '#060a14',   // overlay / profondeur

  // ── Bordures
  border:     '#1e2d45',   // bordure subtile
  borderLit:  '#2e4268',   // bordure active / focus
  borderBright:'#3d5a8a',  // bordure très visible

  // ── Textes — hiérarchie claire
  textPrimary:  '#ffffff',   // titres, valeurs importantes
  textBody:     '#c8d4e8',   // corps de texte
  textSecond:   '#8899bb',   // labels, sous-titres
  textHint:     '#566880',   // placeholder, info secondaire

  // ── Or — accent principal (chaud, visible)
  gold:       '#f5a623',
  goldDark:   '#c47d0e',
  goldLight:  '#ffd166',
  goldBg:     '#1f1608',   // fond teinté or

  // ── Actions
  blue:       '#4d8af0',
  blueDark:   '#1a5fd4',
  blueBg:     '#0d1e3d',

  green:      '#2ecc7a',
  greenDark:  '#0f8a46',
  greenBg:    '#071a0f',

  red:        '#f05252',
  redDark:    '#a01515',
  redBg:      '#1a0808',

  amber:      '#fbbf24',
  amberBg:    '#1c1205',
} as const;

// ── Thèmes par niveau
export const LEVEL_THEMES: Record<number, {
  grad: [string, string]; gradBtn: [string, string];
  icon: string; glow: string; accent: string;
}> = {
  1: { grad: ['#0d2554', '#1a4fd6'], gradBtn: ['#1a4fd6', '#4d8af0'], icon: '🌱', glow: '#4d8af0', accent: '#4d8af0' },
  2: { grad: ['#240d52', '#6d28d9'], gradBtn: ['#6d28d9', '#9d5ff5'], icon: '🌿', glow: '#9d5ff5', accent: '#9d5ff5' },
  3: { grad: ['#5e0a2e', '#db2777'], gradBtn: ['#db2777', '#f472b6'], icon: '🔥', glow: '#f472b6', accent: '#f472b6' },
  4: { grad: ['#5a0a0a', '#dc2626'], gradBtn: ['#dc2626', '#f87171'], icon: '👑', glow: '#f87171', accent: '#f87171' },
};