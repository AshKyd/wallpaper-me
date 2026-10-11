import { CANVAS_HEIGHT, CANVAS_WIDTH } from './canvas.js';
import { randomBetween } from './paletteUtils.js';

export interface PlacedCircle {
	x: number;
	y: number;
	radius: number;
}

/** Radii `packCircles` produces by default: `minRadius` up to `minRadius + maxRadius`. */
export const PACKED_RADIUS_RANGE = { smallest: 12, largest: 12 + 210 } as const;

interface PackOptions {
	random: () => number;
	/** Canvas size to pack. */
	width: number;
	height: number;
	/** Tries for a 1200x800 canvas; scaled by area so density stays the same at other sizes. */
	attempts?: number;
	/** Minimum space between circles. */
	gap?: number;
	minRadius?: number;
	maxRadius?: number;
	/** Areas already taken (e.g. flowers); circles avoid them but they are not returned. */
	obstacles?: PlacedCircle[];
}

/**
 * Packs non-touching circles, largest first, so big shapes anchor the layout and small
 * ones fill the gaps. Circles may spill over the edges so the pattern feels cropped, not framed.
 */
export function packCircles({
	random,
	width,
	height,
	attempts: baseAttempts = 1800,
	gap = 7,
	minRadius = PACKED_RADIUS_RANGE.smallest,
	maxRadius = PACKED_RADIUS_RANGE.largest - PACKED_RADIUS_RANGE.smallest,
	obstacles = []
}: PackOptions): PlacedCircle[] {
	const attempts = Math.round((baseAttempts * width * height) / (CANVAS_WIDTH * CANVAS_HEIGHT));
	const fits = (taken: PlacedCircle[], candidate: PlacedCircle) =>
		!taken.some((other) => Math.hypot(other.x - candidate.x, other.y - candidate.y) < other.radius + candidate.radius + gap);

	return Array.from({ length: attempts }).reduce<PlacedCircle[]>((placed, _, attempt) => {
		const progress = attempt / attempts;
		const candidate = {
			radius: minRadius + maxRadius * (1 - progress) ** 2.4 * (0.6 + random() * 0.4),
			x: randomBetween(random, -40, width + 40),
			y: randomBetween(random, -40, height + 40)
		};
		return fits(placed, candidate) && fits(obstacles, candidate) ? [...placed, candidate] : placed;
	}, []);
}
