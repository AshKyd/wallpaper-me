import { round, type GeneratorInput } from './canvas.js';
import { depthsOf, type DepthItem, type SizeRange } from './depth.js';
import { DEPTH_LAYERS, depthLayers } from './depthLayers.js';
import { splitColours } from './eighties.js';
import { colouriseArtwork } from './emojiColour.js';
import { OUTLINE_BOX, cachedArtwork } from './emojiOutline.js';
import { createRandom, mixHex } from './paletteUtils.js';
import { packCircles } from './packing.js';

/**
 * The emoji to pick from. None uses a variation selector, so each is one code point and compares plainly in the
 * URL and in `options`.
 */
export const STORM_EMOJI = ['📼', '💾', '📟', '🎸', '🛼', '🌴', '🚀', '💿', '📺', '🎧', '🦄', '🌈', '🔮', '🪩', '👾'] as const;
export type StormEmoji = (typeof STORM_EMOJI)[number];

/** Splits text into its emoji (user-perceived characters), whatever their length in code points. */
const graphemes = (text: string) => [...new Intl.Segmenter().segment(text)].map(({ segment }) => segment);

/** Emoji that default to plain text get the emoji variation selector, so they compare equal to the same emoji typed as a picture. */
const asEmoji = (glyph: string) => (/\p{Emoji_Presentation}/u.test(glyph) || glyph.includes('️') ? glyph : `${glyph}️`);

/** Whether `value` is exactly one emoji: a pictograph (with any modifiers or joiners), a flag, or a keycap. Anything else could not be put in the SVG safely. */
export const isEmoji = (value: string) =>
	graphemes(value).length === 1 && /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]️?⃣)/u.test(value) && !/[<>&"]/.test(value);

/** The first emoji in some typed or pasted text, or nothing if there is none. Lets a custom emoji be entered with other characters around it. */
export const emojiFrom = (text: string): string | undefined => {
	const found = graphemes(text).find(isEmoji);
	return found === undefined ? undefined : asEmoji(found);
};

/**
 * What the seed picks from: the Smileys & Emotion, Food & Drink, Animals & Nature and Objects groups of Unicode's
 * emoji list, typed in by hand (so a newer emoji may be missing). Any other emoji can still be asked for with the
 * `emoji` option.
 */
export const RANDOM_EMOJI: readonly string[] = [
	...new Set(
		graphemes(
			[
				// Smileys & Emotion
				'😀😃😄😁😆😅🤣😂🙂🙃🫠😉😊😇🥰😍🤩😘😗☺😚😙🥲😋😛😜🤪😝🤑🤗🤭🫢🫣🤫🤔🫡🤐🤨😐😑😶🫥😏😒🙄😬🤥🫨😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕🫤😟🙁☹😮😯😲😳🥺🥹😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾🙈🙉🙊💌💘💝💖💗💓💞💕💟❣💔❤🧡💛💚💙💜🤎🖤🤍💋💯💢💥💫💦💨🕳💬🗨🗯💭💤',
				// Food & Drink
				'🍇🍈🍉🍊🍋🍌🍍🥭🍎🍏🍐🍑🍒🍓🫐🥝🍅🫒🥥🥑🍆🥔🥕🌽🌶🫑🥒🥬🥦🧄🧅🍄🥜🫘🌰🫚🫛🍞🥐🥖🫓🥨🥯🥞🧇🧀🍖🍗🥩🥓🍔🍟🍕🌭🥪🌮🌯🫔🥙🧆🥚🍳🥘🍲🫕🥣🥗🍿🧈🧂🥫🍱🍘🍙🍚🍛🍜🍝🍠🍢🍣🍤🍥🥮🍡🥟🥠🥡🦀🦞🦐🦑🦪🍦🍧🍨🍩🍪🎂🍰🧁🥧🍫🍬🍭🍮🍯🍼🥛☕🫖🍵🍶🍾🍷🍸🍹🍺🍻🥂🥃🫗🥤🧋🧃🧉🧊🥢🍽🍴🥄🔪🫙🏺',
				// Animals & Nature
				'🐵🐒🦍🦧🐶🐕🦮🐩🐺🦊🦝🐱🐈🦁🐯🐅🐆🐴🫎🫏🐎🦄🦓🦌🦬🐮🐂🐃🐄🐷🐖🐗🐽🐏🐑🐐🐪🐫🦙🦒🐘🦣🦏🦛🐭🐁🐀🐹🐰🐇🐿🦫🦔🦇🐻🐨🐼🦥🦦🦨🦘🦡🐾🦃🐔🐓🐣🐤🐥🐦🐧🕊🦅🦆🦢🦉🦤🪶🦩🦚🦜🪽🪿🐸🐊🐢🦎🐍🐲🐉🦕🦖🐳🐋🐬🦭🐟🐠🐡🦈🐙🐚🪸🪼🐌🦋🐛🐜🐝🪲🐞🦗🪳🕷🕸🦂🦟🪰🪱🦠💐🌸💮🪷🏵🌹🥀🌺🌻🌼🌷🪻🌱🪴🌲🌳🌴🌵🌾🌿☘🍀🍁🍂🍃🪹🪺',
				// Objects
				'👓🕶🥽🥼🦺👔👕👖🧣🧤🧥🧦👗👘🥻🩱🩲🩳👙👚👛👜👝🛍🎒🩴👞👟🥾🥿👠👡🩰👢👑👒🎩🎓🧢🪖⛑📿💄💍💎🔇🔈🔉🔊📢📣📯🔔🔕🎼🎵🎶🎙🎚🎛🎤🎧📻🎷🪗🎸🎹🎺🎻🪕🥁🪘📱📲☎📞📟📠🔋🪫🔌💻🖥🖨⌨🖱🖲💽💾💿📀🧮🎥🎞📽🎬📺📷📸📹📼🔍🔎🕯💡🔦🏮🪔📔📕📖📗📘📙📚📓📒📃📜📄📰🗞📑🔖🏷💰🪙💴💵💶💷💸💳🧾✉📧📨📩📤📥📦📫📪📬📭📮🗳✏✒🖋🖊🖌🖍📝💼📁📂🗂📅📆🗒🗓📇📈📉📊📋📌📍📎🖇📏📐✂🗃🗄🗑🔒🔓🔏🔐🔑🗝🔨🪓⛏⚒🛠🗡⚔🔫🪃🏹🛡🪚🔧🪛🔩⚙🗜⚖🦯🔗⛓🪝🧰🧲🪜⚗🧪🧫🧬🔬🔭📡💉🩸💊🩹🩼🩺🩻🚪🛗🪞🪟🛏🛋🪑🚽🪠🚿🛁🪤🪒🧴🧷🧹🧺🧻🪣🧼🫧🪥🧽🧯🛒🚬⚰🪦⚱🧿🪬🗿🪧🪪'
			].join('')
		).map(asEmoji)
	)
];

/**
 * Packing: far smaller circles than the plain `80s` variant, a tighter gap (nothing is stroked, so nothing spills
 * past the circle) and many more tries, so the canvas is full of emoji. Radii run from `minRadius` to
 * `minRadius + maxRadius`.
 */
export const PACKING = { minRadius: 10, maxRadius: 60, attempts: 80000, gap: 3 } as const;
const SIZE_RANGE: SizeRange = { smallest: PACKING.minRadius, largest: PACKING.minRadius + PACKING.maxRadius };

/** An emoji's width as a share of its circle's radius. Under 2 (the diameter), so it stays inside the circle even when it leans. */
export const EMOJI_SCALE = 1.6;
/** Emoji lean this far either way (degrees) instead of turning all the way round, which would leave most of them upside down. */
const MAX_TILT = 25;

/** Blur (the filter's standard deviation, in canvas units) of the furthest depth layer. The nearest layer is sharp, and those between are in even steps. */
export const MAX_BLUR = 4;
/** How much of the way from the top colour to the second darkest the background gradient reaches at the bottom. Low, so emoji in that colour still stand out. */
const GRADIENT_REACH = 0.35;

/** Blur for a depth layer (0 is the furthest, `DEPTH_LAYERS - 1` the nearest). */
export const blurForLayer = (layer: number) => round(MAX_BLUR * (1 - layer / (DEPTH_LAYERS - 1)));

/** Blurs whatever uses it by `blur`. The region is larger than the emoji's box, so the blur isn't cut off at its edge. */
export const blurFilter = ({ id, blur }: { id: string; blur: number }) =>
	`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur}"/></filter>`;

interface PlacedEmoji {
	x: number;
	y: number;
	radius: number;
	/** Degrees, within `MAX_TILT` either way. */
	tilt: number;
	colour: string;
	/** Which depth layer it is in, 0 (furthest, blurriest) to `DEPTH_LAYERS - 1` (nearest, sharp). */
	layer: number;
}

/** The ids of the colourised drawings (one per colour) and of the blur filters (one per depth layer), so the shapes and the `<defs>` agree. */
const drawingId = ({ idPrefix, colourIndex }: { idPrefix: string; colourIndex: number }) => `${idPrefix}-emoji-${colourIndex}`;
const blurId = ({ idPrefix, layer }: { idPrefix: string; layer: number }) => `${idPrefix}-emoji-blur-${layer}`;

/**
 * The emoji drawn for a seed and options: the `emoji` option, or the seed's pick. The pick is the seed's first
 * draw, so this can say which emoji to load (`loadEmojiOutline()`) before the art is made.
 */
export function emojiChoice({ seed = 1, options }: Pick<GeneratorInput, 'seed' | 'options'>): string {
	const seeded = RANDOM_EMOJI[Math.floor(createRandom(seed)() * RANDOM_EMOJI.length)]!;
	return options?.emoji && isEmoji(options.emoji) ? asEmoji(options.emoji) : seeded;
}

/** Variants that draw Twemoji artwork, which must be loaded (`loadEmojiOutline()`) before the art is made. */
export const usesEmojiArtwork = (variant: string) => variant === 'emoji-storm' || variant === 'emoji-neon';

/** Drawn in place of the emoji when its artwork is missing or not loaded yet, so the picture still has its layout. */
const PLACEHOLDER = `<circle cx="${OUTLINE_BOX / 2}" cy="${OUTLINE_BOX / 2}" r="${OUTLINE_BOX * 0.4}" fill="#808080"/>`;

/**
 * The 80s pastiche's packing of circles (largest first, so big ones anchor the layout), with an emoji in every
 * one, sized to its circle. Emoji further from the foreground are smaller, and blurrier: a circle's size gives its
 * depth (as for parallax, see `depthsOf()`), which picks one of `DEPTH_LAYERS` blur steps.
 *
 * The emoji is Twemoji's drawing (see `loadEmojiOutline()`, which must have finished, or grey discs are drawn).
 * It is recoloured as SVG: every fill but white and black becomes a palette colour (see `colouriseArtwork()`).
 * There is one copy per colour left over by the background, each dealing the palette out differently, defined once
 * in `<defs>`, and each emoji is a `<use>` of one. The `<defs>`
 * also hold the gradient and the blur for each depth layer, and stay put with parallax. The background is a
 * gradient from the palette's darkest colour towards the second darkest, top to bottom. The emoji is the `emoji`
 * option, or the seed's pick.
 */
export function emojiStormArt({ colours, random, seed, width, height, idPrefix, options, depth }: GeneratorInput): string {
	const { background, foregrounds } = splitColours(colours);
	// Drawn first, and always, so asking for an emoji doesn't change the rest of the picture.
	const emoji = emojiChoice({ seed, options });
	random();
	const circles = packCircles({ random, width, height, ...PACKING });

	// Depth by size, nudged a little by position (see `depthsOf()`), then split into the layers parallax uses.
	const depths = depthsOf(circles.map(({ x, y, radius }) => ({ markup: `${x},${y}`, size: radius })), SIZE_RANGE);
	const placed = circles.map(({ x, y, radius }, index): PlacedEmoji => ({
		x,
		y,
		radius,
		tilt: (random() - 0.5) * 2 * MAX_TILT,
		colour: foregrounds[Math.floor(random() * foregrounds.length)]!,
		layer: Math.min(DEPTH_LAYERS - 1, Math.floor(depths[index]! * DEPTH_LAYERS))
	}));

	const items = placed.map(({ x, y, radius, tilt, colour, layer }): DepthItem => {
		const scale = (radius * EMOJI_SCALE) / OUTLINE_BOX;
		const blur = blurForLayer(layer) > 0 ? ` filter="url(#${blurId({ idPrefix, layer })})"` : '';
		return {
			markup: `<use href="#${drawingId({ idPrefix, colourIndex: foregrounds.indexOf(colour) })}" transform="translate(${round(x)} ${round(y)}) rotate(${round(tilt)}) scale(${Math.round(scale * 1000) / 1000}) translate(${-OUTLINE_BOX / 2} ${-OUTLINE_BOX / 2})"${blur}/>`,
			size: radius
		};
	});

	const artwork = cachedArtwork(emoji) ?? PLACEHOLDER;
	const drawings = foregrounds.map((_, colourIndex) => `<g id="${drawingId({ idPrefix, colourIndex })}">${colouriseArtwork({ artwork, palette: foregrounds, shift: colourIndex })}</g>`).join('');
	const blurs = Array.from({ length: DEPTH_LAYERS }, (_, layer) => layer)
		.filter((layer) => blurForLayer(layer) > 0)
		.map((layer) => blurFilter({ id: blurId({ idPrefix, layer }), blur: blurForLayer(layer) }))
		.join('');

	// The gradient only reaches part of the way to the second darkest colour; a one-colour palette's second colour is white.
	const gradientId = `${idPrefix}-emoji-ground`;
	const bottom = mixHex(background, foregrounds[0]!, GRADIENT_REACH);
	const ground = `<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${height}"><stop offset="0" stop-color="${background}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;

	const layers = depthLayers({ items, range: SIZE_RANGE, settings: depth });
	return `<defs>${ground}${blurs}${drawings}</defs><rect width="${width}" height="${height}" fill="url(#${gradientId})"/>${layers}`;
}
