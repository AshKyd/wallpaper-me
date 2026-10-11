import { cubicInOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

export const WIPE_DURATION = 800;

interface WipeParams {
	duration?: number;
	easing?: (t: number) => number;
}

/**
 * A circle wipe from the centre of the screen: the new wallpaper grows outwards over the old one.
 * `circle()` percentages are relative to sqrt((width² + height²) / 2), so a radius of 1/√2 (about 70.7%)
 * reaches the corners of any screen. 71% leaves a little spare so the corners are never left uncovered.
 */
const FULL_RADIUS_PERCENT = 71;

export function wipe(_node: Element, { duration = WIPE_DURATION, easing = cubicInOut }: WipeParams = {}): TransitionConfig {
	return {
		duration,
		easing,
		css: (t) => `clip-path: circle(${t * FULL_RADIUS_PERCENT}% at 50% 50%)`
	};
}

/** Keeps the outgoing element on screen, unchanged, while the incoming one wipes over it. */
export function hold(_node: Element, { duration = WIPE_DURATION }: WipeParams = {}): TransitionConfig {
	return { duration };
}
