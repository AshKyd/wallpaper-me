import type { GeneratorInput } from './canvas.js';
import { shuffle } from './paletteUtils.js';

/** Cell widths a board picks from, in canvas units. Every cell is twice as tall as it is wide. Whole numbers, so every edge, and the arc and triangle points, land on whole units. */
export const CELL_WIDTHS: readonly number[] = [80, 100, 120];
/** A whole unit added to each cell's ground rectangle, so anti-aliasing leaves no seams between cells. */
const SEAM_OVERLAP = 1;

export type CellShape = 'arc' | 'triangle';
export type CellFacing = 'left' | 'right';

export interface Cell {
	row: number;
	column: number;
	shape: CellShape;
	/** The way the arc bulges, or the triangle points. */
	facing: CellFacing;
	ground: string;
	ink: string;
}

export interface CellBoard {
	/** Width of one cell; its height is twice this. */
	width: number;
	columns: number;
	rows: number;
	/** Top-left of the grid, so it is centred and any crop is symmetrical. */
	originX: number;
	originY: number;
	cells: Cell[];
}

const pick = <T>(items: readonly T[], random: () => number) => items[Math.floor(random() * items.length)]!;

/**
 * How many places along the colour order a cell's ink sits from its ground, for a palette of `count` colours.
 *
 * Why: a cell's position is `column + row`, so its left and upper neighbours are one place back. Their ink
 * is `gap - 1` places ahead of this cell's ground, and this cell's ink is `gap + 1` places ahead of their
 * ground. Neither is a match unless the gap is 0, 1 or `count - 1`, so any other gap keeps every join between
 * a ground and a shape two different colours. The smallest such gap is used. Palettes of three or fewer have
 * none, and use 1 (the next colour), where a clash cannot be avoided.
 */
export function inkGapFor(count: number): number {
	if (count < 2) return 0;
	return Array.from({ length: count }, (_, gap) => gap).find((gap) => gap > 1 && gap < count - 1) ?? 1;
}

/**
 * Divides the canvas into a grid of 1 x 2 cells (one wide, two tall). Every cell holds the same shape, a half-disc
 * arc or a triangle, facing the same way (left or right), chosen once per seed. Each cell has two colours: a ground and an ink. Both come from the palette and differ,
 * so the shape is always visible. A one-colour palette draws its ink in black.
 *
 * Colours follow a fixed pattern, not chance: the palette (in a seeded order) repeats in diagonals across the
 * grid, with the ink a set number of places along from the ground (see `inkGapFor()`). A cell's ground is then
 * never the ink of its left or upper neighbour, and its ink is never their ground, where the palette has four
 * or more colours. So a join between a ground and a shape is never one solid colour.
 */
export function layoutCells({ colours, random, width, height }: Pick<GeneratorInput, 'colours' | 'random' | 'width' | 'height'>): CellBoard {
	const cellWidth = pick(CELL_WIDTHS, random);
	const cellHeight = cellWidth * 2;
	// One spare cell each side, so the centred grid always covers the canvas.
	const columns = Math.ceil(width / cellWidth) + 2;
	const rows = Math.ceil(height / cellHeight) + 2;
	const hexes = colours.map(({ hex }) => hex);
	// One shape and one direction for the whole image: only the colours vary from cell to cell.
	const shape = pick<CellShape>(['arc', 'triangle'], random);
	const facing = pick<CellFacing>(['left', 'right'], random);

	// The seed only sets the order the colours repeat in; the pattern itself is fixed.
	const order = shuffle([...hexes], random);
	const inkGap = inkGapFor(order.length);
	const colourAt = (position: number) => order[position % order.length]!;

	// Position along the colour order is column + row, so each colour runs in a diagonal. The ink is `inkGap`
	// places further along. A one-colour palette inks in black.
	const cells = Array.from({ length: rows }, (_, row) =>
		Array.from({ length: columns }, (_, column): Cell => {
			const position = column + row;
			return { row, column, shape, facing, ground: colourAt(position), ink: order.length > 1 ? colourAt(position + inkGap) : '#000000' };
		})
	).flat();

	return { width: cellWidth, columns, rows, originX: Math.round((width - columns * cellWidth) / 2), originY: Math.round((height - rows * cellHeight) / 2), cells };
}

/**
 * A cell's shape with its top-left at `(x, y)`, flat against one tall edge and reaching the middle of the other.
 * The arc is a half disc as wide as the cell, so its diameter is the whole edge.
 */
export function shapeMarkup({ shape, facing, ink }: Pick<Cell, 'shape' | 'facing' | 'ink'>, { x, y, cellWidth }: { x: number; y: number; cellWidth: number }): string {
	const [w, h] = [cellWidth, cellWidth * 2];
	const [base, tip] = facing === 'right' ? [x, x + w] : [x + w, x];
	if (shape === 'triangle') return `<polygon points="${base},${y} ${base},${y + h} ${tip},${y + w}" fill="${ink}"/>`;
	// Sweeping clockwise from the top bulges right; anticlockwise bulges left.
	return `<path d="M ${base} ${y} A ${w} ${w} 0 0 ${facing === 'right' ? 1 : 0} ${base} ${y + h} Z" fill="${ink}"/>`;
}

/**
 * Mid-century modern as SVG: a ground rectangle per cell with its shape over it. Moves as one piece with parallax.
 *
 * The grid is placed with a single `translate` on one group, not one per shape: cells are drawn at their
 * position in the grid, so the renderer has one transform to apply instead of one for every cell.
 */
export function midcenturyArt(input: GeneratorInput): string {
	const { width: cellWidth, originX, originY, cells } = layoutCells(input);
	const cellHeight = cellWidth * 2;
	const backdrop = `<rect width="${input.width}" height="${input.height}" fill="${cells[0]?.ground ?? input.colours[0]!.hex}"/>`;
	const markup = cells.map((cell) => {
		const [x, y] = [cell.column * cellWidth, cell.row * cellHeight];
		return `<rect x="${x}" y="${y}" width="${cellWidth + SEAM_OVERLAP}" height="${cellHeight + SEAM_OVERLAP}" fill="${cell.ground}"/>${shapeMarkup(cell, { x, y, cellWidth })}`;
	});
	return `${backdrop}<g transform="translate(${originX} ${originY})">${markup.join('')}</g>`;
}
