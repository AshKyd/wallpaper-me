import { round, type GeneratorInput } from './canvas.js';
import { orderBySimilarity } from './paletteUtils.js';

/** Thinnest and thickest stripe, in canvas units. */
export const STRIPE_THICKNESS: readonly [number, number] = [14, 140];
/**
 * The angles stripes can take, in degrees from horizontal: horizontal, 45 degrees one way, vertical, and 45
 * degrees the other way (135). Only these, so edges are either axis-aligned or exact diagonals.
 */
export const STRIPE_ANGLES: readonly number[] = [0, 45, 90, 135];

/** The stripes' angle for a seed: the seed modulo the number of `STRIPE_ANGLES`, so seeds 1, 2, 3, 4 give 45, 90, 135, 0. */
export const rotationFor = (seed: number) => STRIPE_ANGLES[Math.floor(Math.abs(seed)) % STRIPE_ANGLES.length]!;
/** Hairline stroke in each stripe's own colour, which hides anti-aliasing seams where stripes meet. */
const SEAM_STROKE = 0.8;

/**
 * One step along a list of `count` items, turning round at either end, so the walk goes 0 1 2 3 2 1 0 1 ...
 * (the end items are used once per pass, not twice in a row). A list of one stays put.
 */
export function stepAlong({ index, direction }: { index: number; direction: 1 | -1 }, count: number): { index: number; direction: 1 | -1 } {
	if (count < 2) return { index: 0, direction };
	const next = index + direction;
	return next < 0 || next >= count ? { index: index - direction, direction: direction === 1 ? -1 : 1 } : { index: next, direction };
}

export interface Band {
	/** Where the stripe starts, measured across the stripes from the canvas centre (negative is above). */
	start: number;
	thickness: number;
	fill: string;
}

export interface StripeLayout {
	/** Degrees from horizontal, `rotationFor(seed)`. The same for every stripe. */
	angle: number;
	/** How far the stripes reach across the canvas, along their length. */
	length: number;
	/** How far the canvas extends across the stripes, so the stripes together must be at least this thick. */
	span: number;
	/** In order from the top, each starting where the one before ends. */
	bands: Band[];
}

/**
 * Lays parallel stripes of different thickness side by side across the canvas.
 *
 * Why this is simple: every stripe shares one angle, so the problem is one-dimensional. Measure across the
 * stripes, and the canvas is a range `span` wide; the stripes are consecutive pieces of that range, each
 * starting where the last ended. They tile it exactly, with nothing to overlap or cover up. The last stripe
 * is allowed to run off the end, so every stripe keeps its full thickness.
 *
 * Thickness is spread evenly on a log scale, so there are many thin stripes and a few thick ones. Colours
 * follow the palette's prominence, and a stripe is never the same colour as the one beside it.
 */
export function layoutStripes({ colours, random, seed = 1, width, height }: Pick<GeneratorInput, 'colours' | 'random' | 'seed' | 'width' | 'height'>): StripeLayout {
	const angle = rotationFor(seed);
	const radians = (angle * Math.PI) / 180;
	// The canvas seen along the stripes' normal: its height and width, each scaled by how far they lean.
	// Both are taken as positive, as the angle can lean either way.
	const span = height * Math.abs(Math.cos(radians)) + width * Math.abs(Math.sin(radians));
	// Each stripe must reach past both sides of the canvas whatever its angle.
	const length = Math.hypot(width, height);
	const [thinnest, thickest] = STRIPE_THICKNESS;

	// Colours step along the palette in order of similarity, back and forth, so each stripe is next to the colours
	// most like it and the sequence never jumps from one end of the palette to the other.
	const ordered = orderBySimilarity(colours.map(({ hex }) => hex));
	const startDirection: 1 | -1 = random() < 0.5 ? 1 : -1;
	const startIndex = Math.floor(random() * ordered.length);

	const grow = (bands: Band[], start: number, position: { index: number; direction: 1 | -1 }): Band[] => {
		if (start >= span / 2) return bands;
		const thickness = thinnest * (thickest / thinnest) ** random();
		const fill = ordered[position.index]!;
		return grow([...bands, { start, thickness, fill }], start + thickness, stepAlong(position, ordered.length));
	};

	return { angle, length, span, bands: grow([], -span / 2, { index: startIndex, direction: startDirection }) };
}

/**
 * A backdrop, then all the stripes in one group rotated about the canvas centre. The stripes have no depth
 * layers of their own, so with parallax the whole canvas slides as one piece, like the other flat variants.
 */
export function stripesArt({ colours, random, seed, width, height }: GeneratorInput): string {
	const { angle, length, bands } = layoutStripes({ colours, random, seed, width, height });
	const [centreX, centreY] = [width / 2, height / 2];
	const stripes = bands.map(
		({ start, thickness, fill }) =>
			`<rect x="${round(centreX - length / 2)}" y="${round(centreY + start)}" width="${round(length)}" height="${round(thickness)}" fill="${fill}" stroke="${fill}" stroke-width="${SEAM_STROKE}"/>`
	);
	// Behind the stripes, only in case rounding leaves a hairline gap at an edge.
	const backdrop = `<rect width="${width}" height="${height}" fill="${colours[0]!.hex}"/>`;
	return `${backdrop}<g transform="rotate(${round(angle)} ${round(centreX)} ${round(centreY)})">${stripes.join('')}</g>`;
}
