import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { canvasSizeFor } from './canvas.js';
import { generatePaletteArt } from './generators.js';
import { BASE_LINE_WIDTH, GRID, MIN_BLOCK, layoutBlocks, lineWidthFor } from './mondrian.js';
import { createRandom, type Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];
const { width, height } = canvasSizeFor(1600, 900);
const layoutFor = (seed: number) => layoutBlocks({ block: { x: 0, y: 0, width, height }, random: createRandom(seed) });
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

describe('mondrian layout', () => {
	it('tiles the canvas exactly, with no gaps or overlaps', () => {
		seeds.forEach((seed) => {
			const { blocks } = layoutFor(seed);
			const area = blocks.reduce((sum, block) => sum + block.width * block.height, 0);
			expect(area).toBeCloseTo(width * height, 3);
			blocks.forEach(({ x, y, width: blockWidth, height: blockHeight }) => {
				expect(x).toBeGreaterThanOrEqual(0);
				expect(y).toBeGreaterThanOrEqual(0);
				expect(x + blockWidth).toBeLessThanOrEqual(width + 0.001);
				expect(y + blockHeight).toBeLessThanOrEqual(height + 0.001);
			});
		});
	});

	it('never makes a block smaller than MIN_BLOCK on either side', () => {
		seeds.forEach((seed) => {
			layoutFor(seed).blocks.forEach((block) => {
				expect(block.width).toBeGreaterThanOrEqual(MIN_BLOCK - 0.001);
				expect(block.height).toBeGreaterThanOrEqual(MIN_BLOCK - 0.001);
			});
		});
	});

	it('puts almost every line on the grid', () => {
		const dividers = seeds.flatMap((seed) => layoutFor(seed).dividers);
		const onGrid = dividers.filter(({ x1, y1, x2 }) => (x1 === x2 ? x1 : y1) % GRID === 0);
		// Only a block too tight for any grid line is cut down its middle.
		expect(onGrid.length / dividers.length).toBeGreaterThan(0.8);
	});

	it('has one divider fewer than it has blocks', () => {
		seeds.forEach((seed) => {
			const { blocks, dividers } = layoutFor(seed);
			expect(dividers.length).toBe(blocks.length - 1);
		});
	});

	it('varies from seed to seed, and repeats for the same seed', () => {
		expect(layoutFor(1)).toEqual(layoutFor(1));
		expect(layoutFor(1)).not.toEqual(layoutFor(2));
	});

	it('mixes big and small blocks', () => {
		const spread = (seed: number) => {
			const areas = layoutFor(seed).blocks.map((block) => block.width * block.height);
			return Math.max(...areas) / Math.min(...areas);
		};
		// Any one seed can be even; across several, sizes must differ a lot.
		expect(seeds.filter((seed) => spread(seed) > 2).length).toBeGreaterThanOrEqual(seeds.length / 2);
	});
});

describe('mondrian art', () => {
	it('uses only 6-digit hex colours, so every tone can recolour it', () => {
		palettes.forEach((palette) => {
			const art = generatePaletteArt({ palette, variant: 'mondrian', seed: 4 });
			const fills = [...art.matchAll(/fill="([^"]+)"/g)].map(([, value]) => value!);
			expect(fills.length).toBeGreaterThan(0);
			fills.forEach((fill) => expect(fill).toMatch(/^#[0-9a-f]{6}$/i));
		});
	});

	it('adds no colour to the palette except black', () => {
		palettes.forEach((palette) => {
			const allowed = new Set([...palette.colors.map(({ hex }) => hex.toLowerCase()), '#000000']);
			const art = generatePaletteArt({ palette, variant: 'mondrian', seed: 4 });
			const used = [...art.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map(([, value]) => value!.toLowerCase());
			used.forEach((hex) => expect(allowed.has(hex)).toBe(true));
			expect(used).toContain('#000000');
		});
	});

	it('thickens the lines with the border setting, without moving them', () => {
		const palette = palettes[0]!;
		const make = (gap: number) => generatePaletteArt({ palette, variant: 'mondrian', seed: 4, gap });
		const widthsOf = (art: string) => [...art.matchAll(/<rect [^>]*fill="#000000"/g)].length;
		expect(lineWidthFor(0)).toBe(BASE_LINE_WIDTH);
		expect(lineWidthFor(0.4)).toBeGreaterThan(lineWidthFor(0.2));
		// Same lines and blocks, only wider.
		expect(widthsOf(make(0.4))).toBe(widthsOf(make(0)));
		expect(make(0.4)).not.toBe(make(0));
	});

	it('copes with a one-colour palette', () => {
		const mono: Palette = { title: 'Mono', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		expect(generatePaletteArt({ palette: mono, variant: 'mondrian', seed: 2 })).toContain('<rect');
	});
});
