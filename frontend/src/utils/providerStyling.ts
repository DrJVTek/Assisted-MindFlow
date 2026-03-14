/**
 * Provider color and styling utilities (Feature 011 - US4)
 *
 * Maps provider types to colors, generates contrast text,
 * and provides consistent styling for provider-related UI.
 */

import type { ProviderType } from '../types/provider';
import { PROVIDER_DEFAULT_COLORS } from '../types/provider';

/**
 * Get the display color for a provider, using user-chosen color or type default.
 */
export function getProviderColor(type: ProviderType, customColor?: string): string {
  return customColor || PROVIDER_DEFAULT_COLORS[type];
}

/**
 * Generate a contrast text color (black or white) for a given background color.
 * Uses relative luminance per WCAG guidelines.
 */
export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Relative luminance (sRGB)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Generate a subtle background color from a provider color (20% opacity).
 */
export function getProviderBgColor(color: string): string {
  return `${color}20`;
}

/**
 * Generate a border color from a provider color (40% opacity).
 */
export function getProviderBorderColor(color: string): string {
  return `${color}40`;
}
