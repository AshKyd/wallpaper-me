import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { DEPTH_JITTER, depthOf, depthsOf } from './depth.js';
import { DEPTH_LAYERS, WHOLE_CANVAS_SHIFT, depthLayers, splitLayers } from './depthLayers.js';
import { generatePaletteArt } from './generators.js';
import { FAR_SHIFT_SHARE, PARALLAX_BLEED, parallaxOffset, parallaxShift, pointerPosition } from './parallax.js';
import type { Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];
const range = { smallest: 10, largest: 200 };

/** Shapes falling in size, like a generated layout. */
const shapes = Array.from({ length: 120 }, (_, index) => ({ size: 10 + 190 * (1 - index / 120) ** 2.4, markup: `<circle cx="${index * 9}" r="${index}"/>` }));

describe('depthOf', () => {
	it('is 0 for the smallest, 1 for the largest, and rises with size', () => {
		expect(depthOf(10, range)).toBe(0);
		expect(depthOf(200, range)).toBe(1);
		const depths = [10, 20, 50, 100, 200].map((size) => depthOf(size, range));
		depths.slice(1).forEach((depth, index) => expect(depth).toBeGreaterThan(depths[index]!));
	});

	it('clamps sizes outside the range', () => {
		expect(depthOf(2, range)).toBe(0);
		expect(depthOf(900, range)).toBe(1);
	});
});

describe('depthsOf', () => {
	it('stays in 0 to 1, repeats for the same shapes, and follows size on the whole', () => {
		const depths = depthsOf(shapes, range);
		depths.forEach((depth) => {
			expect(depth).toBeGreaterThanOrEqual(0);
			expect(depth).toBeLessThanOrEqual(1);
		});
		expect(depthsOf(shapes, range)).toEqual(depths);
		const nearest = depths.slice(0, 20).reduce((sum, depth) => sum + depth, 0) / 20;
		const furthest = depths.slice(-20).reduce((sum, depth) => sum + depth, 0) / 20;
		expect(nearest).toBeGreaterThan(furthest + 0.5);
	});

	it('varies between shapes of the same size, within the jitter', () => {
		const same = Array.from({ length: 200 }, (_, index) => ({ size: 60, markup: `<circle cx="${index * 7}"/>` }));
		const depths = depthsOf(same, range);
		expect(new Set(depths).size).toBeGreaterThan(100);
		expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(DEPTH_JITTER);
	});

});

describe('parallax', () => {
	it('keeps the parallax point still and sends nearer and further layers opposite ways', () => {
		expect(parallaxShift(0.4, 0.4)).toBe(0);
		expect(parallaxShift(1, 0.4)).toBeGreaterThan(0);
		expect(parallaxShift(0, 0.4)).toBeLessThan(0);
		[0, 0.5, 1].forEach((point) => {
			expect(parallaxShift(0, point)).toBeGreaterThanOrEqual(-FAR_SHIFT_SHARE);
			expect(parallaxShift(1, point)).toBeLessThanOrEqual(1);
		});
	});

	it('moves the nearest layer the full distance and the furthest only a small share of it', () => {
		expect(parallaxShift(1, 0.5)).toBe(1);
		expect(parallaxShift(0, 0.5)).toBeCloseTo(-FAR_SHIFT_SHARE);
		expect(Math.abs(parallaxShift(0, 0.5))).toBeLessThan(Math.abs(parallaxShift(1, 0.5)) / 2);
	});

	it('maps the cursor to -1 to 1 across a box, clamped', () => {
		const box = { left: 100, top: 50, width: 400, height: 200 };
		expect(pointerPosition(300, 150, box)).toEqual({ x: 0, y: 0 });
		expect(pointerPosition(100, 50, box)).toEqual({ x: -1, y: -1 });
		expect(pointerPosition(900, -400, box)).toEqual({ x: 1, y: -1 });
		expect(pointerPosition(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
	});

	it('slides against the cursor, never further than the bleed', () => {
		expect(parallaxOffset({ x: 1, y: -0.5 }, 30)).toEqual({ x: -30, y: 15 });
		expect(parallaxOffset({ x: 1, y: 1 }, 5000).x).toBe(-PARALLAX_BLEED);
		expect(parallaxOffset({ x: 1, y: 1 }, -4).x).toBeCloseTo(0);
	});
});

describe('depthLayers', () => {
	const options = { items: shapes, range };
	const plain = shapes.map(({ markup }) => markup).join('');

	it('draws the shapes untouched when parallax is off', () => {
		expect(depthLayers(options)).toBe(plain);
	});

	it('puts the few big shapes in the near layers, where they slide furthest', () => {
		const { layers } = splitLayers(depthLayers({ ...options, settings: { parallaxPoint: 0.3 } }));
		const shiftAndCount = layers.map(({ shift, markup }) => ({ shift, count: markup.match(/<circle/g)!.length }));
		const nearest = shiftAndCount.reduce((best, layer) => (layer.shift > best.shift ? layer : best));
		const furthest = shiftAndCount.reduce((best, layer) => (layer.shift < best.shift ? layer : best));
		expect(nearest.count).toBeLessThan(furthest.count);
		expect(Math.abs(nearest.shift)).toBeGreaterThan(Math.abs(furthest.shift));
	});

	it('keeps every shape in at most DEPTH_LAYERS layers, with shifts either side of zero', () => {
		const art = depthLayers({ ...options, settings: { parallaxPoint: 0.5 } });
		const { base, layers } = splitLayers(art);
		shapes.forEach(({ markup }) => expect(art).toContain(markup));
		expect(base).toBe('');
		expect(layers.length).toBeLessThanOrEqual(DEPTH_LAYERS);
		expect(art).not.toMatch(/NaN|undefined|Infinity|filter/);
		const shifts = layers.map(({ shift }) => shift);
		expect(Math.min(...shifts)).toBeLessThan(0);
		expect(Math.max(...shifts)).toBeGreaterThan(0);
	});
});

describe('splitLayers', () => {
	it('separates what stays put from the layers, in order, even when layers contain groups', () => {
		const art = `<rect/><!--layer:-0.2--><g><circle/></g><!--/layer--><!--layer:0.8--><g><g/></g><rect/><!--/layer-->`;
		expect(splitLayers(art)).toEqual({
			base: '<rect/>',
			layers: [
				{ shift: -0.2, markup: '<g><circle/></g>' },
				{ shift: 0.8, markup: '<g><g/></g><rect/>' }
			]
		});
	});

	it('finds no layers in plain artwork', () => {
		expect(splitLayers('<rect/>')).toEqual({ base: '<rect/>', layers: [] });
	});
});

describe('generatePaletteArt with parallax layers', () => {
	it.each(['circles', 'flowers'] as const)('%s adds layers only when asked, and does not rearrange the art', (variant) => {
		palettes.forEach((palette) => {
			const flat = generatePaletteArt({ palette, variant, seed: 2 });
			const layered = generatePaletteArt({ palette, variant, seed: 2, depth: { parallaxPoint: 0.5 } });
			expect(splitLayers(flat).layers).toHaveLength(0);
			const { base, layers } = splitLayers(layered);
			expect(layers.length).toBeGreaterThan(1);
			expect(layered).not.toMatch(/NaN|undefined|Infinity/);
			// Same shapes either way: only the grouping changes. The backdrop stays in the base.
			expect(layered.match(/<circle/g)?.length).toBe(flat.match(/<circle/g)?.length);
			expect(base).toContain('<rect');
		});
	});

	it.each(['triangles', 'diamonds', 'bands', 'checkerboard', 'hexagons'] as const)('%s slides as one piece over the whole canvas', (variant) => {
		palettes.forEach((palette) => {
			const flat = generatePaletteArt({ palette, variant, seed: 2 });
			const moving = generatePaletteArt({ palette, variant, seed: 2, depth: { parallaxPoint: 0.5 } });
			expect(splitLayers(moving)).toEqual({ base: '', layers: [{ shift: WHOLE_CANVAS_SHIFT, markup: flat }] });
		});
	});

	it('does not wrap anything when parallax is off', () => {
		expect(generatePaletteArt({ palette: palettes[0]!, variant: 'bands', seed: 2, depth: {} })).not.toContain('<!--layer');
	});
});
