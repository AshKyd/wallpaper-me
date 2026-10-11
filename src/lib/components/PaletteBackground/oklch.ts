import { hexToRgb, rgbToHex } from './paletteUtils.js';

/** A colour in OKLCH: lightness 0-1, chroma from 0 (grey) to about 0.4, hue in degrees. */
export interface Oklch {
	lightness: number;
	chroma: number;
	hue: number;
}

type Triple = [number, number, number];

/** Rounding slack when testing whether a linear RGB value fits inside sRGB. */
const GAMUT_TOLERANCE = 1e-4;

/** Halvings used to find the most chroma that fits; 16 is finer than one 8-bit step. */
const GAMUT_SEARCH_STEPS = 16;

const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const toGamma = (channel: number) => (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Hex to OKLCH (Björn Ottosson's OKLab matrices). Unlike HSL, hue stays put as lightness changes,
 * which is what lets a palette be darkened or softened without the colours drifting.
 */
export function hexToOklch(hex: string): Oklch {
	const [red = 0, green = 0, blue = 0] = hexToRgb(hex).map((channel) => toLinear(channel / 255));
	const [l, m, s] = [
		0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
		0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
		0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
	].map(Math.cbrt) as Triple;
	const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const b = 0.0259040371 * l + 0.782771766 * m - 0.808675766 * s;
	return {
		lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		chroma: Math.hypot(a, b),
		hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
	};
}

/** OKLCH to linear sRGB. Channels outside 0-1 mean the colour is outside the sRGB gamut. */
function linearRgbOf({ lightness, chroma, hue }: Oklch): Triple {
	const hueRadians = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(hueRadians);
	const b = chroma * Math.sin(hueRadians);
	const [l, m, s] = [lightness + 0.3963377774 * a + 0.2158037573 * b, lightness - 0.1055613458 * a - 0.0638541728 * b, lightness - 0.0894841775 * a - 1.291485548 * b].map(
		(root) => root ** 3
	) as Triple;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	];
}

const fitsInGamut = (colour: Oklch) => linearRgbOf(colour).every((channel) => channel >= -GAMUT_TOLERANCE && channel <= 1 + GAMUT_TOLERANCE);

/** No sRGB colour has more chroma than this, so it caps the search in `maxChroma()`. */
const CHROMA_CEILING = 0.4;

/** Most chroma that fits inside sRGB at this lightness and hue, found by halving. */
export function maxChroma(lightness: number, hue: number): number {
	if (lightness <= 0 || lightness >= 1) return 0;
	return Array.from({ length: GAMUT_SEARCH_STEPS }).reduce<[number, number]>(
		([low, high]) => {
			const middle = (low + high) / 2;
			return fitsInGamut({ lightness, chroma: middle, hue }) ? [middle, high] : [low, middle];
		},
		[0, CHROMA_CEILING]
	)[0];
}

/**
 * OKLCH to hex. A colour outside sRGB loses chroma at the same lightness and hue until it fits.
 * Clipping the channels instead would shift the hue.
 */
export function oklchToHex({ lightness, chroma, hue }: Oklch): string {
	const clampedLightness = clamp(lightness, 0, 1);
	if (clampedLightness === 0) return '#000000';
	if (clampedLightness === 1) return '#ffffff';

	const colour = { lightness: clampedLightness, chroma, hue };
	const fittingChroma = fitsInGamut(colour) ? chroma : Math.min(chroma, maxChroma(clampedLightness, hue));

	const [red, green, blue] = linearRgbOf({ ...colour, chroma: fittingChroma }).map((channel) => toGamma(clamp(channel, 0, 1)) * 255) as Triple;
	return rgbToHex([red, green, blue]);
}
