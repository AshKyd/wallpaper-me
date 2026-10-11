import { createRandom, hashSeed } from './paletteUtils.js';

/** One shape to place in depth: its SVG markup, and its size, which stands in for distance (bigger is nearer). */
export interface DepthItem {
	markup: string;
	size: number;
}

/** Smallest and largest `DepthItem.size` a generator produces. */
export interface SizeRange {
	smallest: number;
	largest: number;
}

/** Most a shape's depth can move either way from where its size puts it (0 to 1 scale), so size still leads. */
export const DEPTH_JITTER = 0.12;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How near a shape is by its size alone, 0 (smallest, furthest) to 1 (largest, nearest). Log scale,
 * because shapes fall in size by ratios.
 */
export function depthOf(size: number, { smallest, largest }: SizeRange): number {
	if (largest <= smallest) return 0.5;
	return clamp01((Math.log(Math.max(size, smallest)) - Math.log(smallest)) / (Math.log(largest) - Math.log(smallest)));
}

/**
 * Depth, 0 (furthest) to 1 (nearest), for every item: its size on the log scale (`depthOf`), nudged
 * by up to `DEPTH_JITTER` so equal sizes are not all equally far. The nudge comes from the shape's
 * own markup (position and colours): repeatable for a seed, and it takes nothing from the
 * generator's random stream, so turning depth on does not rearrange the art.
 */
export function depthsOf(items: DepthItem[], range: SizeRange): number[] {
	return items.map(({ size, markup }) => {
		const nudge = (createRandom(hashSeed(markup))() - 0.5) * 2 * DEPTH_JITTER;
		return clamp01(depthOf(size, range) + nudge);
	});
}
