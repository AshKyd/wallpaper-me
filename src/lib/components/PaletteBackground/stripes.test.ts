import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { canvasSizeFor } from './canvas.js';
import { splitLayers } from './depthLayers.js';
import { generatePaletteArt } from './generators.js';
import { createRandom, normalisePalette, orderBySimilarity, type Palette } from './paletteUtils.js';
import { STRIPE_ANGLES, STRIPE_THICKNESS, layoutStripes, rotationFor, stepAlong } from './stripes.js';

const palettes = paletteData as Palette[];
const { width, height } = canvasSizeFor(1600, 900);
const colours = normalisePalette(palettes[0]!);
const layoutFor = (seed: number, size = { width, height }) => layoutStripes({ colours, random: createRandom(seed), seed, ...size });
const seeds = [1, 2, 3, 4, 5, 6];

describe('stripes layout', () => {
	it('is horizontal, vertical or 45 degrees either way, by the seed', () => {
		expect([...STRIPE_ANGLES].sort((a, b) => a - b)).toEqual([0, 45, 90, 135]);
		[1, 2, 3, 4, 5, 45, 90, 179, 180, 181, 360, 999_999].forEach((seed) => {
			expect(layoutFor(seed).angle).toBe(STRIPE_ANGLES[seed % STRIPE_ANGLES.length]);
			expect(rotationFor(seed)).toBe(STRIPE_ANGLES[seed % STRIPE_ANGLES.length]);
		});
		// Four seeds in a row give all four angles.
		expect(new Set([1, 2, 3, 4].map((seed) => layoutFor(seed).angle)).size).toBe(4);
	});

	it('covers the canvas at every angle, because the span follows the angle', () => {
		const layouts = STRIPE_ANGLES.map((_, index) => layoutFor(index + 1));
		layouts.forEach(({ angle, span }) => {
			const radians = (angle * Math.PI) / 180;
			expect(span).toBeCloseTo(height * Math.abs(Math.cos(radians)) + width * Math.abs(Math.sin(radians)), 6);
			// However it leans, the span is never less than the canvas's shorter side.
			expect(span).toBeGreaterThanOrEqual(Math.min(width, height) - 0.001);
		});
	});

	it('tiles the canvas: stripes meet end to end and reach both sides', () => {
		seeds.forEach((seed) => {
			const { bands, span } = layoutFor(seed);
			expect(bands[0]!.start).toBeCloseTo(-span / 2, 6);
			bands.slice(1).forEach((band, index) => {
				const before = bands[index]!;
				expect(band.start).toBeCloseTo(before.start + before.thickness, 6);
			});
			const last = bands.at(-1)!;
			expect(last.start + last.thickness).toBeGreaterThanOrEqual(span / 2);
			// The last stripe is the only one that runs off the end; the one before it stops short.
			expect(bands.at(-2)!.start + bands.at(-2)!.thickness).toBeLessThan(span / 2);
		});
	});

	it('keeps every thickness within range, with a good spread', () => {
		const thicknesses = seeds.flatMap((seed) => layoutFor(seed).bands.map(({ thickness }) => thickness));
		thicknesses.forEach((thickness) => {
			expect(thickness).toBeGreaterThanOrEqual(STRIPE_THICKNESS[0] - 0.001);
			expect(thickness).toBeLessThanOrEqual(STRIPE_THICKNESS[1] + 0.001);
		});
		expect(Math.max(...thicknesses) / Math.min(...thicknesses)).toBeGreaterThan(4);
	});

	it('never puts the same colour beside itself', () => {
		seeds.forEach((seed) => {
			const fills = layoutFor(seed).bands.map(({ fill }) => fill);
			fills.slice(1).forEach((fill, index) => expect(fill).not.toBe(fills[index]));
		});
	});

	it('steps through the colours in order of similarity, back and forth', () => {
		const ordered = orderBySimilarity(colours.map(({ hex }) => hex));
		seeds.forEach((seed) => {
			const positions = layoutFor(seed).bands.map(({ fill }) => ordered.indexOf(fill));
			positions.forEach((position) => expect(position).toBeGreaterThanOrEqual(0));
			// Each stripe is next to its neighbour in the similarity order, never a jump across the palette.
			positions.slice(1).forEach((position, index) => expect(Math.abs(position - positions[index]!)).toBe(1));
		});
	});

	it('uses every colour in the palette', () => {
		const used = new Set(layoutFor(1).bands.map(({ fill }) => fill));
		expect(used.size).toBe(new Set(colours.map(({ hex }) => hex)).size);
	});

	it('reaches across the canvas whatever the angle', () => {
		seeds.forEach((seed) => expect(layoutFor(seed).length).toBeGreaterThanOrEqual(Math.hypot(width, height) - 0.001));
	});

	it('keeps the stripe sizes the same on a bigger canvas, with more stripes', () => {
		const small = layoutFor(1).bands.length;
		const large = layoutFor(1, { width: width * 2, height: height * 2 }).bands.length;
		expect(large).toBeGreaterThan(small);
	});

	it('repeats for a seed and differs between seeds', () => {
		expect(layoutFor(1)).toEqual(layoutFor(1));
		expect(layoutFor(1)).not.toEqual(layoutFor(2));
	});
});

describe('stepAlong', () => {
	const walk = (count: number, steps: number) =>
		Array.from({ length: steps }).reduce<{ index: number; direction: 1 | -1 }[]>(
			(path) => [...path, stepAlong(path.at(-1)!, count)],
			[{ index: 0, direction: 1 }]
		).map(({ index }) => index);

	it('turns round at each end without repeating the end item', () => {
		expect(walk(4, 9)).toEqual([0, 1, 2, 3, 2, 1, 0, 1, 2, 3]);
	});

	it('alternates for two items and stays put for one', () => {
		expect(walk(2, 4)).toEqual([0, 1, 0, 1, 0]);
		expect(walk(1, 3)).toEqual([0, 0, 0, 0]);
	});
});

describe('orderBySimilarity', () => {
	it('puts alike colours side by side', () => {
		const ordered = orderBySimilarity(['#ff0000', '#0000ff', '#ff5050', '#5050ff']);
		const gap = (first: string, second: string) => Math.abs(ordered.indexOf(first) - ordered.indexOf(second));
		expect(gap('#ff0000', '#ff5050')).toBe(1);
		expect(gap('#0000ff', '#5050ff')).toBe(1);
	});

	it('keeps every colour once, whatever the size', () => {
		const many = Array.from({ length: 12 }, (_, index) => `#${(index * 20).toString(16).padStart(2, '0')}${(255 - index * 20).toString(16).padStart(2, '0')}80`);
		const ordered = orderBySimilarity(many);
		expect([...ordered].sort()).toEqual([...many].sort());
	});

	it('runs dark to light', () => {
		const ordered = orderBySimilarity(['#202020', '#a0a0a0', '#606060', '#e0e0e0']);
		expect(ordered).toEqual(['#202020', '#606060', '#a0a0a0', '#e0e0e0']);
	});
});

describe('stripes art', () => {
	it('uses only palette colours, as plain hexes', () => {
		palettes.forEach((palette) => {
			const allowed = new Set(palette.colors.map(({ hex }) => hex.toLowerCase()));
			const art = generatePaletteArt({ palette, variant: 'stripes', seed: 3 });
			const fills = [...art.matchAll(/fill="([^"]+)"/g)].map(([, value]) => value!.toLowerCase());
			expect(fills.length).toBeGreaterThan(1);
			fills.forEach((fill) => expect(allowed.has(fill)).toBe(true));
		});
	});

	it('rotates all the stripes together, in one group', () => {
		const art = generatePaletteArt({ palette: palettes[0]!, variant: 'stripes', seed: 3 });
		expect(art.match(/rotate\(/g)).toHaveLength(1);
	});

	it('moves as one piece with parallax', () => {
		const art = generatePaletteArt({ palette: palettes[0]!, variant: 'stripes', seed: 3, depth: { parallaxPoint: 0.5 } });
		expect(splitLayers(art).layers).toHaveLength(1);
	});

	it('copes with a one-colour palette', () => {
		const mono: Palette = { title: 'Mono', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		expect(generatePaletteArt({ palette: mono, variant: 'stripes', seed: 2 })).toContain('rotate(');
	});
});
