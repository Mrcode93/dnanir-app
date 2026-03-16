/**
 * Design System Tokens
 * Single source of truth for spacing, radii, typography, and button sizing.
 * Use these instead of raw numbers across the entire app.
 */
import { Platform } from 'react-native';

// ─── Spacing ────────────────────────────────────────────────────────────────
// Android renders at a slightly larger visual scale than iOS, so we apply a
// small reduction to keep both platforms visually consistent.
const isAndroid = Platform.OS === 'android';

export const SPACING = {
  xs: 4,
  sm: isAndroid ? 6 : 8,
  md: isAndroid ? 12 : 16,
  lg: isAndroid ? 18 : 24,
  xl: isAndroid ? 24 : 32,
  xxl: isAndroid ? 36 : 48,
  /** Horizontal screen gutter used in all screens */
  screenH: isAndroid ? 16 : 20,
  /** Minimum touch target size per platform guidelines */
  touchMin: isAndroid ? 48 : 44,
};

// ─── Border Radius ───────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  /** Bottom sheets and centered dialogs */
  xxl: 24,
  round: 9999,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
export const FONT_SIZE = {
  xs: 12,       // caption, badge, tiny label
  sm: 14,       // secondary text, helper text
  md: 16,       // body, input fields
  lg: 18,       // section titles, list items
  xl: 20,       // card titles
  xxl: 24,      // screen titles
  display: 40,  // hero numbers (balance, large amounts)
} as const;

export const FONT_FAMILY = {
  regular: 'DINNext-Regular',
  medium: 'DINNext-Medium',
} as const;

// ─── Buttons ─────────────────────────────────────────────────────────────────
export const BUTTON = {
  heightSm: 40,
  heightMd: 52,   // default — all primary actions
  heightLg: 56,
  radiusSm: RADIUS.md,
  radiusMd: RADIUS.xl,
  radiusLg: RADIUS.xxl,
} as const;

// ─── Modals ──────────────────────────────────────────────────────────────────
export const MODAL = {
  /** Top radius for all bottom-sheet modals */
  sheetRadius: RADIUS.xxl,
  /** Border radius for centered dialog boxes */
  dialogRadius: RADIUS.xxl,
  handleWidth: 40,
  handleHeight: 4,
  handleRadius: 2,
} as const;
