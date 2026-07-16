export const colors = {
  canvas: '#0D0B0B',
  surface: '#171414',
  raised: '#201B1B',
  border: 'rgba(255,247,243,0.10)',
  text: '#FFF7F3',
  secondary: '#B9AEAA',
  muted: '#807672',
  coral: '#FF5A6B',
  mint: '#66DDB1',
  amber: '#FFB454',
  violet: '#A98BFF',
  danger: '#FF5B52',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  huge: 40,
} as const;
export const radius = { card: 16, control: 12, pill: 999 } as const;

export const type = {
  display: {
    fontFamily: 'Bricolage Grotesque',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '700' as const,
  },
  h1: {
    fontFamily: 'Bricolage Grotesque',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700' as const,
  },
  section: {
    fontFamily: 'Bricolage Grotesque',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
  },
  card: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700' as const,
  },
  body: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  support: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  micro: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
} as const;
