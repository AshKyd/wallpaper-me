import { round, type GeneratorInput } from './canvas.js';
import { buildColourPairs, type ColourPair } from './checkerboard/layers.js';
import { MOTIFS, MOTIF_NAMES, OVERLAYS, OVERLAY_NAMES, type MotifFn, type OverlayFn } from './checkerboard/motifs.js';
import { shuffle } from './paletteUtils.js';

export interface CheckerGrid {
	/** Cell side in canvas units. */
	cell: number;
	columns: number;
	rows: number;
	/** Top-left of the grid, so it is centred and any crop is symmetrical. */
	originX: number;
	originY: number;
	/** Colour pairs; index 0 is the background pair. */
	pairs: ColourPair[];
	/** Pair index for each cell, `layers[row][column]`. */
	layers: number[][];
}

const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
/** Smallest odd number that is at least `value`, so the grid always has a centre cell. */
const oddCeil = (value: number) => Math.ceil(value) | 1;

/** How motifs are chosen across the lattice when more than one is in play. */
type Assignment = 'single' | 'alternate' | 'rows';

/**
 * Works out which colour pair every cell uses. The board is always a plain checkerboard (the
 * renderer picks light or dark by parity); this only decides which pair that parity indexes.
 *
 * Either motifs (X, O, starburst...) are placed on a lattice, or one overlay (ripple, sweep,
 * ramp) covers the whole board. Never both, since they would fight over the same cells.
 */
export function buildCheckerGrid({ colours, random, width, height }: GeneratorInput): CheckerGrid {
	const pairs = buildColourPairs(colours, random);
	const motifPairCount = pairs.length - 1;
	const cell = [56, 64, 72][Math.floor(random() * 3)]!;
	const columns = oddCeil(width / cell) + 2;
	const rows = oddCeil(height / cell) + 2;
	const centreColumn = (columns - 1) / 2;
	const centreRow = (rows - 1) / 2;

	const useOverlay = random() < 0.35;
	const overlay: OverlayFn = OVERLAYS[OVERLAY_NAMES[Math.floor(random() * OVERLAY_NAMES.length)]!];

	/* Motif lattice */
	const radius = 2 + Math.floor(random() * 3);
	const spacing = radius * 2 + 1 + 1 + Math.floor(random() * 3);
	const halfDrop = random() < 0.5;
	const motifs: MotifFn[] = shuffle(MOTIF_NAMES, random)
		.slice(0, 1 + Math.floor(random() * 3))
		.map((name) => MOTIFS[name]);
	const assignment: Assignment = motifs.length === 1 ? 'single' : random() < 0.5 ? 'alternate' : 'rows';

	const motifLayerAt = (dx: number, dy: number): number => {
		// Motifs fit between rows (spacing > 2 * radius), so the nearest lattice row is unique.
		const latticeRow = Math.round(dy / spacing);
		const shift = halfDrop && positiveModulo(latticeRow, 2) === 1 ? Math.round(spacing / 2) : 0;
		const latticeColumn = Math.round((dx - shift) / spacing);
		const localX = dx - (latticeColumn * spacing + shift);
		const localY = dy - latticeRow * spacing;
		if (Math.max(Math.abs(localX), Math.abs(localY)) > radius) return 0;
		const motif = motifs[positiveModulo(assignment === 'rows' ? latticeRow : latticeColumn + latticeRow, motifs.length)]!;
		const tone = motif(localX, localY, radius);
		return tone === undefined ? 0 : 1 + positiveModulo(tone, motifPairCount);
	};

	const layers = Array.from({ length: rows }, (_, row) =>
		Array.from({ length: columns }, (_, column) => {
			const dx = column - centreColumn;
			const dy = row - centreRow;
			return useOverlay ? overlay(dx, dy, pairs.length, columns) : motifLayerAt(dx, dy);
		})
	);

	return {
		cell,
		columns,
		rows,
		originX: (width - columns * cell) / 2,
		originY: (height - rows * cell) / 2,
		pairs,
		layers
	};
}

/** SVG markup for a grid: one square per cell, light or dark by parity within its pair. */
export function renderCheckerGrid({ cell, originX, originY, pairs, layers }: CheckerGrid): string {
	return layers
		.flatMap((rowLayers, row) =>
			rowLayers.map((layer, column) => {
				const fill = pairs[layer]![(row + column) % 2]!;
				// Overlap neighbours by half a unit to hide anti-aliasing seams.
				return `<rect x="${round(originX + column * cell)}" y="${round(originY + row * cell)}" width="${cell + 0.5}" height="${cell + 0.5}" fill="${fill}"/>`;
			})
		)
		.join('');
}

/**
 * A solid checkerboard whose colours form patterns: motifs such as X, O and starbursts, or
 * board-wide ripples and sweeps. Cells are always plain squares; see `buildCheckerGrid`.
 */
export function checkerboardArt(input: GeneratorInput): string {
	const grid = buildCheckerGrid(input);
	const background = `<rect width="${input.width}" height="${input.height}" fill="${grid.pairs[0]![0]}"/>`;
	return background + renderCheckerGrid(grid);
}
