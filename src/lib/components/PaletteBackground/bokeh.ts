import { round, type GeneratorInput } from './canvas.js';
import { depthLayers } from './depthLayers.js';
import type { DepthItem } from './depth.js';
import { luminance, mixHex, randomBetween } from './paletteUtils.js';

/** Radii of the bokeh discs, in canvas units. Also the size range used to put them in depth for parallax. */
export const BOKEH_RADIUS_RANGE = { smallest: 14, largest: 150 } as const;

/** Gaussian blur (canvas units) from the smallest discs to the largest. Bigger discs are further out of focus, so softer. */
const BLUR_LEVELS = [2, 4, 7, 11] as const;

/** Discs drawn for a 1200x800 canvas; scaled by area so density stays the same at other sizes. */
const BASE_DISC_COUNT = 40;

/** Most colours (from the dark end) that form the background gradient. */
const MAX_BACKGROUND_COLOURS = 2;

/**
 * Splits the palette into the darkest colours, which become the background, and the rest, which
 * become the bokeh. Darkest-first keeps the lights glowing against a deep ground. A palette is
 * only split when it has enough colours to leave at least two for the lights; otherwise the
 * background takes one colour and the lights take the rest, or tints of the one colour there is.
 */
export function splitBokehColours(hexes: string[]): { background: string[]; lights: string[] } {
	const darkToLight = [...hexes].sort((a, b) => luminance(a) - luminance(b));
	const backgroundCount = darkToLight.length >= MAX_BACKGROUND_COLOURS + 2 ? MAX_BACKGROUND_COLOURS : 1;
	const background = darkToLight.slice(0, backgroundCount);
	const lights = darkToLight.slice(backgroundCount);
	// A one-colour palette has no lights left, so tint the colour for them.
	return { background, lights: lights.length ? lights : [mixHex(background[0]!, '#ffffff', 0.55), mixHex(background[0]!, '#ffffff', 0.8)] };
}

/**
 * Soft out-of-focus lights over a dark gradient. The darkest colours make the background; every
 * other colour becomes a blurred disc with a top-to-bottom gradient fill and a gradient stroke,
 * drawn translucent so overlapping discs blend. The gradients are defined once and shared, and live outside the depth layers so parallax
 * (which draws each layer in its own `<svg>`) still finds them.
 */
export function bokehArt(input: GeneratorInput): string {
	const { colours, idPrefix, width, height } = input;
	const { background, lights } = splitBokehColours(colours.map(({ hex }) => hex));

	/* Background */
	const backgroundId = `${idPrefix}-bokeh-ground`;
	const [groundFrom, groundTo = mixHex(groundFrom!, '#000000', 0.45)] = background;
	const backgroundDefs = `<linearGradient id="${backgroundId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="${height}"><stop offset="0" stop-color="${groundFrom}"/><stop offset="1" stop-color="${groundTo}"/></linearGradient>`;

	const { defs, items } = bokehLights({ ...input, lights });
	const layers = depthLayers({ items, range: BOKEH_RADIUS_RANGE, settings: input.depth });
	return `<defs>${backgroundDefs}${defs}</defs><rect width="${width}" height="${height}" fill="url(#${backgroundId})"/>${layers}`;
}

/**
 * The blurred discs of `bokehArt` without its background, so another variant can lay them over its own
 * ground. `defs` goes inside `<defs>`; `items` are the discs for `depthLayers()` over `BOKEH_RADIUS_RANGE`,
 * so the caller can add its own items to the same depth.
 */
export function bokehLights({ lights, random, idPrefix, width, height }: Pick<GeneratorInput, 'random' | 'idPrefix' | 'width' | 'height'> & { lights: string[] }): {
	defs: string;
	items: DepthItem[];
} {
	/* Gradients shared by the discs */
	const fillId = (index: number) => `${idPrefix}-bokeh-fill-${index}`;
	const strokeId = (index: number) => `${idPrefix}-bokeh-stroke-${index}`;
	const lightDefs = lights.flatMap((light, index) => {
		const neighbour = lights[(index + 1) % lights.length]!;
		return [
			// Fill: top to bottom, a faint tint fading into the full colour.
			`<linearGradient id="${fillId(index)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mixHex(light, '#ffffff', 0.25)}" stop-opacity="0.2"/><stop offset="1" stop-color="${light}" stop-opacity="0.9"/></linearGradient>`,
			// Stroke: this colour fading into the next, lightened so the rim catches the eye.
			`<linearGradient id="${strokeId(index)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mixHex(light, '#ffffff', 0.5)}"/><stop offset="1" stop-color="${neighbour}"/></linearGradient>`
		];
	});

	/* Blur: a few shared filters, picked by disc size, so large (far) discs are softer than small ones */
	const blurId = (index: number) => `${idPrefix}-bokeh-blur-${index}`;
	const blurDefs = BLUR_LEVELS.map(
		(deviation, index) =>
			`<filter id="${blurId(index)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${deviation}"/></filter>`
	);

	/* Discs */
	const discCount = Math.round((BASE_DISC_COUNT * width * height) / (1200 * 800));
	const { smallest, largest } = BOKEH_RADIUS_RANGE;
	const items = Array.from({ length: discCount }, (): DepthItem => {
		// Squared so most discs are small and a few are large.
		const radius = smallest + (largest - smallest) * random() ** 2.2;
		const index = Math.floor(random() * lights.length);
		const cx = round(randomBetween(random, -radius * 0.3, width + radius * 0.3));
		const cy = round(randomBetween(random, -radius * 0.3, height + radius * 0.3));
		const opacity = round(randomBetween(random, 0.35, 0.85) * 100) / 100;
		const strokeWidth = round(Math.max(1, radius * randomBetween(random, 0.03, 0.08)));
		const blurIndex = Math.min(BLUR_LEVELS.length - 1, Math.floor(((radius - smallest) / (largest - smallest)) * BLUR_LEVELS.length * 1.6));
		return {
			// Depth runs opposite to circles: the biggest, softest lights are the furthest away (as in a real lens),
			// so the size handed to the depth maths is flipped within the range and small, sharper discs are nearest.
			size: smallest + largest - radius,
			markup: `<circle cx="${cx}" cy="${cy}" r="${round(radius)}" fill="url(#${fillId(index)})" stroke="url(#${strokeId(index)})" stroke-width="${strokeWidth}" opacity="${opacity}" filter="url(#${blurId(blurIndex)})"/>`
		};
	});

	return {
		defs: `${lightDefs.join('')}${blurDefs.join('')}`,
		items
	};
}
