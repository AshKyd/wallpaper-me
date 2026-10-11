import { splitBokehColours } from './bokeh.js';
import { round, type GeneratorInput } from './canvas.js';
import { hexToOklch, maxChroma, oklchToHex } from './oklch.js';
import { mixHex, randomBetween } from './paletteUtils.js';

export type Point = readonly [number, number];

/** What the rings look like. `sharp` is polygons with corners; `curve` is circles. */
export type LineStyle = 'sharp' | 'curve';

/** The smallest ring's radius, as a share of the canvas's shorter side. */
export const INNER_RADIUS_SHARE = 0.12;
/** Rings in a band, and the gap between neighbouring rings of a band, in canvas units. */
export const RINGS_PER_BAND: readonly [number, number] = [2, 5];
export const RING_SPACING: readonly [number, number] = [17, 26];
/** Empty space between one band and the next, in canvas units. */
export const BAND_GAP: readonly [number, number] = [34, 90];
/** Sides of a sharp ring (a triangle to a hexagon); a curved ring is a circle, sampled this many times. */
export const RING_SIDES: readonly number[] = [3, 4, 5, 6];
const CURVE_SAMPLES = 72;
/** How far past the canvas's corners the outer ring must reach, in canvas units. */
const REACH_MARGIN = 40;

/**
 * How a band's rings are broken up. `solid` is unbroken. `dashed` is short dashes. `dotted` is dots. `arcs`
 * is long pieces with gaps between, which hint at a ring without closing it. Every ring in a band shares its
 * pattern, but each is shifted along from the one inside it (see `PATTERN_SHIFT`), so the gaps wander round.
 */
export const BAND_PATTERNS = ['solid', 'dashed', 'dotted', 'arcs'] as const;
export type BandPattern = (typeof BAND_PATTERNS)[number];
/** How far, in canvas units, each ring's pattern is slid along from the ring inside it, either way. */
export const PATTERN_SHIFT: readonly [number, number] = [8, 40];

/**
 * How the rings are turned, picked once per picture.
 * - `aligned`: every ring faces the same way, so the polygons nest side to side.
 * - `alternate`: every other band is turned half a side, so corners face sides.
 * - `progressive`: each band is turned a little more than the one inside it (`BAND_TWIST`), so the bands spiral.
 * The last two also twist the rings within a band a little (`RING_TWIST`). A circle looks the same turned, but its
 * dashes start in a new place, so turning staggers a circle's pattern too.
 */
export const ROTATION_MODES = ['aligned', 'alternate', 'progressive'] as const;
export type RotationMode = (typeof ROTATION_MODES)[number];
/** Degrees each band is turned more than the last (progressive), and each ring more than the one inside it in its band, either way. */
export const BAND_TWIST: readonly [number, number] = [8, 24];
export const RING_TWIST: readonly [number, number] = [1, 6];

/**
 * How line thickness varies, picked once per picture. Thickness is a multiplier on the layers' widths.
 * - `even`: every ring the same, as drawn in `LAYERS` and `MAIN_WIDTH`.
 * - `banded`: each band has its own thickness, so some bands are fine and some bold.
 * - `tapered`: within a band, the rings go from thin to thick (or thick to thin), like a fan of strokes.
 * - `swelling`: rings get thicker as they go out from the middle (or thinner), as if seen in perspective.
 */
export const THICKNESS_MODES = ['even', 'banded', 'tapered', 'swelling'] as const;
export type ThicknessMode = (typeof THICKNESS_MODES)[number];
/** The thinnest and thickest a ring can be, as a multiplier. The thickest stays well under a ring's spacing, so neighbours do not merge. */
export const THICKNESS_RANGE: readonly [number, number] = [0.5, 2.2];

/** The layers, from the bottom: two blurred glows, then the true colour on top, which is not blurred. */
export const LAYERS = [
	{ name: 'outer', width: 16, blur: 14, opacity: 0.75, chromaBoost: 1.7, hueShift: 1 },
	{ name: 'inner', width: 9, blur: 5, opacity: 0.9, chromaBoost: 1.4, hueShift: -0.5 }
] as const;
/** Width of the main, unblurred line. */
export const MAIN_WIDTH = 4.5;
/** Most the glows' hue can turn from the true colour, in degrees. The two glows turn by different shares of it. */
export const MAX_HUE_SHIFT = 16;
/** Chroma a glow gets at the least, so a pale colour still glows in its hue. Colours that are nearly grey are left grey. */
const GLOW_MIN_CHROMA = 0.05;
const NEAR_GREY = 0.02;

/** One ring: its path, and how it is broken up. */
export interface Ring {
	d: string;
	/** Which band it is in, from the middle outwards. */
	band: number;
	/** Distance from the middle to the ring's sides (its radius, for a circle). */
	radius: number;
	pattern: BandPattern;
	/** How far the ring is turned, in radians. */
	turn: number;
	/** Multiplier on the layers' stroke widths. */
	thickness: number;
	/** `stroke-dasharray`; none for a solid ring. */
	dashes?: string;
	/** `stroke-dashoffset`, which slides the pattern round the ring. */
	dashOffset: number;
}

/** The rings, all round the middle of the canvas. */
export interface NeonRings {
	style: LineStyle;
	/** Sides of a sharp ring. */
	sides: number;
	rotation: RotationMode;
	thicknessMode: ThicknessMode;
	/** Middle of the rings: always the middle of the canvas. */
	centre: Point;
	rings: Ring[];
	/** Palette index the first ring starts from; the rings step through the lights. */
	colourStart: number;
	/** Degrees the glows' hue turns. */
	hueShift: number;
}

const pick = <T>(items: readonly T[], random: () => number) => items[Math.floor(random() * items.length)]!;
const between = (random: () => number, [low, high]: readonly [number, number]) => randomBetween(random, low, high);
const integerBetween = (random: () => number, [low, high]: readonly [number, number]) => low + Math.floor(random() * (high - low + 1));

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const text = ([x, y]: Point) => `${round(x)} ${round(y)}`;

/**
 * Closed SVG path data through the points. `sharp` joins them with straight lines, so corners stay sharp.
 * `curve` rounds them: each point becomes the control point of a quadratic curve between the midpoints either
 * side of it, which is smooth wherever the points are.
 */
export function ringPath(points: readonly Point[], style: LineStyle): string {
	if (style === 'sharp') return `M ${points.map(text).join(' L ')} Z`;
	const curves = points.map((point, index) => `Q ${text(point)} ${text(midpoint(point, points[(index + 1) % points.length]!))}`);
	return `M ${text(midpoint(points.at(-1)!, points[0]!))} ${curves.join(' ')} Z`;
}

/**
 * The points of a ring `radius` from the middle. A circle sampled `CURVE_SAMPLES` times, or a regular polygon
 * whose sides (not corners) are `radius` away, so rings of any shape are the same distance apart where they face
 * each other. The polygons all share a turn, so the rings are nested, side facing side.
 */
export function ringPoints({ style, centre, radius, sides, turn }: { style: LineStyle; centre: Point; radius: number; sides: number; turn: number }): Point[] {
	const count = style === 'sharp' ? sides : CURVE_SAMPLES;
	// A polygon's corners are further out than its sides by 1 / cos(half the angle one side covers).
	const reach = style === 'sharp' ? radius / Math.cos(Math.PI / sides) : radius;
	return Array.from({ length: count }, (_, index) => [centre[0] + Math.cos(turn + (index * 2 * Math.PI) / count) * reach, centre[1] + Math.sin(turn + (index * 2 * Math.PI) / count) * reach] as const);
}

/**
 * The dash pattern of a band, in canvas units: `[dash, gap]`, or none for a solid band. A dotted band uses a
 * dash of nearly nothing, so the round line caps make the dots.
 */
export function dashesFor(pattern: BandPattern, random: () => number): readonly [number, number] | undefined {
	if (pattern === 'solid') return undefined;
	if (pattern === 'dotted') return [0.1, randomBetween(random, 20, 36)];
	if (pattern === 'dashed') {
		const dash = randomBetween(random, 22, 60);
		return [dash, dash * randomBetween(random, 0.5, 1.1)];
	}
	return [randomBetween(random, 160, 420), randomBetween(random, 50, 130)];
}

/**
 * The whole composition: rings round the middle of the canvas, from a small one out past the corners, in bands.
 * Within a band the rings are close and evenly spaced; between bands there is a gap. Each band is solid, dashed,
 * dotted or long arcs, and each ring's pattern is slid along from the last, so the gaps wander round the band
 * instead of lining up. Rings and bands are also turned in a staggered way (see `ROTATION_MODES`), so polygons
 * interlace and circles start their dashes in different places. Nothing leaves the rings: it is one shape,
 * growing outwards from the centre.
 */
export function layoutNeon({ random, width, height }: Pick<GeneratorInput, 'random' | 'width' | 'height'>): NeonRings {
	const style = pick<LineStyle>(['sharp', 'curve'], random);
	const centre: Point = [width / 2, height / 2];
	const [sides, turn] = [pick(RING_SIDES, random), random() * Math.PI * 2];
	const rotation = pick(ROTATION_MODES, random);
	const [bandTwist, ringTwistSign] = [(random() < 0.5 ? -1 : 1) * radians(between(random, BAND_TWIST)), random() < 0.5 ? -1 : 1];
	const [thicknessMode, thicknessUp] = [pick(THICKNESS_MODES, random), random() < 0.5];
	const reach = Math.hypot(width, height) / 2 + REACH_MARGIN;

	// Bands, each starting where the one before ended and its gap passed, until a band's outer ring is past the reach.
	type Band = { radius: number; pattern: BandPattern; dashes?: readonly [number, number]; count: number; spacing: number; shift: number; ringTwist: number; thickness: number; taperUp: boolean };
	const grow = (bands: Band[], radius: number): Band[] => {
		const pattern = pick(BAND_PATTERNS, random);
		const band: Band = {
			radius,
			pattern,
			dashes: dashesFor(pattern, random),
			count: integerBetween(random, RINGS_PER_BAND),
			spacing: between(random, RING_SPACING),
			shift: between(random, PATTERN_SHIFT) * (random() < 0.5 ? -1 : 1),
			ringTwist: rotation === 'aligned' ? 0 : ringTwistSign * radians(between(random, RING_TWIST)),
			thickness: between(random, THICKNESS_RANGE),
			taperUp: random() < 0.5
		};
		const outer = radius + (band.count - 1) * band.spacing;
		return outer >= reach ? [...bands, band] : grow([...bands, band], outer + between(random, BAND_GAP));
	};
	const bands = grow([], Math.min(width, height) * INNER_RADIUS_SHARE);

	/** How far a band is turned: not at all, every other band half a side, or a little more than the band inside it. */
	const bandTurn = (band: number) => ({ aligned: 0, alternate: (band % 2) * (Math.PI / sides), progressive: band * bandTwist })[rotation];

	const outermost = bands.at(-1)!.radius + (bands.at(-1)!.count - 1) * bands.at(-1)!.spacing;
	const [thinnest, thickest] = THICKNESS_RANGE;
	const between01 = (share: number, up: boolean) => (up ? thinnest + (thickest - thinnest) * share : thickest - (thickest - thinnest) * share);
	/** A ring's thickness: the same everywhere, set by its band, tapering across its band, or swelling with its distance from the middle. */
	const thicknessOf = ({ thickness, taperUp, count }: Band, index: number, ringRadius: number) =>
		round(
			{
				even: 1,
				banded: thickness,
				tapered: between01(count > 1 ? index / (count - 1) : 0.5, taperUp),
				swelling: between01(ringRadius / outermost, thicknessUp)
			}[thicknessMode]
		);

	const rings = bands.flatMap((bandSettings, band) => {
		const { radius, pattern, dashes, count, spacing, shift, ringTwist } = bandSettings;
		return Array.from({ length: count }, (_, index): Ring => {
			const ringRadius = radius + index * spacing;
			// Each ring in a band is turned a little more than the one inside it, so the band fans out.
			const ringTurn = turn + bandTurn(band) + index * ringTwist;
			return {
				d: ringPath(ringPoints({ style, centre, radius: ringRadius, sides, turn: ringTurn }), style),
				band,
				radius: ringRadius,
				pattern,
				turn: ringTurn,
				thickness: thicknessOf(bandSettings, index, ringRadius),
				dashes: dashes && `${round(dashes[0])} ${round(dashes[1])}`,
				// Each ring is slid along from the one inside it, so the gaps do not line up.
				// (+ 0 turns a negative zero into zero.)
				dashOffset: round(index * shift) + 0
			};
		});
	});

	return { style, sides, rotation, thicknessMode, centre, rings, colourStart: Math.floor(random() * 1000), hueShift: (random() * 2 - 1) * MAX_HUE_SHIFT };
}

/* ------------------------------------------------------------------ */
/* Colour and drawing                                                  */
/* ------------------------------------------------------------------ */

/**
 * A glow colour: the colour with more chroma (to look lit from inside), and its hue turned a little, so the
 * halo is not an exact copy of the line. A nearly grey colour is left grey, as boosting its chroma would
 * give it a hue it never had.
 */
export function glowColour(hex: string, { chromaBoost, hueTurn }: { chromaBoost: number; hueTurn: number }): string {
	const { lightness, chroma, hue } = hexToOklch(hex);
	if (chroma < NEAR_GREY) return hex;
	const turned = (hue + hueTurn + 360) % 360;
	return oklchToHex({ lightness, chroma: Math.min(maxChroma(lightness, turned), Math.max(GLOW_MIN_CHROMA, chroma * chromaBoost)), hue: turned });
}

/**
 * Neon rings over a dark gradient. The darkest colours make the background; the rest colour the rings. The
 * rings are drawn three times, in three layers: a wide, very blurred glow, a narrower, less blurred one (both
 * with more chroma and a hue turned a little), and the true colour on top, sharp. Each layer is one group with
 * one blur filter, not a filter per ring. Moves as one piece with parallax.
 */
export function neonArt(input: GeneratorInput): string {
	const { idPrefix, width, height } = input;
	const { background, lights } = splitBokehColours(input.colours.map(({ hex }) => hex));

	const groundId = `${idPrefix}-neon-ground`;
	const [groundFrom, groundTo = mixHex(groundFrom!, '#000000', 0.45)] = background;
	const blurId = (name: string) => `${idPrefix}-neon-${name}`;
	// A filter's region is the whole canvas and a margin, as the glow reaches past the lines.
	const defs = [
		`<linearGradient id="${groundId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="${height}"><stop offset="0" stop-color="${groundFrom}"/><stop offset="1" stop-color="${groundTo}"/></linearGradient>`,
		...LAYERS.map(
			({ name, blur }) =>
				`<filter id="${blurId(name)}" filterUnits="userSpaceOnUse" x="-100" y="-100" width="${width + 200}" height="${height + 200}"><feGaussianBlur stdDeviation="${blur}"/></filter>`
		)
	].join('');

	const neon = layoutNeon(input);
	/** Every ring, drawn in one colour treatment, at the layer's stroke width times the ring's own thickness. */
	const ringsOf = (strokeWidth: number, colourOf: (hex: string) => string) =>
		neon.rings
			.map(({ d, dashes, dashOffset, thickness }, index) => {
				const colour = colourOf(lights[(neon.colourStart + index) % lights.length]!);
				const broken = dashes ? ` stroke-dasharray="${dashes}" stroke-dashoffset="${dashOffset}"` : '';
				return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${round(strokeWidth * thickness)}" stroke-linecap="round" stroke-linejoin="round"${broken}/>`;
			})
			.join('');

	const glows = LAYERS.map(
		({ name, width: strokeWidth, opacity, chromaBoost, hueShift }) =>
			`<g filter="url(#${blurId(name)})" opacity="${opacity}">${ringsOf(strokeWidth, (hex) => glowColour(hex, { chromaBoost, hueTurn: neon.hueShift * hueShift }))}</g>`
	);
	const main = `<g>${ringsOf(MAIN_WIDTH, (hex) => hex)}</g>`;

	return `<defs>${defs}</defs><rect width="${width}" height="${height}" fill="url(#${groundId})"/>${[...glows, main].join('')}`;
}
