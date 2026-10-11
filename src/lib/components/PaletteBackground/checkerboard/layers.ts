import { colourDistance, luminance, mixHex, shuffle, type PaletteColour } from '../paletteUtils.js';

/** The two colours of one layer; the cell's parity picks which. */
export type ColourPair = readonly [string, string];

/**
 * Least luminance gap between the two colours of a pair, so its checks stay visible. Kept small:
 * the checks should be a quiet tonal shift, not a loud contrast.
 */
const MIN_PAIR_CONTRAST = 0.06;

/**
 * Furthest apart (see `colourDistance`) two palette colours can be and still share a pair.
 * Beyond this they would clash (blue against orange), so we use a tint or shade instead.
 */
export const MAX_PAIR_DISTANCE = 0.3;

/** A lighter tint of a dark colour or a darker shade of a light one: a calm partner for any colour. */
const tonalPartner = (hex: string) => mixHex(hex, luminance(hex) < 0.5 ? '#ffffff' : '#000000', 0.3);

/**
 * Colour pairs for the board. Index 0 is the background pair; the rest are motif pairs.
 *
 * Each pair joins similar colours, so a checkerboard reads as soft tonal checks rather than a
 * hectic jump between hues. Colours are taken in order of prominence: each takes its nearest
 * unused neighbour, or a tint/shade of itself if none is close enough. The most prominent colour
 * therefore always leads the background pair. There is always at least one motif pair.
 */
export function buildColourPairs(colours: PaletteColour[], random: () => number, maxMotifPairs = 3): ColourPair[] {
	const unused = colours.map(({ hex }) => hex).filter((hex, index, all) => all.indexOf(hex) === index);

	const pairs: ColourPair[] = [];
	while (unused.length) {
		const lead = unused.shift()!;
		const nearest = unused
			.map((hex, index) => ({ hex, index, distance: colourDistance(lead, hex) }))
			.filter(({ hex, distance }) => distance <= MAX_PAIR_DISTANCE && Math.abs(luminance(lead) - luminance(hex)) >= MIN_PAIR_CONTRAST)
			.sort((a, b) => a.distance - b.distance)[0];
		if (nearest) unused.splice(nearest.index, 1);
		pairs.push([lead, nearest?.hex ?? tonalPartner(lead)]);
	}

	const [background, ...motifPairs] = pairs as [ColourPair, ...ColourPair[]];
	// A palette that all pairs up into one layer still needs something for motifs to use.
	const fallback: ColourPair = [tonalPartner(background[0]), tonalPartner(background[1])];
	return [background, ...(motifPairs.length ? shuffle(motifPairs, random).slice(0, maxMotifPairs) : [fallback])];
}
