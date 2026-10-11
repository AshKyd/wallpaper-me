import { round, type GeneratorInput } from './canvas.js';
import type { DepthItem, SizeRange } from './depth.js';
import { depthLayers } from './depthLayers.js';
import { luminance } from './paletteUtils.js';
import { packCircles } from './packing.js';

export const SHAPE_KINDS = ['square', 'triangle', 'x', 'line', 'squiggle'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Shapes that can be filled as well as drawn as an outline. The rest are lines already. */
const FILLABLE: readonly ShapeKind[] = ['square', 'triangle'];

/**
 * Packing: every shape is drawn inside a circle of its `radius`, and the circles are packed so none touch.
 * Smallest radius, extra radius the largest circles add on top, tries (for a 1200 x 800 canvas; more tries
 * fill more gaps), and the space left between circles. The space covers the strokes, which spill a little
 * past a shape's circle, and a doubled line's second copy.
 */
export const PACKING = { minRadius: 16, maxRadius: 80, attempts: 30000, gap: 16 } as const;
/** The radii packing produces, which is the size range used to put shapes in depth for parallax. */
const SIZE_RANGE: SizeRange = { smallest: PACKING.minRadius, largest: PACKING.minRadius + PACKING.maxRadius };

/**
 * A shape is drawn this share of its circle's radius, not all of it, so the points of triangles and the ends of
 * crosses and lines (which reach the circle's edge) leave clear space to the next shape.
 */
export const SHAPE_SCALE = 0.88;

/** Radius, as a share of the extra radius `PACKING` allows, at which a circle counts as a big one. Few circles get this big. */
const BIG_SHARE = 0.55;

/**
 * How likely each kind is for a circle of a given `size`, 0 (the smallest) to 1 (a big one). Squares and
 * triangles are solid shapes that suit big circles; lines and crosses are thin, so they are kept for the small
 * ones, where a long stroke would look oversized. Squiggles are in between.
 */
export const kindWeights = (size: number): Record<ShapeKind, number> => ({
	square: 1 + 3 * size,
	triangle: 1 + 3 * size,
	x: 3 - 2.5 * size,
	line: 3 - 2.5 * size,
	squiggle: 1.5
});
/** Share of the fillable shapes that are filled, not outlined. */
export const FILLED_SHARE = 0.5;
/** Kinds that can be drawn twice: only the plain lines. A doubled triangle, square or cross just looks like a mistake. */
export const DOUBLEABLE: readonly ShapeKind[] = ['line', 'squiggle'];
/** Share of the doubleable shapes that are drawn twice. Rare, so a double line stands out. */
export const DOUBLE_SHARE = 0.1;
export const STROKE_WIDTH = 6;
/** Distance between a doubled line and its copy, in stroke widths. */
const DOUBLE_OFFSET = 2.2;
/** Half-waves in a squiggle, and how tall they are as a share of the shape's radius. */
export const SQUIGGLE_WAVES = 3;
/** Low, so the curve stays near its straight line and neighbouring squiggles do not run into each other. */
export const SQUIGGLE_HEIGHT = 0.16;

export interface Shape {
	kind: ShapeKind;
	x: number;
	y: number;
	/** Radius of the circle the shape fits inside. */
	radius: number;
	/** Degrees. */
	rotation: number;
	colour: string;
	filled: boolean;
	/** An outlined shape drawn a second time, beside the first. */
	doubled: boolean;
}

/**
 * The background is the palette's darkest colour; the shapes use the rest. A one-colour palette has nothing
 * left over, so it draws in white.
 */
export function splitColours(colours: GeneratorInput['colours']): { background: string; foregrounds: string[] } {
	const byDarkness = colours.map(({ hex }) => hex).sort((a, b) => luminance(a) - luminance(b));
	const [background = '#000000', ...rest] = byDarkness;
	return { background, foregrounds: rest.length > 0 ? rest : ['#ffffff'] };
}

/**
 * Places shapes by packing circles (largest first, so big shapes anchor the layout and small ones fill the
 * gaps), then giving each circle a random kind, turn and colour. Because each shape stays inside its own circle
 * and the circles never touch, shapes cannot collide however they turn, and the canvas ends up tightly filled.
 */
export function layoutShapes({ colours, random, width, height }: Pick<GeneratorInput, 'colours' | 'random' | 'width' | 'height'>): { background: string; shapes: Shape[] } {
	const { background, foregrounds } = splitColours(colours);
	const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;

	const shapes = packCircles({ random, width, height, ...PACKING }).map(({ x, y, radius }): Shape => {
		const size = Math.min(1, (radius - PACKING.minRadius) / (PACKING.maxRadius * BIG_SHARE));
		const weights = kindWeights(size);
		const total = SHAPE_KINDS.reduce((sum, name) => sum + weights[name], 0);
		// Walk the kinds, taking away each one's weight until the random point falls inside one.
		const kind = SHAPE_KINDS.reduce<{ left: number; found?: ShapeKind }>(
			({ left, found }, name) => (found ? { left, found } : left < weights[name] ? { left, found: name } : { left: left - weights[name] }),
			{ left: random() * total }
		).found!;
		const filled = FILLABLE.includes(kind) && random() < FILLED_SHARE;
		return { kind, x, y, radius, rotation: random() * 360, colour: pick(foregrounds), filled, doubled: DOUBLEABLE.includes(kind) && random() < DOUBLE_SHARE };
	});

	return { background, shapes };
}

/** A point, as `[x, y]`. */
type Point = readonly [number, number];
/** Turns a point of a shape (centred on the origin) into the text of its final place on the canvas. */
type Place = (point: Point) => string;
/** Leaves points where they are, only rounded. */
const inPlace: Place = ([x, y]) => `${round(x)} ${round(y)}`;

/**
 * A shape as SVG, no further than `radius` from `(0, 0)`, so it fits its packed circle however it is turned.
 * `place` maps each point to its final text: the default keeps it at the origin, and `shapeMarkup()` turns and
 * moves it to its spot on the canvas, so shapes are drawn at their final coordinates, not through a `transform`.
 * That is cheaper to render, and cheaper still for the parallax layers, which are each moved as one piece.
 */
export function shapeGeometry(kind: ShapeKind, radius: number, place: Place = inPlace): { tag: 'polygon' | 'path'; attributes: string } {
	const polygon = (points: Point[]) => ({ tag: 'polygon' as const, attributes: `points="${points.map(place).join(', ')}"` });
	const path = (d: string) => ({ tag: 'path' as const, attributes: `d="${d}"` });
	// The corners of a square reach the circle, so its half-side is the radius over root two.
	const arm = radius / Math.SQRT2;
	if (kind === 'square') return polygon([[-arm, -arm], [arm, -arm], [arm, arm], [-arm, arm]]);
	// Equilateral, with its three corners on the circle.
	if (kind === 'triangle') return polygon([[0, -radius], [radius * Math.cos(Math.PI / 6), radius / 2], [-radius * Math.cos(Math.PI / 6), radius / 2]]);
	if (kind === 'x') return path(`M ${place([-arm, -arm])} L ${place([arm, arm])} M ${place([arm, -arm])} L ${place([-arm, arm])}`);
	if (kind === 'line') return path(`M ${place([-radius, 0])} L ${place([radius, 0])}`);
	// A squiggle: one curve, then each following half-wave is a smooth `T` that mirrors the one before.
	const [wave, lift] = [(radius * 2) / SQUIGGLE_WAVES, radius * SQUIGGLE_HEIGHT];
	const rest = Array.from({ length: SQUIGGLE_WAVES - 1 }, (_, index) => `T ${place([-radius + wave * (index + 2), 0])}`);
	return path(`M ${place([-radius, 0])} Q ${place([-radius + wave / 2, -lift * 2])} ${place([-radius + wave, 0])} ${rest.join(' ')}`);
}

/** How far a doubled shape's two copies sit either side of its centre. */
const DOUBLE_SHIFT = (STROKE_WIDTH * DOUBLE_OFFSET) / 2;

/**
 * The furthest any paint of a shape can reach from its circle's centre, counting the stroke's thickness and a
 * double's shift as if they added to the shape's reach in the same direction (the worst case).
 * It is no more than half the `PACKING.gap` past the circle, so two shapes never meet.
 */
export const reachOf = ({ radius, filled, doubled }: Pick<Shape, 'radius' | 'filled' | 'doubled'>) =>
	radius * SHAPE_SCALE + (filled ? 0 : STROKE_WIDTH / 2) + (doubled ? DOUBLE_SHIFT : 0);

/**
 * One shape as SVG: filled solid, or an outline with round ends, turned about its own centre. A double is two
 * copies either side of the centre. Points are turned and moved here, so the markup has no `transform`.
 */
function shapeMarkup({ kind, x, y, radius, rotation, colour, filled, doubled }: Shape): string {
	const [cos, sin] = [Math.cos((rotation * Math.PI) / 180), Math.sin((rotation * Math.PI) / 180)];
	const paint = filled ? `fill="${colour}"` : `fill="none" stroke="${colour}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"`;
	// `offset` slides a copy sideways (before the turn), for the two halves of a double.
	const copy = (offset: number) => {
		const place: Place = ([px, py]) => inPlace([x + px * cos - (py + offset) * sin, y + px * sin + (py + offset) * cos]);
		const { tag, attributes } = shapeGeometry(kind, radius * SHAPE_SCALE, place);
		return `<${tag} ${attributes} ${paint}/>`;
	};
	return doubled ? copy(-DOUBLE_SHIFT) + copy(DOUBLE_SHIFT) : copy(0);
}

/**
 * An 80s-style pastiche: squares, triangles, crosses, lines and squiggles packed tightly over the darkest
 * colour, at random angles, in the rest of the palette. Squares and triangles are filled or outlined; the
 * others are lines. A few lines are doubled. With parallax, shapes split into depth layers by the size of their
 * circle (bigger is nearer), like `circles`; the background stays put.
 */
export function eightiesArt(input: GeneratorInput): string {
	const { background, shapes } = layoutShapes(input);
	const items = shapes.map((shape): DepthItem => ({ markup: shapeMarkup(shape), size: shape.radius }));
	const layers = depthLayers({ items, range: SIZE_RANGE, settings: input.depth });
	return `<rect width="${input.width}" height="${input.height}" fill="${background}"/>${layers}`;
}
