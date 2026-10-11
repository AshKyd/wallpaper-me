import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { PALETTE_VARIANTS, canvasSizeFor, generatePaletteArt } from './generators.js';
import { bandCurve } from './bands.js';
import type { Point } from './flowers/geometry.js';
import { normalisePalette, type Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];

/** Container shapes: 3:2, 16:9, tall phone, ultrawide. */
const containers = [
	[1200, 800],
	[1920, 1080],
	[390, 844],
	[3440, 1000]
] as const;

describe('canvasSizeFor', () => {
	it('keeps a fixed height and follows the aspect ratio in 0.25 steps', () => {
		expect(canvasSizeFor(1200, 800)).toEqual({ width: 1200, height: 800 });
		expect(canvasSizeFor(1920, 1080)).toEqual({ width: 1400, height: 800 });
	});

	it('clamps extreme shapes and defaults to 3:2 when unmeasured', () => {
		expect(canvasSizeFor(100, 1000).width).toBe(400);
		expect(canvasSizeFor(5000, 100).width).toBe(2400);
		expect(canvasSizeFor(0, 0)).toEqual({ width: 1200, height: 800 });
	});

	it('gives the same size for nearby widths, so resizing does not regenerate', () => {
		expect(canvasSizeFor(1000, 800)).toEqual(canvasSizeFor(1030, 800));
	});
});

describe('generatePaletteArt at different container shapes', () => {
	it.each(PALETTE_VARIANTS)('%s renders cleanly at every shape', (variant) => {
		containers.forEach(([containerWidth, containerHeight]) => {
			const { width, height } = canvasSizeFor(containerWidth, containerHeight);
			palettes.forEach((palette) => {
				const art = generatePaletteArt({ palette, variant, seed: 2, width, height });
				expect(art).not.toMatch(/NaN|undefined|Infinity/);
			});
		});
	});

	it('bands keeps one path per colour at every shape', () => {
		palettes.forEach((palette) => {
			const colourCount = normalisePalette(palette).length;
			containers.forEach(([containerWidth, containerHeight]) => {
				const { width, height } = canvasSizeFor(containerWidth, containerHeight);
				const art = generatePaletteArt({ palette, variant: 'bands', width, height });
				expect(art.match(/<path/g)).toHaveLength(colourCount);
			});
		});
	});

	it('band curves bend one way only: no S shape', () => {
		[-0.22, -0.1, 0.1, 0.22].forEach((bend) => {
			const [start, control1, control2, end] = bandCurve(1000, bend);
			const turn = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
			const turns = [turn(start, control1, control2), turn(control1, control2, end)];
			// Both turns have the same sign, so the control polygon never reverses and there is no inflection.
			expect(Math.sign(turns[0]!)).toBe(Math.sign(turns[1]!));
			expect(Math.sign(turns[0]!)).toBe(-Math.sign(bend));
		});
	});

	it('bands draws every band with exactly one curve', () => {
		palettes.forEach((palette) =>
			[1, 2, 3, 4].forEach((seed) => {
				const art = generatePaletteArt({ palette, variant: 'bands', seed });
				const paths = art.match(/<path d="[^"]+"/g) ?? [];
				expect(paths.length).toBeGreaterThan(0);
				paths.forEach((path) => expect(path.match(/C/g)).toHaveLength(1));
			})
		);
	});
});

describe('generatePaletteArt', () => {
	it.each(PALETTE_VARIANTS)('%s renders every palette without throwing', (variant) => {
		palettes.forEach((palette) => {
			const art = generatePaletteArt({ palette, variant, seed: 3 });
			expect(art).toContain('<rect');
			expect(art).not.toContain('NaN');
			expect(art).not.toContain('undefined');
		});
	});

	it('is repeatable for the same seed and differs for another', () => {
		const palette = palettes[0]!;
		const first = generatePaletteArt({ palette, variant: 'circles', seed: 5 });
		expect(generatePaletteArt({ palette, variant: 'circles', seed: 5 })).toBe(first);
		expect(generatePaletteArt({ palette, variant: 'circles', seed: 6 })).not.toBe(first);
	});

	it('copes with a one-colour palette', () => {
		const palette: Palette = { title: 'Mono', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		PALETTE_VARIANTS.forEach((variant) => {
			expect(generatePaletteArt({ palette, variant })).not.toContain('undefined');
		});
	});
});
