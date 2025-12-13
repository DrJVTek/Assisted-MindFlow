/**
 * useReducedMotion Hook
 *
 * Detects user's prefers-reduced-motion accessibility setting
 * Returns true if user prefers reduced motion (disable animations)
 *
 * Example:
 * ```tsx
 * const reducedMotion = useReducedMotion();
 * return (
 *   <div className={reducedMotion ? '' : 'animate-spin'}>
 *     {children}
 *   </div>
 * );
 * ```
 */

import { useState, useEffect } from 'react';

/**
 * Hook to detect prefers-reduced-motion setting
 *
 * @returns boolean - true if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  // Server-side rendering safe: default to false (animations enabled)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for matchMedia support (not available in older browsers)
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    // Create media query matcher
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Handle changes to the setting (user changes OS preference)
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers use addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Older browsers use addListener (deprecated but still supported)
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook variant that returns animation config based on reduced motion preference
 *
 * @returns Object with animation-safe properties
 *
 * Example:
 * ```tsx
 * const animation = useAnimationConfig();
 * return (
 *   <div
 *     className={animation.className}
 *     style={{ transition: animation.transition }}
 *   >
 *     {children}
 *   </div>
 * );
 * ```
 */
export function useAnimationConfig() {
  const reducedMotion = useReducedMotion();

  return {
    // CSS class to apply
    className: reducedMotion ? 'animation-disabled' : '',

    // Transition property
    transition: reducedMotion ? 'none' : undefined,

    // Animation property
    animation: reducedMotion ? 'none' : undefined,

    // Duration (0 if reduced motion)
    duration: reducedMotion ? 0 : undefined,

    // Whether to use animations
    enabled: !reducedMotion,
  };
}
