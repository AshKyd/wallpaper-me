import { describe, expect, it } from 'vitest';
import paletteData from '../../../../../palettes.json';
import { canvasSizeFor } from '../canvas.js';
import { buildHexGrid, cycleOf, hexagonsArt, MAX_GAP, stepPairs } from '../hexagons.js';
import { colourDistance, createRandom, normalisePalette, type Palette } from '../paletteUtils.js';

const palettes = paletteData as Palette[];

const shapes = [
	[1200, 800],
	[1920, 1080],
	[390, 844],
	[3440, 1000]
] as const;

/** Offsets to the six neighbours that share an edge. */
const NEIGHBOURS = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[1, -1],
	[-1, 1]
] as const;

const inputFor = (palette: Palette, seed: number, width: number, height: number, gap = 0) => ({
	colours: normalisePalette(palette),
	random: createRandom(seed),
	idPrefix: 'test',
	width,
	height,
	gap
});

const loopLength = (loop: string[]) => loop.reduce((sum, colour, index) => sum + colourDistance(colour, loop[(index + 1) % loop.length]!), 0);

describe('cycleOf', () => {
	it('keeps every palette colour, adds no duplicates, and has at least five colours', () => {
		palettes.forEach((palette) => {
			const colours = normalisePalette(palette);
			const cycle = cycleOf(colours);
			expect(new Set(cycle).size).toBe(cycle.length);
			expect(cycle.length).toBeGreaterThanOrEqual(5);
			colours.forEach(({ hex }) => expect(cycle).toContain(hex));
		});
	});

	it('starts with the most prominent colour', () => {
		palettes.forEach((palette) => {
			const colours = normalisePalette(palette);
			expect(cycleOf(colours)[0]).toBe(colours[0]!.hex);
		});
	});

	it('is a short loop: no longer than going through the colours in palette order', () => {
		palettes.forEach((palette) => {
			const colours = normalisePalette(palette);
			const cycle = cycleOf(colours);
			const inPaletteOrder = colours.map(({ hex }) => hex);
			// Only comparable when no colours were added.
			if (inPaletteOrder.length === cycle.length) expect(loopLength(cycle)).toBeLessThanOrEqual(loopLength(inPaletteOrder) + 1e-9);
		});
	});
});

describe('stepPairs', () => {
	it.each([5, 6, 7, 8, 9])('for %i colours: every pair keeps all six neighbours different', (length) => {
		const pairs = stepPairs(length);
		expect(pairs.length).toBeGreaterThan(0);
		pairs.forEach(([across, down]) =>
			[across, down, across - down].forEach((difference) => expect(((difference % length) + length) % length).not.toBe(0))
		);
	});

	it('prefers steps that keep neighbours close on the loop', () => {
		// With five colours the best neighbours are one or two places apart, never more.
		stepPairs(5).forEach(([across, down]) =>
			[across, down, across - down].forEach((difference) => {
				const wrapped = ((difference % 5) + 5) % 5;
				expect(Math.min(wrapped, 5 - wrapped)).toBeLessThanOrEqual(2);
			})
		);
	});
});

describe('hexagonsArt', () => {
	it('draws one solid hexagon per cell, cleanly, at every shape', () => {
		palettes.forEach((palette) =>
			shapes.forEach(([containerWidth, containerHeight]) => {
				const { width, height } = canvasSizeFor(containerWidth, containerHeight);
				const grid = buildHexGrid(inputFor(palette, 3, width, height));
				const art = hexagonsArt(inputFor(palette, 3, width, height));
				expect(art.match(/<polygon/g)).toHaveLength(grid.cells.length);
				expect(art).not.toMatch(/NaN|undefined|Infinity|Gradient/);
			})
		);
	});

	it('uses only palette colours: every hexagon is one solid colour from the cycle', () => {
		palettes.forEach((palette) => {
			const grid = buildHexGrid(inputFor(palette, 2, 1200, 800));
			grid.cells.forEach(({ colour }) => expect(grid.cycle).toContain(colour));
		});
	});

	it('never gives two hexagons that share an edge the same colour', () => {
		palettes.forEach((palette) =>
			[1, 2, 3, 4].forEach((seed) =>
				shapes.forEach(([containerWidth, containerHeight]) => {
					const { width, height } = canvasSizeFor(containerWidth, containerHeight);
					const grid = buildHexGrid(inputFor(palette, seed, width, height));
					const byKey = new Map(grid.cells.map((cell) => [`${cell.q},${cell.r}`, cell.colour]));
					grid.cells.forEach((cell) =>
						NEIGHBOURS.forEach(([dq, dr]) => expect(byKey.get(`${cell.q + dq},${cell.r + dr}`)).not.toBe(cell.colour))
					);
				})
			)
		);
	});

	it('is a true repeating pattern: the same colour comes round again every few hexagons', () => {
		palettes.forEach((palette) => {
			const grid = buildHexGrid(inputFor(palette, 1, 1200, 800));
			const byKey = new Map(grid.cells.map((cell) => [`${cell.q},${cell.r}`, cell.colour]));
			const period = grid.cycle.length;
			grid.cells.forEach((cell) => {
				const along = byKey.get(`${cell.q + period},${cell.r}`);
				const down = byKey.get(`${cell.q},${cell.r + period}`);
				if (along) expect(along).toBe(cell.colour);
				if (down) expect(down).toBe(cell.colour);
			});
		});
	});

	it('spreads every colour evenly, so none gets stuck in a corner', () => {
		palettes.forEach((palette) =>
			[1, 2, 3].forEach((seed) => {
				const { width, height } = canvasSizeFor(1920, 1080);
				const grid = buildHexGrid(inputFor(palette, seed, width, height));
				const counts = grid.cycle.map((colour) => grid.cells.filter((cell) => cell.colour === colour).length);
				const mean = grid.cells.length / grid.cycle.length;
				counts.forEach((count) => expect(Math.abs(count - mean) / mean).toBeLessThan(0.15));
				// Every colour appears in each quarter of the canvas.
				[
					(x: number, y: number) => x < width / 2 && y < height / 2,
					(x: number, y: number) => x >= width / 2 && y < height / 2,
					(x: number, y: number) => x < width / 2 && y >= height / 2,
					(x: number, y: number) => x >= width / 2 && y >= height / 2
				].forEach((inQuarter) => {
					const seen = new Set(grid.cells.filter((cell) => inQuarter(cell.x, cell.y)).map((cell) => cell.colour));
					expect(seen.size).toBe(grid.cycle.length);
				});
			})
		);
	});

	it('keeps edge neighbours more alike than random colours would be', () => {
		palettes.forEach((palette) => {
			const grid = buildHexGrid(inputFor(palette, 1, 1200, 800));
			const byKey = new Map(grid.cells.map((cell) => [`${cell.q},${cell.r}`, cell.colour]));
			const neighbourDistances = grid.cells.flatMap((cell) =>
				NEIGHBOURS.map(([dq, dr]) => byKey.get(`${cell.q + dq},${cell.r + dr}`))
					.filter((other): other is string => other !== undefined)
					.map((other) => colourDistance(cell.colour, other))
			);
			const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
			const allPairs = grid.cycle.flatMap((first, index) => grid.cycle.slice(index + 1).map((second) => colourDistance(first, second)));
			expect(average(neighbourDistances)).toBeLessThan(average(allPairs));
		});
	});

	it('covers the whole canvas: every corner and edge midpoint has a hexagon within reach', () => {
		palettes.forEach((palette) =>
			[1, 2, 3].forEach((seed) => {
				const { width, height } = canvasSizeFor(1920, 1080);
				const { cells, size } = buildHexGrid(inputFor(palette, seed, width, height));
				[
					[0, 0],
					[width, 0],
					[0, height],
					[width, height],
					[width / 2, 0],
					[width / 2, height],
					[0, height / 2],
					[width, height / 2]
				].forEach(([x, y]) => expect(cells.some((cell) => Math.hypot(cell.x - x!, cell.y - y!) <= size)).toBe(true));
			})
		);
	});

	it('gap shrinks the hexagons and leaves a border colour behind them', () => {
		const palette = palettes[0]!;
		const flat = hexagonsArt(inputFor(palette, 1, 1200, 800, 0));
		const bordered = hexagonsArt(inputFor(palette, 1, 1200, 800, 0.2));
		const firstPoints = (art: string) => art.match(/points="([^"]+)"/)![1]!.split(' ').map((pair) => pair.split(',').map(Number));
		const spread = (points: number[][]) => Math.max(...points.map(([x]) => x!)) - Math.min(...points.map(([x]) => x!));
		expect(spread(firstPoints(bordered))).toBeLessThan(spread(firstPoints(flat)));
		expect(bordered).not.toBe(flat);
	});

	it('limits the gap so hexagons never vanish', () => {
		const art = hexagonsArt(inputFor(palettes[0]!, 1, 1200, 800, 5));
		const capped = hexagonsArt(inputFor(palettes[0]!, 1, 1200, 800, MAX_GAP));
		expect(art).toBe(capped);
	});

	it('copes with a one-colour palette', () => {
		const mono: Palette = { title: 'Mono', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		const art = hexagonsArt(inputFor(mono, 1, 1200, 800, 0.1));
		expect(art).not.toMatch(/NaN|undefined/);
		// A tint is added, then blends, so it still has a pattern and keeps every edge different.
		const grid = buildHexGrid(inputFor(mono, 1, 1200, 800));
		expect(grid.cycle).toHaveLength(5);
		const byKey = new Map(grid.cells.map((cell) => [`${cell.q},${cell.r}`, cell.colour]));
		grid.cells.forEach((cell) => NEIGHBOURS.forEach(([dq, dr]) => expect(byKey.get(`${cell.q + dq},${cell.r + dr}`)).not.toBe(cell.colour)));
	});
});
