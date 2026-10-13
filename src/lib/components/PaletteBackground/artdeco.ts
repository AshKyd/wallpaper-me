import { definedOnly, round, type ArtInput } from './canvas.js';
import { createRandom, luminance, mixHex, pickOption, type PaletteColour } from './paletteUtils.js';

export const FAN_STYLES = ['peacock', 'sunburst', 'clamshell'] as const;
export type FanStyle = (typeof FAN_STYLES)[number];

/** Radii a wall of fans picks from, in canvas units. */
export const FAN_RADII: readonly number[] = [56, 72, 90];

/**
 * Vertical gap between rows, as a share of the radius. Half a radius would stack the rows like fish scales, each
 * fan covered by the two below it except for a cap. A little more leaves more of each fan showing, and a sliver
 * of background between the rows.
 */
const ROW_STEP_SHARE = 0.6;
/** Distance between fans in a row, as a share of the radius. Two is touching; more leaves a gap. Odd rows shift by half of it. */
const COLUMN_PITCH_SHARE = 2.9;
/** The rays start this far under the fan's centre (a share of the radius): about where a closer-packed row below would meet. */
const APEX_DROP_SHARE = 0.5;
/** How far the rays spread either side of upright. Past this they leave the fan through the part the next row covers. */
const RAY_SPREAD = (44 * Math.PI) / 180;
/** The arch styles (`peacock`, `sunburst`) pack differently from circles. Rows are this share of the arch's height apart (1.3 radii for a peacock), and fans in a row this many radii. */
const ARCH_ROW_STEP_SHARE = 13 / 30;
const ARCH_PITCH_SHARE = 2.5;
/** The sunburst's rays: how many (odd, so one is straight up), and the share of the outline kept clear at each bottom corner. */
const SUNBURST_RAY_COUNT = 39;
const SUNBURST_EDGE_MARGIN = 0.06;
/** How a ray bends (see `rayCurve()`): how far up its first control point is, as a share of the rise to its end, and where its second is. */
const RAY_LIFT_SHARE = 0.55;
const RAY_ARRIVE_SHARE = 0.5;
const RAY_ARRIVE_DROP_SHARE = 0.15;
/** Line weight as a share of the radius, with a floor so small fans keep a visible line. */
const LINE_SHARE = 0.035;
const MIN_LINE = 1.2;
/** The clamshell's outlines are thinner: feathers are close together, and heavy lines crowd them. */
const CLAMSHELL_LINE_SHARE = 0.02;
/** Feathers in a clamshell, and how far from the apex they start (a share of the radius), which makes the base narrow. */
const FEATHER_COUNT = 8;
/** How much of the whole top-to-bottom gradient the feathers of one fan cover, from its leftmost to its rightmost. */
const FEATHER_GRADIENT_SPREAD = 0.5;
const FEATHER_BASE_SHARE = 0.12;
/** Radius of a feather's rounded tip, as a share of its width. 0.5 is a semicircle; larger is shallower. */
const TIP_ARC_SHARE = 0.55;

export interface FanColours {
	/** The top and bottom of the background: the palette's two darkest colours. */
	groundTop: string;
	groundBottom: string;
	/** Every line and solid band: the palette's third darkest colour (the lightest, if it has only one or two). */
	ink: string;
}

/**
 * Monochrome colours for a wall of fans: the two darkest palette colours make the background and the
 * third darkest draws the fans. Palettes with fewer colours are made up with black so the gradient and the contrast
 * survive: two colours darken the darkest for the top; one colour is darkened for the gradient and kept as the ink.
 */
export function fanColours(colours: PaletteColour[]): FanColours {
	const [darkest, second, ...rest] = colours.map(({ hex }) => hex).sort((a, b) => luminance(a) - luminance(b));
	if (!darkest) return { groundTop: '#000000', groundBottom: '#222222', ink: '#ffffff' };
	if (!second) return { groundTop: mixHex(darkest, '#000000', 0.65), groundBottom: mixHex(darkest, '#000000', 0.4), ink: darkest };
	if (rest.length === 0) return { groundTop: mixHex(darkest, '#000000', 0.45), groundBottom: darkest, ink: second };
	return { groundTop: darkest, groundBottom: second, ink: rest[0]! };
}

/** Angles of `count` rays, spread evenly up to `spread` either side of upright (radians, 0 is straight up). */
const raysFrom = (count: number, spread: number) => Array.from({ length: count }, (_, index) => -spread + (2 * spread * index) / (count - 1));
const rayAngles = (count: number) => raysFrom(count, RAY_SPREAD);

interface FanOptions {
	/** Where the fan is, in canvas units: the centre of a clamshell's circle, or the middle of an arch's bottom edge. */
	x: number;
	y: number;
	radius: number;
	ink: string;
	/**
	 * The solid fill at a height on the canvas: steadily different down the page (see `artDecoArt()`). `offset` moves it
	 * along the gradient as a share of the whole (0 to 1), which is how a clamshell's feathers differ from side to side.
	 * Fills hide the fans behind.
	 */
	groundAt: (y: number, offset?: number) => string;
}

/** A point `distance` from `from`, along a ray at `angle` (radians from upright). */
const alongRay = ({ x, y }: { x: number; y: number }, angle: number, distance: number) => ({ x: x + distance * Math.sin(angle), y: y - distance * Math.cos(angle) });

/** Where a ray from the apex meets the circle, at `scale` of the radius. Rays all leave the same point, so they fan out. */
function rayEnd({ x, y, radius }: Pick<FanOptions, 'x' | 'y' | 'radius'>, angle: number, scale: number) {
	const drop = radius * APEX_DROP_SHARE;
	// Solves for the distance along the ray at which it is `radius` from the circle's centre.
	const distance = drop * Math.cos(angle) + Math.sqrt(radius ** 2 - (drop * Math.sin(angle)) ** 2);
	return { x: x + distance * scale * Math.sin(angle), y: y + drop - distance * scale * Math.cos(angle) };
}

const point = ({ x, y }: { x: number; y: number }) => `${round(x)} ${round(y)}`;

/** Wall height of each arch style, in radii: a half circle on a square (1 : 1.5) for `peacock`, on a half square (1 : 1) for `sunburst`. */
const ARCH_WALL_RADII = { peacock: 2, sunburst: 1 } as const;

interface Arch {
	/** The middle of the bottom edge, where everything radiates from. */
	x: number;
	y: number;
	/** Of the half circle on top, which is also half the arch's width. */
	radius: number;
	/** Height of the straight walls under the half circle. */
	wall: number;
}

const archHeight = ({ radius, wall }: Arch) => wall + radius;

/**
 * An arch: a half circle of `radius` on top of a rectangle `2 * radius` wide and `wall` high. With walls of
 * `2 * radius` it is a half circle on a square, `3 * radius` high (1 : 1.5); with walls of `radius`, 1 : 1.
 *
 * `innerRadius` makes a smaller arch inside it, with the same walls and the half circle's centre in the same
 * place, so the gap to the outer arch is the same all the way round. Shrinking the whole arch instead would
 * stretch the gap: thick across the top, thin at the sides.
 */
const archPath = ({ x, y, radius, wall }: Arch, innerRadius = radius) =>
	`M${point({ x: x - innerRadius, y })}L${point({ x: x - innerRadius, y: y - wall })}A${round(innerRadius)} ${round(innerRadius)} 0 0 1 ${point({ x: x + innerRadius, y: y - wall })}L${point({ x: x + innerRadius, y })}Z`;

/**
 * A point a `share` (0 to 1) of the way round the arch's outline, from the bottom left corner up the left wall,
 * over the half circle and down the right wall. Spacing by distance round the outline, not by angle from the
 * bottom centre, makes the ends of the rays evenly spaced, so they don't bunch up on the walls.
 */
function archOutlinePoint({ x, y, radius, wall }: Arch, share: number) {
	const top = Math.PI * radius;
	const distance = share * (wall * 2 + top);
	if (distance <= wall) return { x: x - radius, y: y - distance };
	// Down the right wall, from the height of the walls (`wall`) back to the bottom.
	if (distance >= wall + top) return { x: x + radius, y: y - wall + (distance - wall - top) };
	// Over the top, from the left (angle 0) to the right (angle pi) of the half circle.
	const angle = (distance - wall) / radius;
	return { x: x - radius * Math.cos(angle), y: y - wall - radius * Math.sin(angle) };
}

/**
 * A ray as a cubic bezier from the bottom centre to `end` on the outline. It leaves straight up, whatever the
 * end, then bends out towards it, so the rays fan open like a fountain instead of being straight spokes. The
 * second control point sits level with the end, a little in from it, so the curve arrives on its way out.
 */
function rayCurve(origin: { x: number; y: number }, end: { x: number; y: number }) {
	const rise = origin.y - end.y;
	const across = end.x - origin.x;
	const start = { x: origin.x, y: origin.y - rise * RAY_LIFT_SHARE };
	const arrive = { x: origin.x + across * RAY_ARRIVE_SHARE, y: end.y + rise * RAY_ARRIVE_DROP_SHARE };
	return `M${point(origin)}C${point(start)} ${point(arrive)} ${point(end)}`;
}

/**
 * One arch-shaped fan (see `archPath()`), radiating from the middle of its bottom edge.
 *
 * - `peacock`: nested arches, alternately ink and background, all sharing the bottom centre.
 * - `sunburst`: many curved rays from the bottom centre out to evenly spaced points on the edge. Nothing else inside.
 */
export function archMarkup({ style, x, y, radius, ink, groundAt }: FanOptions & { style: 'peacock' | 'sunburst' }): string {
	const arch: Arch = { x, y, radius, wall: radius * ARCH_WALL_RADII[style] };
	// The colour at the arch's middle, so it matches the gradient where it sits.
	const ground = groundAt(y - archHeight(arch) / 2);
	const line = round(Math.max(MIN_LINE, radius * LINE_SHARE));
	const outline = `fill="${ground}" stroke="${ink}" stroke-width="${line}" stroke-linejoin="round"`;

	if (style === 'peacock') {
		// Alternating fills; only the outer arch has an outline, so the edge shows against its neighbours.
		// Each band is the same width all the way round (see `archPath()`).
		return [
			`<path d="${archPath(arch)}" ${outline}/>`,
			...[0.8, 0.6, 0.4, 0.2].map((scale, index) => `<path d="${archPath(arch, radius * scale)}" fill="${index % 2 === 0 ? ink : ground}"/>`)
		].join('');
	}

	// Ends evenly spaced round the outline, leaving out the very bottom corners where a ray would run along the edge.
	const rays = Array.from({ length: SUNBURST_RAY_COUNT }, (_, index) => {
		const share = SUNBURST_EDGE_MARGIN + ((1 - 2 * SUNBURST_EDGE_MARGIN) * index) / (SUNBURST_RAY_COUNT - 1);
		return rayCurve({ x, y }, archOutlinePoint(arch, share));
	}).join('');
	return [
		`<path d="${archPath(arch)}" ${outline}/>`,
		`<path d="${rays}" fill="none" stroke="${ink}" stroke-width="${round(line * 0.5)}" stroke-linecap="round"/>`
	].join('');
}

/**
 * One clamshell fan, a circle of `radius` centred on `(x, y)`: feathers from the apex, narrow at the base and
 * wider at the tip, each with a rounded top and its own solid fill. The rows below paint
 * over its lower part, so what shows is the cap.
 */
export function clamshellMarkup({ x, y, radius, ink, groundAt }: FanOptions): string {
	const ground = groundAt(y);
	const line = round(Math.max(MIN_LINE, radius * CLAMSHELL_LINE_SHARE));
	const circle = (scale: number, attributes: string) => `<circle cx="${round(x)}" cy="${round(y)}" r="${round(radius * scale)}" ${attributes}/>`;
	const apex = { x, y: y + radius * APEX_DROP_SHARE };

	// Feathers radiating from the apex. Each is narrow at the base and wider at the tip, which is a
	// rounded arc. Neighbouring feathers share their sides.
	// Each is filled with its own solid colour (by its height, so the stepping is finer than the rows) to hide
	// whatever is behind it.
	const angles = rayAngles(FEATHER_COUNT + 1);
	const bases = angles.map((angle) => alongRay(apex, angle, radius * FEATHER_BASE_SHARE));
	const tips = angles.map((angle) => rayEnd({ x, y, radius }, angle, 1));
	const featherLine = `stroke="${ink}" stroke-width="${line}" stroke-linejoin="round"`;
	const feathers = angles.slice(1).map((_, index) => {
		const [base, nextBase, tip, nextTip] = [bases[index]!, bases[index + 1]!, tips[index]!, tips[index + 1]!];
		// Left to right the fill moves along the gradient, centred on the colour for this height.
		const sideOffset = (index / (FEATHER_COUNT - 1) - 0.5) * FEATHER_GRADIENT_SPREAD;
		const fill = groundAt((base.y + nextBase.y + tip.y + nextTip.y) / 4, sideOffset);
		// Each tip is its own rounded top, bulging out past the circle the tips lie on.
		const tipRadius = round(Math.hypot(nextTip.x - tip.x, nextTip.y - tip.y) * TIP_ARC_SHARE);
		return `<path d="M${point(base)}L${point(tip)}A${tipRadius} ${tipRadius} 0 0 1 ${point(nextTip)}L${point(nextBase)}Z" fill="${fill}" ${featherLine}/>`;
	});
	// A plain disc behind the feathers fills the notches between their rounded tops, and the gap at the apex where
	// the base edges meet, so none of the fans behind show through. It reaches the tips but not past them.
	const backing = circle(1, `fill="${ground}"`);
	return [backing, ...feathers].join('');
}

/** Everything `artDecoArt()` needs to draw. Nothing in it is random, so the same config always gives the same fans. */
export interface ArtDecoConfig extends FanColours {
	style: FanStyle;
	/** Radius of one fan, in canvas units (see `FAN_RADII`). */
	radius: number;
}

/**
 * A config picked from the seed: the style and size are its two draws, and the colours come from the palette
 * (see `fanColours()`). `overrides` pins any of the fields, and the seeded pick for it is still drawn, so pinning
 * one field leaves the other as it was.
 */
export function randomArtDecoConfig({ colours, seed, overrides = {} }: { colours: PaletteColour[]; seed: number; overrides?: Partial<ArtDecoConfig> }): ArtDecoConfig {
	const random = createRandom(seed);
	const style = pickOption(FAN_STYLES, undefined, random);
	const radius = FAN_RADII[Math.floor(random() * FAN_RADII.length)]!;
	return { style, radius, ...fanColours(colours), ...definedOnly(overrides) };
}

/** The config fields the string `options` of the app can pin (see `VARIANT_OPTIONS`). */
export const artDecoOverrides = (options?: Record<string, string>): Partial<ArtDecoConfig> => {
	const style = FAN_STYLES.find((candidate) => candidate === options?.style);
	return style ? { style } : {};
};

/**
 * Art deco fans: rows of fans, each row shifted by half a pitch from the one above, so every fan sits in the
 * gap between two fans of the row before. Rows are drawn top to bottom, so each covers part of the one above.
 * `clamshell` fans are circles; `peacock` and `sunburst` are tall arches (see `archPath()`).
 *
 * Monochrome on purpose (see `fanColours()`): fills that step from `groundTop` at the top to `groundBottom` at
 * the bottom, row by row, and `ink` for every line. Fully set by the config, with no randomness. The grid runs
 * past the canvas.
 */
export function artDecoArt({ style, radius, groundTop, groundBottom, ink }: ArtDecoConfig, { idPrefix, width, height }: Pick<ArtInput, 'idPrefix' | 'width' | 'height'>): string {

	// Every fan is one solid colour, a little further from the top colour than the row above, which reads as a
	// gradient. The fans are spaced apart, so the real gradient behind them (same colours, same direction) shows in
	// the gaps. It only has to be close to the fills, not match them: it is never up against a fan without an outline
	// except in the small notches of a clamshell.
	const groundAt = (y: number, offset = 0) => mixHex(groundTop, groundBottom, Math.min(1, Math.max(0, y / height + offset)));
	const gradientId = `${idPrefix}-artdeco-ground`;
	const backdrop = `<defs><linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${height}"><stop offset="0" stop-color="${groundTop}"/><stop offset="1" stop-color="${groundBottom}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#${gradientId})"/>`;

	// Arches sit on their bottom edge and are taller than circles, so the grid starts further up and runs further
	// down. Their row spacing follows their height, so a short arch (the sunburst) packs as tightly as a tall one.
	const isArch = style !== 'clamshell';
	const archHeightForStyle = style === 'clamshell' ? radius * 2 : radius * (ARCH_WALL_RADII[style] + 1);
	const rowStep = isArch ? archHeightForStyle * ARCH_ROW_STEP_SHARE : radius * ROW_STEP_SHARE;
	const pitch = radius * (isArch ? ARCH_PITCH_SHARE : COLUMN_PITCH_SHARE);
	const firstY = isArch ? -radius * 2 : -radius;
	const rows = Math.ceil((height + (isArch ? archHeightForStyle + radius * 2 : radius * 2)) / rowStep) + 1;
	const columns = Math.ceil(width / pitch) + 2;
	const fans = Array.from({ length: rows }, (_, row) => {
		const y = firstY + row * rowStep;
		return Array.from({ length: columns }, (_, column) => {
			// Odd rows shift by half the pitch.
			const x = (column - 1) * pitch + (row % 2 ? pitch / 2 : 0);
			return style === 'clamshell' ? clamshellMarkup({ x, y, radius, ink, groundAt }) : archMarkup({ style, x, y, radius, ink, groundAt });
		}).join('');
	}).join('');

	return `${backdrop}${fans}`;
}
