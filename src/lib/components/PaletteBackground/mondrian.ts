import { round, type GeneratorInput } from './canvas.js';
import { colourDistance, luminance, shuffle } from './paletteUtils.js';

/** Smallest a block can be on either side. Splits keep both halves at least this big, so there are no slivers. */
export const MIN_BLOCK = 80;
/** Split lines sit on multiples of this, in canvas units, so lines in different blocks line up. */
export const GRID = 40;
/** Thickness of the dividing lines with no border setting (`gap` 0), in canvas units. */
export const BASE_LINE_WIDTH = 10;
/** How much thicker the lines get per unit of `gap` (0 to 0.4), so the thickest is 24. */
const LINE_WIDTH_PER_GAP = 35;

/** The `gap` setting is the border: here it thickens the lines. Unlike the other variants it needs no re-layout. */
export const lineWidthFor = (gap: number) => BASE_LINE_WIDTH + Math.max(0, gap) * LINE_WIDTH_PER_GAP;
/** The only colour not taken from the palette. Tones map it to their darkest allowed value. */
const LINE_COLOUR = '#000000';
/** Share of blocks that get a colour; the rest stay in the ground colour. */
const COLOURED_SHARE = 0.35;
/** Blocks are never left whole until they have been split at least this many times, so the canvas isn't a few huge blocks. */
const MIN_DEPTH = 3;
/** Past `MIN_DEPTH`, a block's chance of being left whole is this plus `STOP_PER_LEVEL` for each cut so far. Low, so the canvas stays dense. */
const BASE_STOP_CHANCE = 0.05;
const STOP_PER_LEVEL = 0.06;

export interface Block {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A straight divider, from one end to the other. Horizontal or vertical. */
export interface Divider {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface MondrianLayout {
	blocks: Block[];
	dividers: Divider[];
}

/** Multiples of `GRID` that leave at least `MIN_BLOCK` on each side of the split. Empty when the block is too tight for a grid line. */
function splitPositions(start: number, size: number): number[] {
	const first = Math.ceil((start + MIN_BLOCK) / GRID);
	const last = Math.floor((start + size - MIN_BLOCK) / GRID);
	return Array.from({ length: Math.max(0, last - first + 1) }, (_, step) => (first + step) * GRID);
}

/**
 * Cuts a block in two, again and again, into the blocks and dividing lines of the whole canvas.
 *
 * Why this shape: Mondrian's paintings are a few big blocks and a few small ones, split along lines that
 * run the full width of a block. Cutting the longer side keeps blocks from getting long and thin. Each cut
 * is on the grid (so lines in neighbouring blocks align), and past `MIN_DEPTH` there is a rising chance to
 * stop, which leaves blocks of very different sizes.
 */
export function layoutBlocks({ block, random, depth = 0 }: { block: Block; random: () => number; depth?: number }): MondrianLayout {
	const { x, y, width, height } = block;
	const acrossPositions = splitPositions(x, width);
	const downPositions = splitPositions(y, height);
	const canSplitAcross = width >= MIN_BLOCK * 2;
	const canSplitDown = height >= MIN_BLOCK * 2;

	if (!canSplitAcross && !canSplitDown) return { blocks: [block], dividers: [] };
	if (depth >= MIN_DEPTH && random() < BASE_STOP_CHANCE + depth * STOP_PER_LEVEL) return { blocks: [block], dividers: [] };

	// Wide blocks are mostly cut across (into side-by-side blocks), tall ones mostly down.
	const preferAcross = width >= height;
	const cutAcross = canSplitAcross && (!canSplitDown || random() < (preferAcross ? 0.75 : 0.25));
	const candidates = cutAcross ? acrossPositions : downPositions;
	const start = cutAcross ? x : y;
	const size = cutAcross ? width : height;
	// A block too tight for a grid line is cut down the middle.
	const position = candidates.length > 0 ? candidates[Math.floor(random() * candidates.length)]! : start + size / 2;

	const [first, second]: [Block, Block] = cutAcross
		? [
				{ x, y, width: position - x, height },
				{ x: position, y, width: x + width - position, height }
			]
		: [
				{ x, y, width, height: position - y },
				{ x, y: position, width, height: y + height - position }
			];
	const divider: Divider = cutAcross ? { x1: position, y1: y, x2: position, y2: y + height } : { x1: x, y1: position, x2: x + width, y2: position };

	const [left, right] = [first, second].map((half) => layoutBlocks({ block: half, random, depth: depth + 1 }));
	return {
		blocks: [...left!.blocks, ...right!.blocks],
		dividers: [divider, ...left!.dividers, ...right!.dividers]
	};
}

/** A divider as a rectangle, extended half a line at each end so lines overlap cleanly where they meet. */
function dividerMarkup({ x1, y1, x2, y2 }: Divider, lineWidth: number, fill: string): string {
	const half = lineWidth / 2;
	const vertical = x1 === x2;
	return vertical
		? `<rect x="${round(x1 - half)}" y="${round(y1 - half)}" width="${round(lineWidth)}" height="${round(y2 - y1 + lineWidth)}" fill="${fill}"/>`
		: `<rect x="${round(x1 - half)}" y="${round(y1 - half)}" width="${round(x2 - x1 + lineWidth)}" height="${round(lineWidth)}" fill="${fill}"/>`;
}

/**
 * Mondrian-style art: a light ground cut into blocks by thick black lines, with some blocks in palette colours.
 *
 * It uses the palette's own colours and one addition, black, for the lines. Nothing is mixed or tinted, so
 * the palette keeps its character. The ground is the palette's lightest colour. Colour blocks come from a
 * shuffled deck of the other colours, preferring those that stand out from the ground, so they repeat as
 * little as possible. Every colour is a plain hex, so the tones recolour it like the other variants.
 */
export function mondrianArt({ colours, random, width, height, gap = 0 }: GeneratorInput): string {
	const hexes = colours.map(({ hex }) => hex);
	const ground = [...hexes].sort((a, b) => luminance(b) - luminance(a))[0]!;

	const { blocks, dividers } = layoutBlocks({ block: { x: 0, y: 0, width, height }, random });

	// Colours too close to the ground would vanish. If that leaves none, use any other colour, and for a
	// one-colour palette (no other colour exists) the ground itself.
	const others = hexes.filter((hex) => hex !== ground);
	const standOut = others.filter((hex) => colourDistance(hex, ground) > 0.18);
	const deck = shuffle(standOut.length > 0 ? standOut : others.length > 0 ? others : hexes, random);
	const colouredCount = Math.max(1, Math.round(blocks.length * COLOURED_SHARE));
	const coloured = shuffle(blocks, random).slice(0, colouredCount);

	const fills = coloured.map(
		({ x, y, width: blockWidth, height: blockHeight }, index) =>
			`<rect x="${round(x)}" y="${round(y)}" width="${round(blockWidth)}" height="${round(blockHeight)}" fill="${deck[index % deck.length]}"/>`
	);
	return [`<rect width="${width}" height="${height}" fill="${ground}"/>`, ...fills, ...dividers.map((divider) => dividerMarkup(divider, lineWidthFor(gap), LINE_COLOUR))].join('');
}
