import { BOKEH_RADIUS_RANGE, bokehLights, splitBokehColours } from './bokeh.js';
import { round, type GeneratorInput } from './canvas.js';
import type { DepthItem } from './depth.js';
import { depthLayers } from './depthLayers.js';
import { OUTLINE_BOX, cachedOutline } from './emojiOutline.js';
import { emojiChoice } from './emojiStorm.js';
import { LAYERS, MAIN_WIDTH, glowColour } from './neon.js';
import { luminance, mixHex } from './paletteUtils.js';

/** The emoji's width as a share of the canvas's shorter side. */
const EMOJI_SHARE = 0.5;
/**
 * The neon rings' line widths and blurs, scaled to the emoji: it is large, so lines get the rings' full
 * widths, but its lines are still close together, so no wider than that.
 */
const LINE_SCALE = 1;
/** A really tight blur of the palette's lightest colour right around the line, so the white core seems to bleed into the colour. */
const LIGHT_GLOW = { name: 'light', width: 6, blur: 1.5, opacity: 0.8 } as const;
/** Most the glows' hue can turn from the true colour, in degrees. */
const HUE_TURN = 10;

/** Drawn when the emoji's outline is missing or not loaded yet, so the picture still has its layout. */
const PLACEHOLDER = `<circle cx="${OUTLINE_BOX / 2}" cy="${OUTLINE_BOX / 2}" r="${OUTLINE_BOX * 0.4}"/>`;

/**
 * Neon outlines of one emoji, packed into circles like `emoji-storm`. The emoji is Twemoji's drawing, so its real
 * outline is stroked, with no fill: the lines are the shapes' edges, glowing over a dark gradient. The art is
 * `neon`'s three layers (a wide blur, a narrower one, then a tight blur of the lightest colour and a sharp white line). The outline is defined once in
 * `<defs>`, and every emoji is a `<use>` of it, so the markup stays small. Each layer is one group with one blur
 * filter. The outline must be loaded first (`loadEmojiOutline()`), or placeholder rings are drawn.
 */
export function emojiNeonArt(input: GeneratorInput): string {
	const { colours, random, idPrefix, width, height } = input;
	// The emoji is drawn first, so what the random stream gives for the rest does not depend on whether one was asked for.
	const emoji = emojiChoice({ seed: input.seed, options: input.options });
	random();
	const { background, lights } = splitBokehColours(colours.map(({ hex }) => hex));

	const [groundFrom, groundTo = mixHex(groundFrom!, '#000000', 0.45)] = background;
	const groundId = `${idPrefix}-emoji-neon-ground`;
	const outlineId = `${idPrefix}-emoji-neon-outline`;
	const blurId = (name: string) => `${idPrefix}-emoji-neon-${name}`;
	const outline = cachedOutline(emoji) ?? PLACEHOLDER;

	// A filter's region is the whole canvas and a margin, as the glow reaches past the lines.
	const defs = [
		`<linearGradient id="${groundId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="${height}"><stop offset="0" stop-color="${groundFrom}"/><stop offset="1" stop-color="${groundTo}"/></linearGradient>`,
		...[...LAYERS, LIGHT_GLOW].map(
			({ name, blur }) =>
				`<filter id="${blurId(name)}" filterUnits="userSpaceOnUse" x="-100" y="-100" width="${width + 200}" height="${height + 200}"><feGaussianBlur stdDeviation="${round(blur * LINE_SCALE)}"/></filter>`
		),
		`<g id="${outlineId}">${outline}</g>`
	].join('');

	// One emoji, centred, sized against the shorter side so it fits portrait and landscape alike.
	const scale = (Math.min(width, height) * EMOJI_SHARE) / OUTLINE_BOX;
	// Always the palette's first light for the glow, never a random one, so a palette always glows the same colour.
	const [colour] = lights as [string, ...string[]];

	/** The emoji as a stroked `<use>` at the layer's width. A line is `width` canvas units wide whatever the emoji's size. */
	const emojiOf = (strokeWidth: number, colourOf: (hex: string) => string) =>
		`<use href="#${outlineId}" transform="translate(${round(width / 2)} ${round(height / 2)}) scale(${round(scale)}) translate(${-OUTLINE_BOX / 2} ${-OUTLINE_BOX / 2})" fill="none" stroke="${colourOf(colour)}" stroke-width="${round(strokeWidth / scale)}" stroke-linecap="round" stroke-linejoin="round"/>`;

	const colouredGlows = LAYERS.map(
		({ name, width: strokeWidth, opacity, chromaBoost, hueShift }) =>
			`<g filter="url(#${blurId(name)})" opacity="${opacity}">${emojiOf(strokeWidth, (hex) => glowColour(hex, { chromaBoost, hueTurn: HUE_TURN * hueShift }))}</g>`
	);
	// The lightest of the whole palette (not just the lights), the same whatever the seed.
	const lightest = colours.map(({ hex }) => hex).reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
	const lightGlow = `<g filter="url(#${blurId(LIGHT_GLOW.name)})" opacity="${LIGHT_GLOW.opacity}">${emojiOf(LIGHT_GLOW.width, () => lightest)}</g>`;
	// The light glow hugs the line, so it is drawn over the coloured glows and just under the sharp line.
	const glows = [...colouredGlows, lightGlow];
	// The sharp line is white, as a lit neon tube is, so the palette colour reads as its glow.
	const main = `<g>${emojiOf(MAIN_WIDTH, () => '#ffffff')}</g>`;

	// The bokeh sits behind the emoji, out of focus. The emoji takes the nearest depth (the largest size in the
	// bokeh's flipped range), so with parallax on it slides furthest and is drawn on top of the lights.
	const bokeh = bokehLights({ lights, random, idPrefix, width, height });
	const emojiItems = [...glows, main].map((markup): DepthItem => ({ size: BOKEH_RADIUS_RANGE.largest, markup }));
	const layers = depthLayers({ items: [...bokeh.items, ...emojiItems], range: BOKEH_RADIUS_RANGE, settings: input.depth });

	return `<defs>${defs}${bokeh.defs}</defs><rect width="${width}" height="${height}" fill="url(#${groundId})"/>${layers}`;
}
