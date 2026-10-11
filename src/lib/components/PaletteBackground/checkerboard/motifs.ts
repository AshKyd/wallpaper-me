/**
 * Patterns for the checkerboard. A motif never changes the shape of a cell: it only says which
 * cells swap to a different colour pair, so the board stays a plain checkerboard.
 *
 * A motif is a pure function of the cell offset from the motif's centre and its radius (in cells).
 * It returns `undefined` for a cell outside the motif, or a tone: which of the motif's colour
 * pairs to use (0 is the main one, 1 an accent).
 */
export type MotifFn = (dx: number, dy: number, radius: number) => number | undefined;

const abs = Math.abs;
const distance = Math.hypot;
/** Modulo that stays positive for negative numbers. */
const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const onDiagonal = (dx: number, dy: number) => abs(dx) === abs(dy);
const onAxis = (dx: number, dy: number) => dx === 0 || dy === 0;

export const MOTIFS = {
	/* Lines */
	x: (dx, dy) => (onDiagonal(dx, dy) ? 0 : undefined),
	plus: (dx, dy) => (onAxis(dx, dy) ? 0 : undefined),
	// Eight spokes with an accent in the middle.
	starburst: (dx, dy) => {
		if (!onAxis(dx, dy) && !onDiagonal(dx, dy)) return undefined;
		return dx === 0 && dy === 0 ? 1 : 0;
	},
	// Spokes one cell thick on each side: a fat star.
	asterisk: (dx, dy) => {
		const spoke = abs(dx) <= 1 || abs(dy) <= 1 || abs(abs(dx) - abs(dy)) <= 1;
		if (!spoke) return undefined;
		return abs(dx) <= 1 && abs(dy) <= 1 ? 1 : 0;
	},
	// Two wedges facing each other.
	bowtie: (dx, dy) => (abs(dy) <= abs(dx) ? 0 : undefined),
	// Nested V shapes pointing up.
	chevron: (dx, dy) => (positiveModulo(dy + abs(dx), 3) === 0 ? 0 : undefined),
	diagonalStripes: (dx, dy) => (positiveModulo(dx + dy, 4) < 2 ? 0 : undefined),
	// A one-cell path that zigzags across the motif.
	zigzag: (dx, dy, radius) => (dy === abs(positiveModulo(dx + radius, 4) - 2) - 1 ? 0 : undefined),

	/* Rings and fills */
	o: (dx, dy, radius) => (Math.round(distance(dx, dy)) === radius ? 0 : undefined),
	diamondRing: (dx, dy, radius) => (abs(dx) + abs(dy) === radius ? 0 : undefined),
	squareRing: (dx, dy, radius) => (Math.max(abs(dx), abs(dy)) === radius ? 0 : undefined),
	// Concentric squares alternating between the two tones.
	target: (dx, dy) => Math.max(abs(dx), abs(dy)) % 2,
	solidDiamond: (dx, dy, radius) => {
		if (abs(dx) + abs(dy) > radius) return undefined;
		return abs(dx) + abs(dy) <= Math.floor(radius / 2) ? 1 : 0;
	},
	solidCircle: (dx, dy, radius) => {
		const reach = distance(dx, dy);
		if (reach > radius + 0.3) return undefined;
		return reach <= radius / 2 ? 1 : 0;
	},
	// A square frame whose corner cells take the accent.
	frame: (dx, dy, radius) => {
		if (Math.max(abs(dx), abs(dy)) !== radius) return undefined;
		return abs(dx) === radius && abs(dy) === radius ? 1 : 0;
	},

	/* Small repeats */
	dots: (dx, dy) => (positiveModulo(dx, 2) === 0 && positiveModulo(dy, 2) === 0 ? 0 : undefined),
	// A staircase: the half below the anti-diagonal, with the step edge in the accent.
	cornerSteps: (dx, dy) => {
		if (dx + dy > 0) return undefined;
		return dx + dy === 0 ? 1 : 0;
	},
	heart: (dx, dy, radius) => {
		// Classic implicit heart curve, sampled on the cell grid.
		const x = (dx / (radius + 0.5)) * 1.25;
		const y = (-dy / (radius + 0.5)) * 1.25 + 0.1;
		return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0 ? 0 : undefined;
	},
	// Up-pointing arrow: a triangular head over a one-cell shaft.
	arrow: (dx, dy, radius) => {
		const inHead = dy <= 0 && dy >= -radius && abs(dx) <= dy + radius;
		const inShaft = dx === 0 && dy > 0;
		return inHead || inShaft ? 0 : undefined;
	}
} satisfies Record<string, MotifFn>;

export type MotifName = keyof typeof MOTIFS;
export const MOTIF_NAMES = Object.keys(MOTIFS) as MotifName[];

/**
 * Overlays cover the whole board instead of one motif. They take a cell's offset from the board
 * centre and return a layer index (0 is the background pair), spread across `layerCount` layers.
 */
export type OverlayFn = (dx: number, dy: number, layerCount: number, columns: number) => number;

export const OVERLAYS = {
	// Concentric rings of colour pairs, like a ripple.
	ripple: (dx, dy, layerCount) => Math.floor(distance(dx, dy) / 3) % layerCount,
	// Slanted stripes of colour pairs.
	sweep: (dx, dy, layerCount) => positiveModulo(Math.floor((dx + dy) / 3), layerCount),
	// Colour pairs step in order from the left edge to the right.
	rampShift: (dx, _dy, layerCount, columns) =>
		Math.min(layerCount - 1, Math.max(0, Math.floor(((dx + columns / 2) / columns) * layerCount)))
} satisfies Record<string, OverlayFn>;

export type OverlayName = keyof typeof OVERLAYS;
export const OVERLAY_NAMES = Object.keys(OVERLAYS) as OverlayName[];
