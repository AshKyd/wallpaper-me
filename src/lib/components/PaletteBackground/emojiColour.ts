import { hexToRgb, luminance } from './paletteUtils.js';

/** The few colour names Twemoji's files use, which are not hexes. */
const NAMED_COLOURS: Record<string, string> = { red: '#ff0000', green: '#008000', navy: '#000080', azure: '#f0ffff' };

/** A fill with a channel spread (max minus min, 0 to 255) at most this counts as grey. Twemoji's greys are slightly blue, so this is not zero. */
const GREY_SPREAD = 30;
/** Greys at least this light (`luminance()`, 0 to 1) count as white, and those at most `BLACK_LUMINANCE` as black. */
const WHITE_LUMINANCE = 0.9;
const BLACK_LUMINANCE = 0.25;

/**
 * Whether a fill is Twemoji's white or black, which is more than `#fff` and `#000`: eyes and highlights are
 * near-white greys like `#f5f8fa`, and pupils and outlines near-black ones like `#292f33`. They are left as they
 * are so those details keep their contrast whatever the palette. Mid greys are ordinary colours.
 */
const isWhiteOrBlack = (hex: string) => {
	const channels = hexToRgb(hex);
	if (Math.max(...channels) - Math.min(...channels) > GREY_SPREAD) return false;
	const light = luminance(hex);
	return light >= WHITE_LUMINANCE || light <= BLACK_LUMINANCE;
};

/** A fill as a six-digit hex: `#269` is `#226699` and `red` is `#ff0000`. Nothing for `none` or anything else. */
export function fullHex(fill: string): string | undefined {
	const hex = NAMED_COLOURS[fill] ?? fill;
	if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
	const [, short] = hex.match(/^#([0-9a-f]{3})$/i) ?? [];
	return short && `#${[...short].map((digit) => digit + digit).join('')}`.toLowerCase();
}

/**
 * An emoji's artwork recoloured from a palette. Every fill except white and black (see `isWhiteOrBlack()`) is swapped for a palette colour.
 * Each distinct fill gets one colour, so a shape's parts stay distinct: fills are ranked darkest to lightest and
 * dealt the palette's colours (darkest to lightest) in turn, which keeps the emoji's light and dark areas roughly
 * where they were. `shift` moves the deal along the palette, so each copy of the emoji can use a different mix.
 * A fill that is not a colour (`none`) is left alone, and shapes keep their own transparency.
 */
export function colouriseArtwork({ artwork, palette, shift = 0 }: { artwork: string; palette: readonly string[]; shift?: number }): string {
	if (palette.length === 0) return artwork;
	const byLightness = (a: string, b: string) => luminance(a) - luminance(b);
	const sortedPalette = [...palette].sort(byLightness);
	const fills = [...new Set([...artwork.matchAll(/\sfill="([^"]*)"/g)].map(([, fill]) => fullHex(fill!)))].filter((hex): hex is string => hex !== undefined && !isWhiteOrBlack(hex)).sort(byLightness);
	const replacements = new Map(fills.map((hex, rank) => [hex, sortedPalette[(rank + shift) % sortedPalette.length]!]));

	return artwork.replaceAll(/\sfill="([^"]*)"/g, (whole, fill: string) => {
		const hex = fullHex(fill);
		const replacement = hex && replacements.get(hex);
		return replacement ? ` fill="${replacement}"` : whole;
	});
}
