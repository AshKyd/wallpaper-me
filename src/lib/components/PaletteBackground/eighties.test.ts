import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { canvasSizeFor } from './canvas.js';
import { DOUBLEABLE, DOUBLE_SHARE, PACKING, SHAPE_KINDS, SHAPE_SCALE, SQUIGGLE_HEIGHT, SQUIGGLE_WAVES, kindWeights, layoutShapes, reachOf, shapeGeometry, splitColours } from './eighties.js';
import { splitLayers } from './depthLayers.js';
import { generatePaletteArt } from './generators.js';
import { createRandom, luminance, normalisePalette, type Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];
const { width, height } = canvasSizeFor(1600, 900);
const colours = normalisePalette(palettes[0]!);
const layoutFor = (seed: number) => layoutShapes({ colours, random: createRandom(seed), width, height });
const seeds = Array.from({ length: 12 }, (_, index) => index + 1);

describe('80s colours', () => {
	it('uses the darkest colour as the background and the rest for shapes', () => {
		palettes.forEach((palette) => {
			const hexes = normalisePalette(palette).map(({ hex }) => hex);
			const { background, foregrounds } = splitColours(normalisePalette(palette));
			hexes.forEach((hex) => expect(luminance(background)).toBeLessThanOrEqual(luminance(hex)));
			if (hexes.length > 1) expect(foregrounds).not.toContain(background);
			expect(foregrounds.length).toBeGreaterThan(0);
		});
	});

	it('draws a one-colour palette in white', () => {
		expect(splitColours([{ hex: '#336699', prominence: 1 }]).foregrounds).toEqual(['#ffffff']);
	});
});

describe('80s layout', () => {
	it('uses every kind of shape, filling only squares and triangles', () => {
		const shapes = seeds.flatMap((seed) => layoutFor(seed).shapes);
		SHAPE_KINDS.forEach((kind) => expect(shapes.some((shape) => shape.kind === kind)).toBe(true));
		shapes.filter(({ filled }) => filled).forEach(({ kind }) => expect(['square', 'triangle']).toContain(kind));
		expect(shapes.some(({ filled }) => filled)).toBe(true);
		expect(shapes.some(({ kind, filled }) => kind === 'square' && !filled)).toBe(true);
	});

	it('keeps the shapes apart: their circles never touch, whatever way the shapes are turned', () => {
		seeds.forEach((seed) => {
			const { shapes } = layoutFor(seed);
			shapes.forEach((shape, index) =>
				shapes.slice(index + 1).forEach((other) => {
					expect(Math.hypot(shape.x - other.x, shape.y - other.y)).toBeGreaterThanOrEqual(shape.radius + other.radius + PACKING.gap - 0.001);
				})
			);
		});
	});

	it('leaves clear space between shapes, counting strokes, doubles and the points of triangles and crosses', () => {
		seeds.forEach((seed) => {
			const { shapes } = layoutFor(seed);
			shapes.forEach((shape, index) =>
				shapes.slice(index + 1).forEach((other) => {
					const clearance = Math.hypot(shape.x - other.x, shape.y - other.y) - reachOf(shape) - reachOf(other);
					expect(clearance).toBeGreaterThan(0);
				})
			);
		});
	});

	it('packs the canvas tightly, with big shapes and small ones', () => {
		seeds.forEach((seed) => {
			const { shapes } = layoutFor(seed);
			const covered = shapes.reduce((area, { radius }) => area + Math.PI * radius ** 2, 0);
			// Circles cannot tile the plane, so a tight pack covers well under all of it.
			expect(covered / (width * height)).toBeGreaterThan(0.45);
			const radii = shapes.map(({ radius }) => radius);
			expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii) * 2.5);
		});
	});

	it('gives big circles to solid shapes and small ones to lines and crosses', () => {
		const shapes = seeds.flatMap((seed) => layoutFor(seed).shapes);
		const average = (kinds: string[]) => {
			const matching = shapes.filter(({ kind }) => kinds.includes(kind));
			return matching.reduce((sum, { radius }) => sum + radius, 0) / matching.length;
		};
		expect(average(['square', 'triangle'])).toBeGreaterThan(average(['line', 'x']) * 1.25);
		// Overall the shapes are large rather than small.
		expect(average(SHAPE_KINDS as unknown as string[])).toBeGreaterThan(PACKING.minRadius * 1.4);
	});

	it('weights kinds by size', () => {
		expect(kindWeights(0).line).toBeGreaterThan(kindWeights(0).square);
		expect(kindWeights(1).square).toBeGreaterThan(kindWeights(1).line);
		SHAPE_KINDS.forEach((kind) => [0, 0.5, 1].forEach((size) => expect(kindWeights(size)[kind]).toBeGreaterThan(0)));
	});

	it('keeps every shape inside its circle', () => {
		const numbers = (attributes: string) => (attributes.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
		// These list their corners and ends as x y pairs. A squiggle's curve stays inside, but its control point does not, so it is left out.
		(['square', 'triangle', 'x', 'line'] as const).forEach((kind) => {
			const values = numbers(shapeGeometry(kind, 60).attributes);
			values.forEach((_, index) => index % 2 === 0 && expect(Math.hypot(values[index]!, values[index + 1]!)).toBeLessThanOrEqual(60.2));
		});
	});

	it('never uses the background colour for a shape', () => {
		seeds.forEach((seed) => {
			const { background, shapes } = layoutFor(seed);
			shapes.forEach(({ colour }) => expect(colour).not.toBe(background));
		});
	});

	it('doubles only lines and squiggles, and rarely', () => {
		const shapes = seeds.flatMap((seed) => layoutFor(seed).shapes);
		const doubleable = shapes.filter(({ kind }) => DOUBLEABLE.includes(kind));
		const doubled = doubleable.filter((shape) => shape.doubled);
		expect(doubled.length).toBeGreaterThan(0);
		expect(doubled.length / doubleable.length).toBeLessThan(DOUBLE_SHARE * 2);
		// Triangles, squares and crosses are never duplicated.
		shapes.filter(({ kind }) => !DOUBLEABLE.includes(kind)).forEach(({ doubled: isDoubled }) => expect(isDoubled).toBe(false));
	});

	it('repeats for a seed and differs between seeds', () => {
		expect(layoutFor(1)).toEqual(layoutFor(1));
		expect(layoutFor(1)).not.toEqual(layoutFor(2));
	});
});

describe('80s geometry', () => {
	it('draws every kind with no NaN', () => {
		SHAPE_KINDS.forEach((kind) => expect(JSON.stringify(shapeGeometry(kind, 80))).not.toMatch(/NaN|undefined|Infinity/));
	});

	it('makes a squiggle as wide as its circle (twice the radius), from a curve and mirrored curves', () => {
		const { attributes } = shapeGeometry('squiggle', 40);
		expect(attributes).toContain('M -40 0 Q');
		expect(attributes.match(/T /g)).toHaveLength(SQUIGGLE_WAVES - 1);
		// Gentle: the curve's peak is `SQUIGGLE_HEIGHT` of the radius, so its control point is twice that.
		expect(Math.abs(Number(attributes.match(/Q [-\d.]+ ([-\d.]+)/)![1]))).toBeCloseTo(40 * SQUIGGLE_HEIGHT * 2, 1);
		expect(attributes.trim().endsWith('40 0"')).toBe(true);
	});
});

describe('80s art', () => {
	it('uses only palette colours (and white for a one-colour palette), as plain hexes', () => {
		palettes.forEach((palette) => {
			const allowed = new Set(palette.colors.map(({ hex }) => hex.toLowerCase()));
			const art = generatePaletteArt({ palette, variant: '80s', seed: 3 });
			const paints = [...art.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(([, value]) => value!.toLowerCase()).filter((value) => value !== 'none');
			expect(paints.length).toBeGreaterThan(1);
			paints.forEach((paint) => expect(allowed.has(paint)).toBe(true));
			expect(art).not.toMatch(/NaN|undefined|Infinity/);
		});
	});

	it('splits into depth layers with parallax, leaving only the background fixed', () => {
		const art = generatePaletteArt({ palette: palettes[0]!, variant: '80s', seed: 3, depth: { parallaxPoint: 0.5 } });
		const { base, layers } = splitLayers(art);
		expect(layers.length).toBeGreaterThan(1);
		expect(base).toMatch(/^<rect[^>]*\/>$/);
		// Bigger shapes are nearer, so they slide further.
		expect(Math.max(...layers.map(({ shift }) => shift))).toBeGreaterThan(0);
		expect(Math.min(...layers.map(({ shift }) => shift))).toBeLessThan(0);
	});

	it('draws the same shapes with or without parallax', () => {
		const flat = generatePaletteArt({ palette: palettes[0]!, variant: '80s', seed: 3 });
		const layered = generatePaletteArt({ palette: palettes[0]!, variant: '80s', seed: 3, depth: { parallaxPoint: 0.5 } });
		const shapesOf = (art: string) => (art.match(/<(?:path|polygon) /g) ?? []).length;
		expect(shapesOf(flat)).toBeGreaterThan(50);
		expect(shapesOf(layered)).toBe(shapesOf(flat));
	});

	it('draws shapes at their final coordinates, with no transform on any shape', () => {
		const art = generatePaletteArt({ palette: palettes[0]!, variant: '80s', seed: 3 });
		expect(art).not.toContain('transform');
		expect(art).not.toMatch(/NaN|undefined|Infinity/);
	});

	it('turns shapes without changing their size: a line is always as long as its circle allows', () => {
		const art = generatePaletteArt({ palette: palettes[0]!, variant: '80s', seed: 1 });
		const lines = [...art.matchAll(/d="M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)"/g)].map((found) => found.slice(1).map(Number) as [number, number, number, number]);
		expect(lines.length).toBeGreaterThan(0);
		const [shortest, longest] = [PACKING.minRadius, PACKING.minRadius + PACKING.maxRadius].map((radius) => 2 * radius * SHAPE_SCALE);
		lines.forEach(([x1, y1, x2, y2]) => {
			const length = Math.hypot(x2 - x1, y2 - y1);
			expect(length).toBeGreaterThan(shortest! - 0.3);
			expect(length).toBeLessThan(longest! + 0.3);
		});
	});

	it('copes with a one-colour palette', () => {
		const mono: Palette = { title: 'Mono', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		expect(generatePaletteArt({ palette: mono, variant: '80s', seed: 2 })).toContain('#ffffff');
	});
});
