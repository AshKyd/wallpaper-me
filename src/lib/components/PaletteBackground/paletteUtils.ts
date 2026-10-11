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

/** Returns a function giving repeatable numbers in [0, 1) for a seed (mulberry32). */
export function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
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
