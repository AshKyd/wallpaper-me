import { luminance, normalisePalette, type Palette } from '#lib/components/PaletteBackground/paletteUtils.js';
import { PALETTE_TONES, buildToneMap, type PaletteTone } from '#lib/components/PaletteBackground/tones.js';

export interface ToneSwatch {
	tone: PaletteTone;
	/** The palette's mid colour after the tone has been applied. */
	hex: string;
}

/**
 * The middle colour of a palette by lightness (the median once merged and sorted dark to light). It stands
 * for the palette as a whole: the extremes would show the tone's floor and ceiling rather than its character.
 */
export function midColour(palette: Palette): string | undefined {
	const byLightness = normalisePalette(palette)
		.map(({ hex }) => hex)
		.sort((a, b) => luminance(a) - luminance(b));
	return byLightness[Math.floor(byLightness.length / 2)];
}

/** The palette's mid colour in one tone, made with the same `buildToneMap()` the artwork uses, so it matches the wallpaper. */
export function toneColour(palette: Palette, tone: PaletteTone): string | undefined {
	const mid = midColour(palette);
	return mid === undefined ? undefined : buildToneMap(palette, tone)(mid);
}

/** One swatch per tone. */
export function toneSwatches(palette: Palette): ToneSwatch[] {
	return PALETTE_TONES.flatMap((tone) => {
		const hex = toneColour(palette, tone);
		return hex === undefined ? [] : [{ tone, hex }];
	});
}

/** `subtleDark` -> `Subtle dark`. */
export function toneLabel(tone: PaletteTone): string {
	const spaced = tone.replace(/([A-Z])/g, ' $1').toLowerCase();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
