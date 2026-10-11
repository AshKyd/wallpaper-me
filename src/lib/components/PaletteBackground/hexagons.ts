import { round, type GeneratorInput } from './canvas.js';
import { colourDistance, luminance, mixHex } from './paletteUtils.js';

export interface HexCell {
	/** Axial coordinates, relative to the cell at the canvas centre. */
	q: number;
	r: number;
	/** Centre in canvas units. */
	x: number;
	y: number;
	/** Position of the cell's colour in `HexGrid.cycle`. */
	index: number;
	/** The cell's one solid colour. */
	colour: string;
}

export interface HexGrid {
	/** Distance from a hexagon's centre to its corners, in canvas units. */
	size: number;
	cells: HexCell[];
	/** Palette colours in a loop where each is followed by a similar one; the pattern steps through it. */
	cycle: string[];
	/** Cycle steps per axial step: `index = (across * q + down * r + offset) mod cycle.length`. */
	across: number;
	down: number;
}

/** Most space a hexagon can give up for borders, as a share of its size. Beyond this they vanish. */
export const MAX_GAP = 0.4;

/**
 * Fewest colours the cycle needs. With five, there are step pairs that keep every neighbour a
 * different colour yet only one or two places apart in the cycle (so, similar). Palettes with
 * fewer are topped up with blends (below).
 */
const MIN_CYCLE_COLOURS = 5;

/** Most colours whose best loop is found by trying every order; beyond this, nearest-first is used. */
const EXACT_LOOP_LIMIT = 8;

/** Every ordering of `items`, as arrays. */
function permutations<T>(items: T[]): T[][] {
	if (items.length <= 1) return [items];
	return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}

/** Total distance round a loop of colours, including the step from the last back to the first. */
const loopLength = (loop: string[]) => loop.reduce((sum, colour, index) => sum + colourDistance(colour, loop[(index + 1) % loop.length]!), 0);

/**
 * Palette colours (made distinct, and topped up to `MIN_CYCLE_COLOURS` by blending the two
 * colours furthest apart) arranged in a loop where each colour sits next to similar ones.
 *
 * The loop is the shortest round trip through the colours, so stepping through it moves between
 * similar colours. The most prominent colour comes first. A palette of blues and oranges still has
 * to jump between them, but only twice per loop.
 */
export function cycleOf(colours: GeneratorInput['colours']): string[] {
	const hexes = colours.map(({ hex }) => hex).filter((hex, index, all) => all.indexOf(hex) === index);
	const sorted = [...hexes].sort((a, b) => luminance(a) - luminance(b));
	const start = sorted.length > 1 ? sorted : [sorted[0]!, mixHex(sorted[0]!, '#ffffff', 0.35)];
	const padded = Array.from({ length: Math.max(0, MIN_CYCLE_COLOURS - start.length) }).reduce<string[]>((ramp) => {
		const gaps = ramp.slice(1).map((colour, index) => ({ index, distance: colourDistance(ramp[index]!, colour) }));
		const widest = gaps.reduce((best, gap) => (gap.distance > best.distance ? gap : best));
		return ramp.toSpliced(widest.index + 1, 0, mixHex(ramp[widest.index]!, ramp[widest.index + 1]!, 0.5));
	}, start);

	// Lead with the most prominent colour (first in the palette), when it survived the clean-up.
	const lead = hexes[0] && padded.includes(hexes[0]) ? hexes[0] : padded[0]!;
	const others = padded.filter((colour) => colour !== lead);
	if (others.length + 1 > EXACT_LOOP_LIMIT) {
		return others.reduce<string[]>(
			(loop) => {
				const remaining = others.filter((colour) => !loop.includes(colour));
				const nearest = remaining.reduce((best, colour) => (colourDistance(loop.at(-1)!, colour) < colourDistance(loop.at(-1)!, best) ? colour : best));
				return [...loop, nearest];
			},
			[lead]
		);
	}
	return permutations(others)
		.map((order) => [lead, ...order])
		.reduce((best, loop) => (loopLength(loop) < loopLength(best) ? loop : best));
}

/** Distance between two positions on a loop of `length`, going whichever way is shorter. */
const loopDistance = (steps: number, length: number) => {
	const wrapped = ((steps % length) + length) % length;
	return Math.min(wrapped, length - wrapped);
};

/**
 * Step pairs `[across, down]` for a loop of `length` colours, best first. A hexagon at `(q, r)`
 * takes loop position `across * q + down * r + offset`. Its six neighbours are one step along
 * `(1, 0)`, `(0, 1)` or `(1, -1)` either way, so they differ in position by `across`, `down` or
 * `across - down`. A pair is allowed only if none of those is zero (so no edge matches), and pairs
 * with the smallest total loop distance come first, so neighbours are as similar as possible.
 */
export function stepPairs(length: number): [number, number][] {
	const options = Array.from({ length: length - 1 }, (_, index) => index + 1).flatMap((across) =>
		Array.from({ length: length - 1 }, (_, index) => index + 1)
			.filter((down) => loopDistance(across - down, length) > 0)
			.map((down): [number, number] => [across, down])
	);
	const cost = ([across, down]: [number, number]) =>
		loopDistance(across, length) + loopDistance(down, length) + loopDistance(across - down, length);
	const best = Math.min(...options.map(cost));
	return options.filter((pair) => cost(pair) === best);
}

/**
 * Lays out a hexagonal grid in a repeating colour pattern where no two hexagons that share an
 * edge are the same colour.
 *
 * - Colours go in a loop where each is followed by a similar one (`cycleOf`). A hexagon takes loop
 *   position `across * q + down * r + offset`, so the pattern repeats exactly every few hexagons,
 *   in diagonal runs of gradually changing colour. Every colour appears evenly all over the canvas,
 *   so no colour gets stuck in a corner.
 * - `stepPairs` picks steps where no neighbour matches and neighbours are as similar as the loop
 *   allows. The seed picks between equally good pairs, the loop's direction and the offset.
 *
 * Hexagons sit on a grid centred on the canvas, so any crop is symmetrical, and they run past the
 * edges so the pattern looks cropped rather than framed.
 */
export function buildHexGrid({ colours, random, width, height }: GeneratorInput): HexGrid {
	const baseCycle = cycleOf(colours);
	// Run the loop backwards half the time so the pattern isn't always mirrored the same way.
	const cycle = random() < 0.5 ? baseCycle : [baseCycle[0]!, ...baseCycle.slice(1).reverse()];
	const options = stepPairs(cycle.length);
	const [across, down] = options[Math.floor(random() * options.length)]!;
	const offset = Math.floor(random() * cycle.length);
	const size = [44, 56, 68][Math.floor(random() * 3)]!;
	const cellWidth = size * Math.sqrt(3);
	const rowHeight = size * 1.5;
	const margin = size * 1.5;
	const centreX = width / 2;
	const centreY = height / 2;

	/* Cells covering the canvas */
	const rowsEachSide = Math.ceil((height / 2 + margin) / rowHeight);
	const reach = (width / 2 + margin) / cellWidth;
	const cells = Array.from({ length: rowsEachSide * 2 + 1 }, (_, index) => index - rowsEachSide).flatMap((r) =>
		// Row r is shifted half a cell per step down, so its columns start further left or right.
		Array.from({ length: Math.floor(reach * 2) + 3 }, (_, index) => Math.ceil(-reach - r / 2) + index)
			.filter((q) => Math.abs(q + r / 2) <= reach)
			.map((q): HexCell => {
				const index = (((across * q + down * r + offset) % cycle.length) + cycle.length) % cycle.length;
				return {
					q,
					r,
					x: centreX + cellWidth * (q + r / 2),
					y: centreY + rowHeight * r,
					index,
					colour: cycle[index]!
				};
			})
	);

	return { size, cells, cycle, across, down };
}

/** Corners of a pointy-topped hexagon, as an SVG `points` value. */
const hexagonPoints = (x: number, y: number, radius: number) =>
	Array.from({ length: 6 }, (_, corner) => {
		const angle = (Math.PI / 3) * corner - Math.PI / 2;
		return `${round(x + radius * Math.cos(angle))},${round(y + radius * Math.sin(angle))}`;
	}).join(' ');

/**
 * SVG markup for a grid: one solid hexagon per cell. `gap` (0 to `MAX_GAP`) shrinks each hexagon
 * by that share of its size, leaving a border between them.
 */
export function renderHexGrid({ size, cells }: HexGrid, gap = 0): string {
	const radius = size * (1 - Math.min(MAX_GAP, Math.max(0, gap)));
	return cells
		.map(({ x, y, colour }) => {
			// Without a gap, a same-colour hairline hides anti-aliasing seams between neighbours.
			const seam = gap > 0 ? '' : ` stroke="${colour}" stroke-width="0.8" stroke-linejoin="round"`;
			return `<polygon points="${hexagonPoints(x, y, radius)}" fill="${colour}"${seam}/>`;
		})
		.join('');
}

/**
 * Hexagons in a hexagonal grid in a repeating colour pattern where no two edges match (see `buildHexGrid`). `gap` adds
 * optional borders; they show the darkest palette colour, deepened a little so it reads as grout.
 */
export function hexagonsArt(input: GeneratorInput): string {
	const grid = buildHexGrid(input);
	const gap = input.gap ?? 0;
	const darkest = [...grid.cycle].sort((a, b) => luminance(a) - luminance(b))[0]!;
	const backdrop = gap > 0 ? mixHex(darkest, '#000000', 0.25) : grid.cells[0]?.colour ?? darkest;
	return `<rect width="${input.width}" height="${input.height}" fill="${backdrop}"/>${renderHexGrid(grid, gap)}`;
}
