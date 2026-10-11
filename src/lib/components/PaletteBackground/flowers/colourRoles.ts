import { luminance, mixHex, shuffle, type PaletteColour } from '../paletteUtils.js';

/**
 * Every flower paints from the same roles, which is what makes the layered artwork
 * read as one design rather than a pile of unrelated shapes.
 */
export interface ColourRoles {
	/** Background, and the "negative space" ring inside motifs. */
	ground: string;
	/** Highest-contrast colour against the ground: outlines, eye rings, dots. */
	outline: string;
	/** Second band colour for the echo outlines. */
	echo: string;
	/** Petal fills, in a seeded order. */
	fills: string[];
}

/** Fill colour by index, wrapping around the list. */
export const fillAt = ({ fills }: ColourRoles, index: number) => fills[((index % fills.length) + fills.length) % fills.length]!;

export function assignColourRoles(colours: PaletteColour[], random: () => number): ColourRoles {
	const ground = colours[0]!.hex;
	const groundLuminance = luminance(ground);
	// Short palettes are padded with tints and shades of the ground so every role has a colour.
	const padding = [mixHex(ground, '#ffffff', 0.55), mixHex(ground, '#000000', 0.45), mixHex(ground, '#ffffff', 0.3)];
	const others = [...colours.slice(1).map(({ hex }) => hex), ...padding].slice(0, Math.max(3, colours.length - 1));
	const byContrast = [...others].sort((a, b) => Math.abs(luminance(b) - groundLuminance) - Math.abs(luminance(a) - groundLuminance));
	const [outline, echo] = byContrast as [string, string];
	const fills = shuffle(
		others.filter((hex) => hex !== outline),
		random
	);
	return { ground, outline, echo, fills };
}
