import { hexToOklch, maxChroma, oklchToHex, type Oklch } from './oklch.js';
import { normalisePalette, type Palette } from './paletteUtils.js';

export const PALETTE_TONES = ['original', 'pastel', 'dark', 'subtleDark'] as const;
export type PaletteTone = (typeof PALETTE_TONES)[number];

interface ToneSettings {
	/** Lightness range the palette is moved into. Its contrast is squeezed to fit, never stretched, and it moves only as far as needed. */
	band: readonly [low: number, high: number];
	/** Lightness that pure black and pure white land on. Colours the generators derive by mixing with black or white go through the same map, so they stay in tune. */
	floor: number;
	ceiling: number;
	/**
	 * Exponent on a colour's position within the palette's lightness range, applied after the squeeze.
	 * Below 1 lifts the darker colours more than the lighter ones, so a pastel keeps one deeper accent
	 * (like a tone curve in a photo editor) instead of every colour piling up near white.
	 */
	lift: number;
	/**
	 * Saturation (chroma as a share of the most the sRGB gamut allows at that lightness and hue) that
	 * colours are pulled towards. Absolute chroma collapses near white and black, where the gamut is
	 * narrow, which is what turns a "pastel" into a lightened colour; saturation stays meaningful there.
	 */
	saturationTarget: number;
	/** How far (0-1) each colour moves from its own saturation to `saturationTarget`. Below 1 keeps the palette's vivid and muted colours distinct. */
	saturationBlend: number;
	/** Lightness taken off per unit of chroma. Saturated colours look brighter than their lightness says (Helmholtz-Kohlrausch), most of all reds and blues, and more so on dark grounds. */
	brightnessCompensation: number;
	/** Least chroma any colour keeps, so greys, blacks and whites carry a trace of the palette instead of going dead. */
	neutralChroma: number;
}

/**
 * Starting values, tuned by eye in the `Tones` story.
 * - `pastel`: light, with the darkest colour kept as a soft accent, and moderate saturation.
 * - `dark`: the original contrast moved onto dark surfaces, mostly keeping its saturation.
 * - `subtleDark`: pastel's low contrast and moderate saturation on a dark band.
 */
export const TONE_SETTINGS: Record<Exclude<PaletteTone, 'original'>, ToneSettings> = {
	pastel: { band: [0.72, 0.95], floor: 0.66, ceiling: 0.985, lift: 0.6, saturationTarget: 0.6, saturationBlend: 0.6, brightnessCompensation: 0, neutralChroma: 0.008 },
	dark: { band: [0.2, 0.7], floor: 0.12, ceiling: 0.82, lift: 1, saturationTarget: 0.7, saturationBlend: 0.3, brightnessCompensation: 0.15, neutralChroma: 0.012 },
	subtleDark: { band: [0.22, 0.42], floor: 0.15, ceiling: 0.54, lift: 0.8, saturationTarget: 0.45, saturationBlend: 0.6, brightnessCompensation: 0.1, neutralChroma: 0.01 }
};

/** A colour whose saturation is below this is near-neutral: it keeps its own saturation instead of being pulled to the target, so whites and greys don't turn coloured. */
const NEUTRAL_SATURATION = 0.12;

/** Two palette colours never end up closer in lightness than this, so pastel can't merge them into one hex. */
const MIN_LIGHTNESS_STEP = 0.015;

/** Palette lightnesses closer than this count as one, which avoids zero-length segments in the map. */
const SAME_LIGHTNESS = 1e-4;

/** A colour with less chroma than this has no reliable hue, so it borrows the palette's most vivid hue. */
const UNRELIABLE_HUE_CHROMA = 0.01;

interface Anchor {
	from: number;
	to: number;
}

const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount;

/** Piecewise-linear lookup through anchors sorted by `from`. */
function interpolate(anchors: Anchor[], value: number): number {
	const upperIndex = anchors.findIndex(({ from }) => from >= value);
	if (upperIndex === -1) return anchors.at(-1)!.to;
	if (upperIndex === 0) return anchors[0]!.to;
	const lower = anchors[upperIndex - 1]!;
	const upper = anchors[upperIndex]!;
	return lerp(lower.to, upper.to, (value - lower.from) / (upper.from - lower.from));
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Builds the lightness map for one palette: the palette's own lightnesses are squeezed to fit the
 * tone's band, then moved only as far as needed to sit inside it, in the same order and proportions.
 * A dark palette is therefore left alone by `dark` rather than lifted to the band's middle.
 *
 * It is palette-relative and monotone on purpose. The generators lean on which colour is lightest,
 * which contrasts with the ground and how far apart neighbours are, so those relationships must
 * survive. Inverting lightness for dark would turn a cream ground black and break that.
 */
function lightnessMapFor(paletteLightnesses: number[], { band: [low, high], floor, ceiling, lift }: ToneSettings): (lightness: number) => number {
	const distinct = [...paletteLightnesses]
		.sort((a, b) => a - b)
		.filter((lightness, index, sorted) => index === 0 || lightness - sorted[index - 1]! > SAME_LIGHTNESS);
	const first = distinct[0]!;
	const last = distinct.at(-1)!;
	const range = last - first;
	// Squeeze to fit the band, but never stretch a palette that is already narrow.
	const squeeze = range > 0 ? Math.min(1, (high - low) / range) : 1;
	const paletteCentre = (first + last) / 2;
	// Where the squeezed palette is centred: its own centre if that fits, otherwise the nearest spot that does.
	const halfSqueezedRange = (squeeze * range) / 2;
	const targetCentre = clamp(paletteCentre, low + halfSqueezedRange, high - halfSqueezedRange);

	const squeezedLow = targetCentre - halfSqueezedRange;
	const squeezedHigh = targetCentre + halfSqueezedRange;

	const targets = distinct
		.map((lightness) => targetCentre + squeeze * (lightness - paletteCentre))
		// Lift: reshape the position between the squeezed ends (0 darkest, 1 lightest), keeping the ends fixed.
		.map((squeezed) => (range > 0 ? lerp(squeezedLow, squeezedHigh, clamp((squeezed - squeezedLow) / (squeezedHigh - squeezedLow), 0, 1) ** lift) : squeezed))
		.reduce<number[]>((spaced, target) => [...spaced, Math.max(target, (spaced.at(-1) ?? -Infinity) + MIN_LIGHTNESS_STEP)], []);

	const anchors: Anchor[] = [
		...(first > 0 ? [{ from: 0, to: Math.min(floor, targets[0]! - MIN_LIGHTNESS_STEP) }] : []),
		...distinct.map((from, index) => ({ from, to: targets[index]! })),
		...(last < 1 ? [{ from: 1, to: Math.max(ceiling, targets.at(-1)! + MIN_LIGHTNESS_STEP) }] : [])
	];
	return (lightness) => interpolate(anchors, lightness);
}

/** Chroma as a share (0-1) of the most sRGB allows at that lightness and hue. */
export function saturationOf({ lightness, chroma, hue }: Oklch): number {
	const available = maxChroma(lightness, hue);
	return available > 0 ? Math.min(1, chroma / available) : 0;
}

/**
 * Returns a function that moves any hex into `tone`, relative to `palette`.
 *
 * Only lightness and chroma change; hue is held. The map is built from the palette's colours but
 * works on any hex, so mixes of palette colours with black or white land consistently too.
 * `original` returns hexes untouched.
 */
export function buildToneMap(palette: Palette, tone: PaletteTone): (hex: string) => string {
	if (tone === 'original') return (hex) => hex;
	const colours = normalisePalette(palette).map(({ hex }) => hexToOklch(hex));
	if (colours.length === 0) return (hex) => hex;

	const settings = TONE_SETTINGS[tone];
	const mapLightness = lightnessMapFor(
		colours.map(({ lightness }) => lightness),
		settings
	);
	const vividHue = colours.reduce((most, colour) => (colour.chroma > most.chroma ? colour : most)).hue;
	const cache = new Map<string, string>();

	const toneHex = (hex: string) => {
		const original = hexToOklch(hex);
		const hue = original.chroma < UNRELIABLE_HUE_CHROMA ? vividHue : original.hue;
		const newLightness = mapLightness(original.lightness);

		// Pull saturation towards the target, less so for near-neutrals, then turn it back into chroma at the new lightness.
		const saturation = saturationOf(original);
		const pull = settings.saturationBlend * Math.min(1, saturation / NEUTRAL_SATURATION);
		const newSaturation = lerp(saturation, settings.saturationTarget, pull);
		const newChroma = Math.max(newSaturation * maxChroma(newLightness, hue), settings.neutralChroma);

		return oklchToHex({ lightness: newLightness - settings.brightnessCompensation * newChroma, chroma: newChroma, hue });
	};

	return (hex) => {
		const key = hex.toLowerCase();
		const cached = cache.get(key);
		if (cached) return cached;
		const toned = toneHex(key);
		cache.set(key, toned);
		return toned;
	};
}

/**
 * Recolours finished artwork. Done on the SVG rather than on the palette so the layout is the same
 * in every tone: generators choose colour pairs, roles and layouts using contrast thresholds, and
 * a softened palette would make them choose differently.
 */
export function applyTone(markup: string, palette: Palette, tone: PaletteTone): string {
	if (tone === 'original') return markup;
	const toneHex = buildToneMap(palette, tone);
	return markup.replace(/#[0-9a-fA-F]{6}\b/g, toneHex);
}
