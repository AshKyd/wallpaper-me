import {
	createRandom,
	luminance,
	normalisePalette,
	pickWeighted,
	sampleRamp,
	shuffle,
	type Palette,
	type PaletteColour
} from './paletteUtils.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, round, type GeneratorInput } from './canvas.js';
import { PACKED_RADIUS_RANGE, packCircles } from './packing.js';
import { depthLayers, wholeCanvasLayer, type DepthSettings } from './depthLayers.js';
import type { DepthItem } from './depth.js';
import { flowersArt } from './flowers/flowersArt.js';
import { bandsArt } from './bands.js';
import { checkerboardArt } from './checkerboard.js';
import { hexagonsArt } from './hexagons.js';
import { bokehArt } from './bokeh.js';
import { mondrianArt } from './mondrian.js';
import { stripesArt } from './stripes.js';
import { midcenturyArt } from './midcentury.js';
import { eightiesArt } from './eighties.js';
import { neonArt } from './neon.js';
import { applyTone, type PaletteTone } from './tones.js';

export { CANVAS_HEIGHT, CANVAS_WIDTH, canvasSizeFor, type GeneratorInput } from './canvas.js';
export type { DepthSettings } from './depthLayers.js';

export const PALETTE_VARIANTS = ['circles', 'triangles', 'diamonds', 'bands', 'flowers', 'checkerboard', 'hexagons', 'bokeh', 'mondrian', 'stripes', 'midcentury', '80s', 'neon'] as const;
export type PaletteVariant = (typeof PALETTE_VARIANTS)[number];

/** Variants made of sized shapes, which split into depth layers for parallax. The rest move as one piece. */
const DEPTH_VARIANTS: readonly PaletteVariant[] = ['circles', 'flowers', 'bokeh', '80s'];

/** Colours other than the base, falling back to the base for one-colour palettes. */
function accentsOf(colours: PaletteColour[]): PaletteColour[] {
	return colours.length > 1 ? colours.slice(1) : colours;
}

/** Dark to light, so ramps and gradients flow smoothly rather than jumping hue to hue. */
function rampOf(colours: PaletteColour[]): string[] {
	return colours.map(({ hex }) => hex).sort((a, b) => luminance(a) - luminance(b));
}

/* ------------------------------------------------------------------ */
/* Circles                                                             */
/* ------------------------------------------------------------------ */

function circlesArt({ colours, random, width, height, depth }: GeneratorInput): string {
	const base = colours[0]!.hex;
	const accents = accentsOf(colours);
	const circles = packCircles({ random, width, height }).map(({ x, y, radius }): DepthItem => {
		const colour = pickWeighted(accents, random);
		const cx = round(x);
		const cy = round(y);
		const style = radius < 22 ? 'solid' : random() < 0.55 ? 'solid' : random() < 0.5 ? 'ring' : 'target';
		if (style === 'solid') return { size: radius, markup: `<circle cx="${cx}" cy="${cy}" r="${round(radius)}" fill="${colour}"/>` };
		if (style === 'ring')
			return {
				size: radius,
				markup: `<circle cx="${cx}" cy="${cy}" r="${round(radius * 0.88)}" fill="none" stroke="${colour}" stroke-width="${round(radius * 0.2)}"/>`
			};
		// Target: the inner discs use other palette colours for depth.
		const inner = pickWeighted(accents, random);
		const core = pickWeighted(accents, random);
		return {
			size: radius,
			markup: [
				`<circle cx="${cx}" cy="${cy}" r="${round(radius)}" fill="${colour}"/>`,
				`<circle cx="${cx}" cy="${cy}" r="${round(radius * 0.62)}" fill="${inner}"/>`,
				`<circle cx="${cx}" cy="${cy}" r="${round(radius * 0.26)}" fill="${core}"/>`
			].join('')
		};
	});
	const layers = depthLayers({ items: circles, range: PACKED_RADIUS_RANGE, settings: depth });
	return `<rect width="${width}" height="${height}" fill="${base}"/>${layers}`;
}

/* ------------------------------------------------------------------ */
/* Triangles                                                           */
/* ------------------------------------------------------------------ */

/**
 * Low-poly mesh: a jittered grid split into triangles, coloured by sweeping a palette ramp
 * across the canvas at a random angle. Per-triangle noise keeps facets distinct.
 */
function trianglesArt({ colours, random, width, height }: GeneratorInput): string {
	const ramp = rampOf(colours);
	// Fixed cell size, so wider canvases show more facets rather than bigger ones.
	const cellWidth = 92;
	const columns = Math.ceil(width / cellWidth);
	const cellHeight = cellWidth * 0.87;
	const rows = Math.ceil(height / cellHeight) + 1;
	const jitter = 0.34;
	const angle = random() * Math.PI * 2;
	// Reverse half the time so the dark end isn't always top-left.
	const direction = random() < 0.5 ? 1 : -1;

	// Grid runs one cell past each edge so jitter never exposes the background.
	const points = Array.from({ length: rows + 2 }, (_, row) =>
		Array.from({ length: columns + 3 }, (_, column) => ({
			x: (column - 1) * cellWidth + (row % 2 ? cellWidth / 2 : 0) + (random() - 0.5) * cellWidth * jitter * 2,
			y: (row - 1) * cellHeight + (random() - 0.5) * cellHeight * jitter * 2
		}))
	);

	const colourAt = (x: number, y: number) => {
		const sweep = (x / width - 0.5) * Math.cos(angle) + (y / height - 0.5) * Math.sin(angle);
		const position = 0.5 + direction * sweep * 0.95 + (random() - 0.5) * 0.28;
		return sampleRamp(ramp, position);
	};

	const triangles = points.slice(0, -1).flatMap((rowPoints, row) =>
		rowPoints.slice(0, -1).flatMap((topLeft, column) => {
			const topRight = rowPoints[column + 1]!;
			const bottomLeft = points[row + 1]![column]!;
			const bottomRight = points[row + 1]![column + 1]!;
			// Odd rows are shifted half a cell, so the shared diagonal flips to stay seamless.
			const halves =
				row % 2
					? [
							[topLeft, topRight, bottomRight],
							[topLeft, bottomRight, bottomLeft]
						]
					: [
							[topLeft, topRight, bottomLeft],
							[topRight, bottomRight, bottomLeft]
						];
			return halves.map((corners) => {
				const centreX = corners.reduce((sum, { x }) => sum + x, 0) / 3;
				const centreY = corners.reduce((sum, { y }) => sum + y, 0) / 3;
				const fill = colourAt(centreX, centreY);
				const path = corners.map(({ x, y }) => `${round(x)},${round(y)}`).join(' ');
				// A same-colour hairline stroke hides anti-aliasing seams between facets.
				return `<polygon points="${path}" fill="${fill}" stroke="${fill}" stroke-width="0.8" stroke-linejoin="round"/>`;
			});
		})
	);
	return `<rect width="${width}" height="${height}" fill="${ramp[0]}"/>${triangles.join('')}`;
}

/* ------------------------------------------------------------------ */
/* Diamonds                                                            */
/* ------------------------------------------------------------------ */

/**
 * Harlequin lattice: diamonds tile the canvas exactly and are coloured by a fixed rule, not
 * by chance, so the pattern reads as deliberate. Colour steps along both diagonals through a
 * shuffled deck; every second row and column also gets a small inset diamond for rhythm.
 */
function diamondsArt({ colours, random, width, height }: GeneratorInput): string {
	const base = colours[0]!.hex;
	const deck = shuffle(colours, random).map(({ hex }) => hex);
	const tileWidth = [96, 120, 150][Math.floor(random() * 3)]!;
	const tileHeight = tileWidth * (random() < 0.5 ? 1.2 : 1.7);
	// Steps per diagonal; (1,1) is classic harlequin, the others give wider stripes.
	const [stepAcross, stepDown] = [
		[1, 1],
		[1, 2],
		[2, 1]
	][Math.floor(random() * 3)]!;
	const offset = Math.floor(random() * deck.length);
	const halfWidth = tileWidth / 2;
	const halfHeight = tileHeight / 2;

	// Centres sit on a half-step grid; only cells where column + row is even hold a diamond.
	const columns = Math.ceil(width / halfWidth) + 2;
	const rows = Math.ceil(height / halfHeight) + 2;
	const diamond = (x: number, y: number, scale: number) =>
		[
			[x - halfWidth * scale, y],
			[x, y - halfHeight * scale],
			[x + halfWidth * scale, y],
			[x, y + halfHeight * scale]
		]
			.map(([pointX, pointY]) => `${round(pointX!)},${round(pointY!)}`)
			.join(' ');

	const tiles = Array.from({ length: rows }, (_, row) => row - 1).flatMap((row) =>
		Array.from({ length: columns }, (_, column) => column - 1)
			.filter((column) => (column + row) % 2 === 0)
			.map((column) => {
				const x = column * halfWidth;
				const y = row * halfHeight;
				const along = (column - row) / 2;
				const down = (column + row) / 2;
				const index = (((stepAcross * along + stepDown * down + offset) % deck.length) + deck.length) % deck.length;
				// A same-colour hairline stroke hides anti-aliasing seams between tiles.
				const tile = `<polygon points="${diamond(x, y, 1)}" fill="${deck[index]}" stroke="${deck[index]}" stroke-width="0.8" stroke-linejoin="miter"/>`;
				if (column % 2 !== 0 || row % 2 !== 0) return tile;
				return `${tile}<polygon points="${diamond(x, y, 0.46)}" fill="${deck[(index + 2) % deck.length]}"/>`;
			})
	);
	return `<rect width="${width}" height="${height}" fill="${base}"/>${tiles.join('')}`;
}

/* ------------------------------------------------------------------ */

const GENERATORS: Record<PaletteVariant, (input: GeneratorInput) => string> = {
	circles: circlesArt,
	triangles: trianglesArt,
	diamonds: diamondsArt,
	bands: ({ colours, random, width, height }) => bandsArt({ ramp: rampOf(colours), random, width, height }),
	flowers: flowersArt,
	checkerboard: checkerboardArt,
	hexagons: hexagonsArt,
	bokeh: bokehArt,
	mondrian: mondrianArt,
	stripes: stripesArt,
	midcentury: midcenturyArt,
	'80s': eightiesArt,
	neon: neonArt
};

/**
 * Builds the inner SVG markup (for a `0 0 width height` viewBox) for a palette.
 * The same palette, variant, seed and size always produce the same artwork.
 */
export function generatePaletteArt({
	palette,
	variant,
	seed = 1,
	idPrefix = 'palette',
	width = CANVAS_WIDTH,
	height = CANVAS_HEIGHT,
	gap = 0,
	depth,
	tone = 'original'
}: {
	palette: Palette;
	variant: PaletteVariant;
	seed?: number;
	idPrefix?: string;
	/** Canvas size; use `canvasSizeFor()` to match a container's aspect ratio. */
	width?: number;
	height?: number;
	/** Borders between shapes, as a share of shape size (0 to 0.4). Used by `hexagons`. */
	gap?: number;
	/** Parallax: `circles`, `flowers`, `bokeh` and `80s` split into depth layers, other variants slide as one piece. */
	depth?: DepthSettings;
	/** Recolours the finished art (softer, darker). The layout is the same in every tone. */
	tone?: PaletteTone;
}): string {
	const original = GENERATORS[variant]({ colours: normalisePalette(palette), random: createRandom(seed), seed, idPrefix, width, height, gap, depth });
	const art = applyTone(original, palette, tone);
	// Variants without their own depth layers slide as one piece when parallax is on.
	return depth?.parallaxPoint === undefined || DEPTH_VARIANTS.includes(variant) ? art : wholeCanvasLayer(art);
}
