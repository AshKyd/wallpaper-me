import MSRand, { MAX_INTEGER } from 'msrand';

export interface PaletteColour {
	hex: string;
	/** Share of the palette this colour takes up, as set by the palette's author. */
	prominence: number;
}

export interface Palette {
	title: string;
	url: string | null;
	creator: string | null;
	colors: PaletteColour[];
}

type Rgb = [number, number, number];

/**
 * Outputs thrown away after seeding. `msrand` is a linear congruential generator, so for neighbouring seeds
 * (1, 2, 3 ...) the first outputs are almost the same, and the first random choices in each artwork
 * (where the first circle goes, which colour comes first) would barely change between seeds. A few steps
 * spread them apart.
 */
const WARM_UP_STEPS = 4;

/**
 * Scrambles a seed (the 32-bit finaliser of MurmurHash3), so neighbouring seeds start the generator far apart.
 * Warming up alone is not enough: an LCG's later outputs still move in lockstep with the seed, so some draws
 * (a neon picture's line thickness, say) came out the same for every small seed.
 */
const scrambleSeed = (seed: number): number => {
	const mixed = Math.imul((seed >>> 0) ^ ((seed >>> 0) >>> 16), 0x85ebca6b);
	const mixedAgain = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
	return (mixedAgain ^ (mixedAgain >>> 16)) >>> 0;
};

/** Returns a function giving repeatable numbers in [0, 1) for a seed, from `msrand` (the Microsoft C `rand`). */
export function createRandom(seed: number): () => number {
	const generator = new MSRand(scrambleSeed(seed));
	Array.from({ length: WARM_UP_STEPS }, () => generator.rand());
	// `randDecimal()` can return exactly 1, which would put `floor(random() * n)` one past the end of a list. Dividing by one more keeps it below 1.
	return () => generator.rand() / (MAX_INTEGER + 1);
}

/** Turns any string into a numeric seed, so stories can seed by palette title. */
export function hashSeed(text: string): number {
	return [...text].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
}

export function hexToRgb(hex: string): Rgb {
	const [red = 0, green = 0, blue = 0] = (hex.replace('#', '').match(/.{2}/g) ?? []).map((pair) =>
		Number.parseInt(pair, 16)
	);
	return [red, green, blue];
}

export function rgbToHex([red, green, blue]: Rgb): string {
	return `#${[red, green, blue]
		.map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0'))
		.join('')}`;
}

/** Linear blend of two hex colours; `amount` 0 gives `from`, 1 gives `to`. */
export function mixHex(from: string, to: string, amount: number): string {
	const fromRgb = hexToRgb(from);
	const toRgb = hexToRgb(to);
	return rgbToHex(fromRgb.map((channel, index) => channel + (toRgb[index]! - channel) * amount) as Rgb);
}

/** How different two colours are, 0 (identical) to 1 (black against white). Plain RGB distance. */
export function colourDistance(first: string, second: string): number {
	const [r1, g1, b1] = hexToRgb(first);
	const [r2, g2, b2] = hexToRgb(second);
	return Math.hypot(r1 - r2, g1 - g2, b1 - b2) / Math.hypot(255, 255, 255);
}

/** Perceived brightness, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
	const [red, green, blue] = hexToRgb(hex);
	return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

/**
 * Merges repeated hexes (some palettes repeat a colour) and orders by prominence,
 * so index 0 is the colour that should dominate the artwork.
 */
export function normalisePalette({ colors }: Palette): PaletteColour[] {
	const merged = colors.reduce((byHex, { hex, prominence }) => {
		const key = hex.toLowerCase();
		return byHex.set(key, (byHex.get(key) ?? 0) + prominence);
	}, new Map<string, number>());
	return [...merged]
		.map(([hex, prominence]) => ({ hex, prominence }))
		.sort((a, b) => b.prominence - a.prominence);
}

/** Every order of the items. n! of them, so only for a handful. */
const permutations = <T>(items: T[]): T[][] =>
	items.length <= 1
		? [items]
		: items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));

/** Total distance along a path of colours, from the first to the last. */
const pathLength = (path: string[]) => path.slice(1).reduce((sum, hex, index) => sum + colourDistance(path[index]!, hex), 0);

/** Up to this many colours are ordered exactly (every order is tried); more use the nearest unused colour each time. */
const MAX_EXACT_ORDER = 8;

/**
 * The colours in order of similarity: a path through all of them in which each is next to the colours most
 * like it, so stepping along the path changes colour gently. It is the shortest path by `colourDistance`.
 * Exact up to `MAX_EXACT_ORDER` colours; beyond that it walks to the nearest unused colour, which is close
 * to shortest. The path is oriented dark to light (by `luminance`) so the result doesn't depend on which way
 * round it was found.
 */
export function orderBySimilarity(hexes: string[]): string[] {
	const dark = (path: string[]) => (luminance(path[0]!) > luminance(path.at(-1)!) ? [...path].reverse() : path);
	if (hexes.length < 3) return dark(hexes);
	if (hexes.length <= MAX_EXACT_ORDER) {
		return dark(permutations(hexes).reduce((best, path) => (pathLength(path) < pathLength(best) ? path : best)));
	}
	const darkest = [...hexes].sort((a, b) => luminance(a) - luminance(b))[0]!;
	const walk = (path: string[], remaining: string[]): string[] => {
		if (remaining.length === 0) return path;
		const next = remaining.reduce((best, hex) => (colourDistance(path.at(-1)!, hex) < colourDistance(path.at(-1)!, best) ? hex : best));
		return walk([...path, next], remaining.filter((hex) => hex !== next));
	};
	return dark(walk([darkest], hexes.filter((hex) => hex !== darkest)));
}

/** Picks a colour with odds proportional to its prominence. */
export function pickWeighted(colours: PaletteColour[], random: () => number): string {
	const total = colours.reduce((sum, { prominence }) => sum + prominence, 0);
	const target = random() * total;
	let running = 0;
	return (colours.find(({ prominence }) => (running += prominence) >= target) ?? colours[0]!).hex;
}

/** Samples a smooth ramp through the colours (ordered dark to light) at `position` 0 to 1. */
export function sampleRamp(rampHexes: string[], position: number): string {
	const clamped = Math.min(1, Math.max(0, position));
	const scaled = clamped * (rampHexes.length - 1);
	const lowerIndex = Math.min(Math.floor(scaled), rampHexes.length - 2);
	if (lowerIndex < 0) return rampHexes[0]!;
	return mixHex(rampHexes[lowerIndex]!, rampHexes[lowerIndex + 1]!, scaled - lowerIndex);
}

/**
 * A choice among `values` that a user can fix: `wanted` if it is one of them, otherwise the seed's pick.
 * The seeded pick is always drawn, even when it is overridden, so the rest of the artwork keeps the same
 * random stream and only the option changes.
 */
export function pickOption<T extends string>(values: readonly T[], wanted: string | undefined, random: () => number): T {
	const seeded = values[Math.floor(random() * values.length)]!;
	return values.find((value) => value === wanted) ?? seeded;
}

export function randomBetween(random: () => number, min: number, max: number): number {
	return min + random() * (max - min);
}

/** Fisher-Yates using the seeded generator, without mutating the input. */
export function shuffle<T>(items: T[], random: () => number): T[] {
	return items.reduceRight((shuffled, _, index) => {
		const swapIndex = Math.floor(random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
		return shuffled;
	}, [...items]);
}
