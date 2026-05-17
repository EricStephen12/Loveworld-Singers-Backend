/**
 * Zone Theme Utilities
 * 
 * Provides zone-aware colors and terminology for the admin interface
 */

import { isHQGroup } from '@/config/zones';

export interface ZoneTheme {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  text: string;
  textHover: string;
  border: string;
  borderHover: string;
  bg: string;
  bgHover: string;
  focusRing: string;
  focusBorder: string;
  focusBg: string;
}

/**
 * Get theme colors based on zone color
 * Converts hex color to Tailwind-compatible classes
 */
export function getZoneTheme(zoneColor?: string): ZoneTheme {
  // Default to purple if no color provided
  if (!zoneColor) {
    return {
      primary: 'bg-purple-600',
      primaryHover: 'hover:bg-purple-700',
      primaryLight: 'bg-purple-50',
      primaryDark: 'bg-purple-100',
      text: 'text-purple-600',
      textHover: 'hover:text-purple-700',
      border: 'border-purple-200',
      borderHover: 'hover:border-purple-300',
      bg: 'bg-purple-50',
      bgHover: 'hover:bg-purple-100',
      focusRing: 'focus:ring-purple-500',
      focusBorder: 'focus:border-purple-500',
      focusBg: 'focus:bg-white'
    };
  }

  // Map common zone colors to Tailwind classes
  const colorMap: Record<string, ZoneTheme> = {
    '#9333EA': { // Purple (HQ Groups)
      primary: 'bg-purple-600', primaryHover: 'hover:bg-purple-700', primaryLight: 'bg-purple-50', primaryDark: 'bg-purple-100',
      text: 'text-purple-600', textHover: 'hover:text-purple-700', border: 'border-purple-200', borderHover: 'hover:border-purple-300',
      bg: 'bg-purple-50', bgHover: 'hover:bg-purple-100', focusRing: 'focus:ring-purple-500', focusBorder: 'focus:border-purple-500', focusBg: 'focus:bg-white'
    },
    '#3B82F6': { // Blue (South Africa)
      primary: 'bg-blue-600', primaryHover: 'hover:bg-blue-700', primaryLight: 'bg-blue-50', primaryDark: 'bg-blue-100',
      text: 'text-blue-600', textHover: 'hover:text-blue-700', border: 'border-blue-200', borderHover: 'hover:border-blue-300',
      bg: 'bg-blue-50', bgHover: 'hover:bg-blue-100', focusRing: 'focus:ring-blue-500', focusBorder: 'focus:border-blue-500', focusBg: 'focus:bg-white'
    },
    '#10B981': { // Green (Nigeria)
      primary: 'bg-green-600', primaryHover: 'hover:bg-green-700', primaryLight: 'bg-green-50', primaryDark: 'bg-green-100',
      text: 'text-green-600', textHover: 'hover:text-green-700', border: 'border-green-200', borderHover: 'hover:border-green-300',
      bg: 'bg-green-50', bgHover: 'hover:bg-green-100', focusRing: 'focus:ring-green-500', focusBorder: 'focus:border-green-500', focusBg: 'focus:bg-white'
    },
    '#DC2626': { // Red (EWCA, Boss)
      primary: 'bg-red-600', primaryHover: 'hover:bg-red-700', primaryLight: 'bg-red-50', primaryDark: 'bg-red-100',
      text: 'text-red-600', textHover: 'hover:text-red-700', border: 'border-red-200', borderHover: 'hover:border-red-300',
      bg: 'bg-red-50', bgHover: 'hover:bg-red-100', focusRing: 'focus:ring-red-500', focusBorder: 'focus:border-red-500', focusBg: 'focus:bg-white'
    },
    '#F59E0B': { // Amber (India)
      primary: 'bg-amber-600', primaryHover: 'hover:bg-amber-700', primaryLight: 'bg-amber-50', primaryDark: 'bg-amber-100',
      text: 'text-amber-600', textHover: 'hover:text-amber-700', border: 'border-amber-200', borderHover: 'hover:border-amber-300',
      bg: 'bg-amber-50', bgHover: 'hover:bg-amber-100', focusRing: 'focus:ring-amber-500', focusBorder: 'focus:border-amber-500', focusBg: 'focus:bg-white'
    },
    '#EF4444': { // Red (Kenya)
      primary: 'bg-red-600', primaryHover: 'hover:bg-red-700', primaryLight: 'bg-red-50', primaryDark: 'bg-red-100',
      text: 'text-red-600', textHover: 'hover:text-red-700', border: 'border-red-200', borderHover: 'hover:border-red-300',
      bg: 'bg-red-50', bgHover: 'hover:bg-red-100', focusRing: 'focus:ring-red-500', focusBorder: 'focus:border-red-500', focusBg: 'focus:bg-white'
    },
    '#8B5CF6': { // Violet (Ghana)
      primary: 'bg-violet-600', primaryHover: 'hover:bg-violet-700', primaryLight: 'bg-violet-50', primaryDark: 'bg-violet-100',
      text: 'text-violet-600', textHover: 'hover:text-violet-700', border: 'border-violet-200', borderHover: 'hover:border-violet-300',
      bg: 'bg-violet-50', bgHover: 'hover:bg-violet-100', focusRing: 'focus:ring-violet-500', focusBorder: 'focus:border-violet-500', focusBg: 'focus:bg-white'
    },
    '#EC4899': { // Pink (USA)
      primary: 'bg-pink-600', primaryHover: 'hover:bg-pink-700', primaryLight: 'bg-pink-50', primaryDark: 'bg-pink-100',
      text: 'text-pink-600', textHover: 'hover:text-pink-700', border: 'border-pink-200', borderHover: 'hover:border-pink-300',
      bg: 'bg-pink-50', bgHover: 'hover:bg-pink-100', focusRing: 'focus:ring-pink-500', focusBorder: 'focus:border-pink-500', focusBg: 'focus:bg-white'
    },
    '#14B8A6': { // Teal (Canada)
      primary: 'bg-teal-600', primaryHover: 'hover:bg-teal-700', primaryLight: 'bg-teal-50', primaryDark: 'bg-teal-100',
      text: 'text-teal-600', textHover: 'hover:text-teal-700', border: 'border-teal-200', borderHover: 'hover:border-teal-300',
      bg: 'bg-teal-50', bgHover: 'hover:bg-teal-100', focusRing: 'focus:ring-teal-500', focusBorder: 'focus:border-teal-500', focusBg: 'focus:bg-white'
    },
    '#6366F1': { // Indigo (UK)
      primary: 'bg-indigo-600', primaryHover: 'hover:bg-indigo-700', primaryLight: 'bg-indigo-50', primaryDark: 'bg-indigo-100',
      text: 'text-indigo-600', textHover: 'hover:text-indigo-700', border: 'border-indigo-200', borderHover: 'hover:border-indigo-300',
      bg: 'bg-indigo-50', bgHover: 'hover:bg-indigo-100', focusRing: 'focus:ring-indigo-500', focusBorder: 'focus:border-indigo-500', focusBg: 'focus:bg-white'
    },
    '#F97316': { // Orange (Western Europe)
      primary: 'bg-orange-600', primaryHover: 'hover:bg-orange-700', primaryLight: 'bg-orange-50', primaryDark: 'bg-orange-100',
      text: 'text-orange-600', textHover: 'hover:text-orange-700', border: 'border-orange-200', borderHover: 'hover:border-orange-300',
      bg: 'bg-orange-50', bgHover: 'hover:bg-orange-100', focusRing: 'focus:ring-orange-500', focusBorder: 'focus:border-orange-500', focusBg: 'focus:bg-white'
    },
    '#84CC16': { // Lime (Eastern Europe)
      primary: 'bg-lime-600', primaryHover: 'hover:bg-lime-700', primaryLight: 'bg-lime-50', primaryDark: 'bg-lime-100',
      text: 'text-lime-600', textHover: 'hover:text-lime-700', border: 'border-lime-200', borderHover: 'hover:border-lime-300',
      bg: 'bg-lime-50', bgHover: 'hover:bg-lime-100', focusRing: 'focus:ring-lime-500', focusBorder: 'focus:border-lime-500', focusBg: 'focus:bg-white'
    },
    '#06B6D4': { // Cyan (East Asia)
      primary: 'bg-cyan-600', primaryHover: 'hover:bg-cyan-700', primaryLight: 'bg-cyan-50', primaryDark: 'bg-cyan-100',
      text: 'text-cyan-600', textHover: 'hover:text-cyan-700', border: 'border-cyan-200', borderHover: 'hover:border-cyan-300',
      bg: 'bg-cyan-50', bgHover: 'hover:bg-cyan-100', focusRing: 'focus:ring-cyan-500', focusBorder: 'focus:border-cyan-500', focusBg: 'focus:bg-white'
    },
    '#A855F7': { // Purple (Middle East)
      primary: 'bg-purple-600', primaryHover: 'hover:bg-purple-700', primaryLight: 'bg-purple-50', primaryDark: 'bg-purple-100',
      text: 'text-purple-600', textHover: 'hover:text-purple-700', border: 'border-purple-200', borderHover: 'hover:border-purple-300',
      bg: 'bg-purple-50', bgHover: 'hover:bg-purple-100', focusRing: 'focus:ring-purple-500', focusBorder: 'focus:border-purple-500', focusBg: 'focus:bg-white'
    },
    '#22D3EE': { // Cyan (Australia)
      primary: 'bg-cyan-600', primaryHover: 'hover:bg-cyan-700', primaryLight: 'bg-cyan-50', primaryDark: 'bg-cyan-100',
      text: 'text-cyan-600', textHover: 'hover:text-cyan-700', border: 'border-cyan-200', borderHover: 'hover:border-cyan-300',
      bg: 'bg-cyan-50', bgHover: 'hover:bg-cyan-100', focusRing: 'focus:ring-cyan-500', focusBorder: 'focus:border-cyan-500', focusBg: 'focus:bg-white'
    },
    '#FB923C': { // Orange (South America)
      primary: 'bg-orange-600', primaryHover: 'hover:bg-orange-700', primaryLight: 'bg-orange-50', primaryDark: 'bg-orange-100',
      text: 'text-orange-600', textHover: 'hover:text-orange-700', border: 'border-orange-200', borderHover: 'hover:border-orange-300',
      bg: 'bg-orange-50', bgHover: 'hover:bg-orange-100', focusRing: 'focus:ring-orange-500', focusBorder: 'focus:border-orange-500', focusBg: 'focus:bg-white'
    },
    '#059669': { // Emerald (Chad)
      primary: 'bg-emerald-600', primaryHover: 'hover:bg-emerald-700', primaryLight: 'bg-emerald-50', primaryDark: 'bg-emerald-100',
      text: 'text-emerald-600', textHover: 'hover:text-emerald-700', border: 'border-emerald-200', borderHover: 'hover:border-emerald-300',
      bg: 'bg-emerald-50', bgHover: 'hover:bg-emerald-100', focusRing: 'focus:ring-emerald-500', focusBorder: 'focus:border-emerald-500', focusBg: 'focus:bg-white'
    },
    '#7C3AED': { // Violet (Special Networks)
      primary: 'bg-violet-600', primaryHover: 'hover:bg-violet-700', primaryLight: 'bg-violet-50', primaryDark: 'bg-violet-100',
      text: 'text-violet-600', textHover: 'hover:text-violet-700', border: 'border-violet-200', borderHover: 'hover:border-violet-300',
      bg: 'bg-violet-50', bgHover: 'hover:bg-violet-100', focusRing: 'focus:ring-violet-500', focusBorder: 'focus:border-violet-500', focusBg: 'focus:bg-white'
    }
  };

  return colorMap[zoneColor] || colorMap['#9333EA']; // Default to purple
}

/**
 * Get role terminology based on zone type
 * HQ Groups use "Pastor" while regular zones use "Coordinator"
 */
export function getRoleTerminology(zoneId?: string): {
  singular: string;
  plural: string;
  title: string;
} {
  if (zoneId && isHQGroup(zoneId)) {
    return {
      singular: 'Pastor',
      plural: 'Pastors',
      title: 'HQ Pastor'
    };
  }

  return {
    singular: 'Coordinator',
    plural: 'Coordinators',
    title: 'Zone Coordinator'
  };
}

/**
 * Get full role name for display
 */
export function getFullRoleName(zoneId?: string, firstName?: string, lastName?: string): string {
  const role = getRoleTerminology(zoneId);
  const fullName = `${firstName || ''} ${lastName || ''}`.trim();
  
  if (fullName) {
    return fullName;
  }
  
  return role.title;
}
