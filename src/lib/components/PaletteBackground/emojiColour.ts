import { hexToRgb, luminance, rgbToHex } from './paletteUtils.js';

/** Colours at least this light (`luminance()`, 0 to 1) are multiplied with the emoji; darker ones are soft-lit. */
export const LIGHT_COLOUR_LUMINANCE = 0.5;

/**
 * How an emoji's greys are blended with a colour. A light colour is multiplied: the emoji's lightest parts take the
 * colour in full and its darker parts shade it, which keeps the detail. Multiplying a dark colour would leave the
 * emoji nearly black, and `screen` blows the lights out to white, so a darker colour gets `soft-light`: mid grey is
 * the colour itself, darker greys shade it and lighter ones lift it, and nothing clips.
 */
export const blendModeFor = (colour: string) => (luminance(colour) >= LIGHT_COLOUR_LUMINANCE ? 'multiply' : 'soft-light');

/** The few colour names Twemoji's files use, which are not hexes. */
const NAMED_COLOURS: Record<string, string> = { red: '#ff0000', green: '#008000', navy: '#000080', azure: '#f0ffff' };

/** A fill as a six-digit hex: `#269` is `#226699` and `red` is `#ff0000`. Nothing for `none` or anything else. */
export function fullHex(fill: string): string | undefined {
	const hex = NAMED_COLOURS[fill] ?? fill;
	if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
	const [, short] = hex.match(/^#([0-9a-f]{3})$/i) ?? [];
	return short && `#${[...short].map((digit) => digit + digit).join('')}`.toLowerCase();
}

/** The W3C `soft-light` blend of one channel (0 to 1): `backdrop` lit by `source`. */
function softLight(backdrop: number, source: number): number {
	if (source <= 0.5) return backdrop - (1 - 2 * source) * backdrop * (1 - backdrop);
	const lift = backdrop <= 0.25 ? ((16 * backdrop - 12) * backdrop + 4) * backdrop : Math.sqrt(backdrop);
	return backdrop + (2 * source - 1) * (lift - backdrop);
}

/**
 * What a fill becomes in `colour`: its brightness (as a grey) blended with the colour by `blendModeFor()`. So a
 * dark part of the emoji is a dark shade of the colour and a light part a light one.
 */
export function shadeOf(fill: string, colour: string): string {
	const grey = luminance(fill);
	const mode = blendModeFor(colour);
	const [red, green, blue] = hexToRgb(colour).map((channel) => (mode === 'multiply' ? (channel / 255) * grey : softLight(channel / 255, grey)) * 255);
	return rgbToHex([red!, green!, blue!]);
}

/**
 * An emoji's artwork drawn in one colour, with its shading kept: every fill is replaced by its `shadeOf()` the
 * colour. A fill that is not a colour (`none`) is left alone. This is the whole of the tinting: the shapes keep
 * their own transparency, so nothing needs masking.
 */
export const colouriseArtwork = (artwork: string, colour: string): string =>
	artwork.replaceAll(/\sfill="([^"]*)"/g, (whole, fill: string) => {
		const hex = fullHex(fill);
		return hex ? ` fill="${shadeOf(hex, colour)}"` : whole;
	});
