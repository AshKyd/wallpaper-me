import { describe, expect, it } from 'vitest';
import paletteData from '../../../../../palettes.json';
import { canvasSizeFor } from '../canvas.js';
import { buildCheckerGrid, checkerboardArt } from '../checkerboard.js';
import { colourDistance, createRandom, normalisePalette, type Palette } from '../paletteUtils.js';
import { MAX_PAIR_DISTANCE } from './layers.js';
import { MOTIFS, MOTIF_NAMES, OVERLAYS, OVERLAY_NAMES } from './motifs.js';

const palettes = paletteData as Palette[];
const RADIUS = 4;
const offsets = Array.from({ length: RADIUS * 2 + 1 }, (_, index) => index - RADIUS);

const shapes = [
	[1200, 800],
	[1920, 1080],
	[390, 844],
	[3440, 1000]
] as const;

/** Cells a motif covers, as "dx,dy" keys. */
const cellsOf = (name: keyof typeof MOTIFS) =>
	new Set(offsets.flatMap((dx) => offsets.filter((dy) => MOTIFS[name](dx, dy, RADIUS) !== undefined).map((dy) => `${dx},${dy}`)));

describe('motifs', () => {
	it.each(MOTIF_NAMES)('%s returns undefined or a small tone for every cell', (name) => {
		offsets.forEach((dx) =>
			offsets.forEach((dy) => {
				const tone = MOTIFS[name](dx, dy, RADIUS);
				if (tone !== undefined) expect([0, 1]).toContain(tone);
			})
		);
	});

	it.each(MOTIF_NAMES)('%s covers at least one cell', (name) => {
		expect(cellsOf(name).size).toBeGreaterThan(0);
	});

	it.each(['x', 'plus', 'starburst', 'asterisk', 'o', 'target', 'squareRing', 'diamondRing'] as const)(
		'%s is symmetrical under mirroring and quarter turns',
		(name) => {
			const cells = cellsOf(name);
			cells.forEach((key) => {
				const [dx, dy] = key.split(',').map(Number) as [number, number];
				expect(cells.has(`${-dx},${dy}`)).toBe(true);
				expect(cells.has(`${dy},${dx}`)).toBe(true);
			});
		}
	);

	it('starburst is the plus and the x together', () => {
		const starburst = cellsOf('starburst');
		[...cellsOf('x'), ...cellsOf('plus')].forEach((key) => expect(starburst.has(key)).toBe(true));
	});
});

describe('overlays', () => {
	it.each(OVERLAY_NAMES)('%s stays within the layer count', (name) => {
		offsets.forEach((dx) =>
			offsets.forEach((dy) => {
				const layer = OVERLAYS[name](dx, dy, 4, 20);
				expect(layer).toBeGreaterThanOrEqual(0);
				expect(layer).toBeLessThan(4);
			})
		);
	});
});

describe('checkerboardArt', () => {
	const inputFor = (palette: Palette, seed: number, width: number, height: number) => ({
		colours: normalisePalette(palette),
		random: createRandom(seed),
		idPrefix: 'test',
		width,
		height
	});

	it('is always a true checkerboard: both colours of every pair differ', () => {
		palettes.forEach((palette) => {
			[1, 2, 3, 4, 5, 6].forEach((seed) => {
				const { pairs } = buildCheckerGrid(inputFor(palette, seed, 1200, 800));
				pairs.forEach(([light, dark]) => expect(light).not.toBe(dark));
			});
		});
	});

	it('pairs similar colours only, so the checks never jump between hues', () => {
		palettes.forEach((palette) => {
			const { pairs } = buildCheckerGrid(inputFor(palette, 1, 1200, 800));
			pairs.forEach(([first, second]) => expect(colourDistance(first, second)).toBeLessThanOrEqual(MAX_PAIR_DISTANCE + 0.01));
		});
	});

	it('leads the background pair with the most prominent colour', () => {
		palettes.forEach((palette) => {
			const { pairs } = buildCheckerGrid(inputFor(palette, 1, 1200, 800));
			expect(pairs[0]![0]).toBe(normalisePalette(palette)[0]!.hex);
		});
	});

	it('uses only valid layers, and draws one square per cell at every shape', () => {
		palettes.forEach((palette) => {
			shapes.forEach(([containerWidth, containerHeight]) => {
				const { width, height } = canvasSizeFor(containerWidth, containerHeight);
				const input = inputFor(palette, 7, width, height);
				const grid = buildCheckerGrid(input);
				expect(grid.layers).toHaveLength(grid.rows);
				grid.layers.forEach((row) => {
					expect(row).toHaveLength(grid.columns);
					row.forEach((layer) => expect(grid.pairs[layer]).toBeDefined());
				});
				// Columns and rows are odd so there is a centre cell and crops are symmetrical.
				expect(grid.columns % 2).toBe(1);
				expect(grid.rows % 2).toBe(1);
				const art = checkerboardArt(inputFor(palette, 7, width, height));
				expect(art.match(/<rect/g)).toHaveLength(grid.columns * grid.rows + 1);
				expect(art).not.toMatch(/NaN|undefined|Infinity/);
			});
		});
	});

	it('actually forms a pattern: some cells leave the background layer', () => {
		const hits = palettes.flatMap((palette) =>
			[1, 2, 3, 4].map((seed) => buildCheckerGrid(inputFor(palette, seed, 1200, 800)).layers.flat().some((layer) => layer !== 0))
		);
		expect(hits.every(Boolean)).toBe(true);
	});

	it('copes with a one-colour palette', () => {
		const mono: Palette = { title: 'Mono', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		const grid = buildCheckerGrid(inputFor(mono, 1, 1200, 800));
		grid.pairs.forEach(([light, dark]) => expect(light).not.toBe(dark));
	});
});
