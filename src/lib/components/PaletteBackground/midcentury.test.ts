import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { canvasSizeFor } from './canvas.js';
import { generatePaletteArt } from './generators.js';
import { CELL_WIDTHS, inkGapFor, layoutCells } from './midcentury.js';
import { createRandom, normalisePalette, type Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];
const { width, height } = canvasSizeFor(1600, 900);
const colours = normalisePalette(palettes[0]!);
const boardFor = (seed: number) => layoutCells({ colours, random: createRandom(seed), width, height });
const seeds = [1, 2, 3, 4, 5, 6];

describe('midcentury layout', () => {
	it('uses a known cell width and covers the canvas', () => {
		seeds.forEach((seed) => {
			const { width: cellWidth, columns, rows, originX, originY } = boardFor(seed);
			expect(CELL_WIDTHS).toContain(cellWidth);
			expect(originX).toBeLessThanOrEqual(0);
			expect(originY).toBeLessThanOrEqual(0);
			expect(originX + columns * cellWidth).toBeGreaterThanOrEqual(width);
			expect(originY + rows * cellWidth * 2).toBeGreaterThanOrEqual(height);
		});
	});

	it('gives every cell an arc or triangle, facing left or right, in two different colours', () => {
		seeds.flatMap((seed) => boardFor(seed).cells).forEach(({ shape, facing, ground, ink }) => {
			expect(['arc', 'triangle']).toContain(shape);
			expect(['left', 'right']).toContain(facing);
			expect(ink).not.toBe(ground);
		});
	});

	it('never sets a cell\'s ground as the ink of its left or upper neighbour, or its ink as their ground', () => {
		// Every palette with four or more colours has a gap that avoids every clash.
		const roomy = palettes.filter(({ colors }) => colors.length >= 4).map(normalisePalette);
		expect(roomy.length).toBeGreaterThan(0);
		roomy.flatMap((roomyColours) => seeds.map((seed) => ({ roomyColours, seed }))).forEach(({ roomyColours, seed }) => {
			const { cells, columns } = layoutCells({ colours: roomyColours, random: createRandom(seed), width, height });
			cells.forEach((cell, index) => {
				const neighbours = [cell.column > 0 ? cells[index - 1] : undefined, cell.row > 0 ? cells[index - columns] : undefined];
				neighbours.forEach((neighbour) => {
					if (!neighbour) return;
					expect(cell.ground).not.toBe(neighbour.ink);
					expect(cell.ink).not.toBe(neighbour.ground);
				});
			});
		});
	});

	it('uses one shape and one facing across the whole board', () => {
		seeds.forEach((seed) => {
			const { cells } = boardFor(seed);
			expect(new Set(cells.map(({ shape }) => shape)).size).toBe(1);
			expect(new Set(cells.map(({ facing }) => facing)).size).toBe(1);
		});
	});

	it('varies the shape and facing between seeds', () => {
		const looks = Array.from({ length: 20 }, (_, index) => boardFor(index + 1).cells[0]!).map(({ shape, facing }) => `${shape} ${facing}`);
		expect(new Set(looks).size).toBe(4);
	});

	it('colours cells by a pattern: the same colours repeat along each diagonal', () => {
		const { cells, columns } = boardFor(1);
		cells.forEach((cell, index) => {
			const diagonalNeighbour = cell.column > 0 && cell.row < Math.floor(cells.length / columns) - 1 ? cells[index + columns - 1] : undefined;
			if (!diagonalNeighbour) return;
			expect(diagonalNeighbour.ground).toBe(cell.ground);
			expect(diagonalNeighbour.ink).toBe(cell.ink);
		});
	});

	it('picks the smallest ink gap that avoids clashes', () => {
		expect([1, 2, 3, 4, 5, 6, 8].map(inkGapFor)).toEqual([0, 1, 1, 2, 2, 2, 2]);
	});

	it('repeats for a seed and differs between seeds', () => {
		expect(boardFor(1)).toEqual(boardFor(1));
		expect(boardFor(1)).not.toEqual(boardFor(2));
	});
});

describe('midcentury art', () => {
	it('uses only palette colours, as plain hexes', () => {
		palettes.forEach((palette) => {
			const allowed = new Set(palette.colors.map(({ hex }) => hex.toLowerCase()));
			const art = generatePaletteArt({ palette, variant: 'midcentury', seed: 3 });
			const fills = [...art.matchAll(/fill="([^"]+)"/g)].map(([, value]) => value!.toLowerCase());
			expect(fills.length).toBeGreaterThan(1);
			fills.forEach((fill) => expect(allowed.has(fill)).toBe(true));
			expect(art).not.toMatch(/NaN|undefined|Infinity/);
		});
	});

	it('copes with a one-colour palette, inking in black', () => {
		const mono: Palette = { title: 'Mono', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		expect(generatePaletteArt({ palette: mono, variant: 'midcentury', seed: 2 })).toContain('#000000');
	});
});
