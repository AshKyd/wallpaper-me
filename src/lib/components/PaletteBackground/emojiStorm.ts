import { round, type GeneratorInput } from './canvas.js';
import { depthsOf, type DepthItem, type SizeRange } from './depth.js';
import { DEPTH_LAYERS, depthLayers } from './depthLayers.js';
import { splitColours } from './eighties.js';
import { mixHex } from './paletteUtils.js';
import { packCircles } from './packing.js';

/**
 * The emoji to pick from. None uses a variation selector, so each is one code point and compares plainly in the
 * URL and in `options`.
 */
export const STORM_EMOJI = ['📼', '💾', '📟', '🎸', '🛼', '🌴', '🚀', '💿', '📺', '🎧', '🦄', '🌈', '🔮', '🪩', '👾'] as const;
export type StormEmoji = (typeof STORM_EMOJI)[number];

/** Splits text into its emoji (user-perceived characters), whatever their length in code points. */
const graphemes = (text: string) => [...new Intl.Segmenter().segment(text)].map(({ segment }) => segment);

/** Emoji that default to plain text get the emoji variation selector, or they'd draw as a flat glyph that the filter can't shade. */
const asEmoji = (glyph: string) => (/\p{Emoji_Presentation}/u.test(glyph) || glyph.includes('️') ? glyph : `${glyph}️`);

/** Whether `value` is exactly one emoji: a pictograph (with any modifiers or joiners), a flag, or a keycap. Anything else could not be put in the SVG safely. */
export const isEmoji = (value: string) =>
	graphemes(value).length === 1 && /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]️?⃣)/u.test(value) && !/[<>&"]/.test(value);

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

/** Font size as a share of the circle's radius. An emoji is about one em across, so this keeps it inside the circle even when it leans. */
export const EMOJI_SCALE = 1.6;
const EMOJI_FONT = 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
/** Emoji lean this far either way (degrees) instead of turning all the way round, which would leave most of them upside down. */
const MAX_TILT = 25;

/** Blur (the filter's standard deviation, in canvas units) of the furthest depth layer. The nearest layer is sharp, and those between are in even steps. */
export const MAX_BLUR = 4;
/** How much of the way from the top colour to the second darkest the background gradient reaches at the bottom. Low, so emoji in that colour still stand out. */
const GRADIENT_REACH = 0.35;

/** Blur for a depth layer (0 is the furthest, `DEPTH_LAYERS - 1` the nearest). */
export const blurForLayer = (layer: number) => round(MAX_BLUR * (1 - layer / (DEPTH_LAYERS - 1)));

/**
 * Turns an emoji into a flat, one-colour silhouette with its shading kept: greyed, soft-light blended onto the colour
 * (so mid grey is the colour itself, darker greys shade it darker and lighter ones lighter, and nothing clips to
 * black or white; `multiply` left dark parts dark and coloured only the highlights, and `screen` blew the lights
 * out to white), masked by the emoji's own outline
 * so nothing is painted around it, and last blurred by `blur` (none if 0), which softens the edge into the background.
 * The blurred filter's region is larger, so the blur isn't cut off at the emoji's box.
 */
export const tintFilter = ({ id, colour, blur = 0 }: { id: string; colour: string; blur?: number }) =>
	`<filter id="${id}" color-interpolation-filters="sRGB"${blur > 0 ? ' x="-50%" y="-50%" width="200%" height="200%"' : ''}><feColorMatrix in="SourceGraphic" type="saturate" values="0" result="grey"/><feFlood flood-color="${colour}" result="tint"/><feBlend in="grey" in2="tint" mode="soft-light" result="mixed"/><feComposite in="mixed" in2="SourceGraphic" operator="in"${blur > 0 ? ' result="masked"/><feGaussianBlur in="masked" stdDeviation="' + blur + '"' : ''}/></filter>`;

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

/** The ids of the filters, by colour and depth layer, so the shapes and the `<defs>` agree. */
const filterId = ({ idPrefix, colourIndex, layer }: { idPrefix: string; colourIndex: number; layer: number }) => `${idPrefix}-emoji-${colourIndex}-${layer}`;

/**
 * The 80s pastiche's packing of circles (largest first, so big ones anchor the layout), with an emoji in every
 * one, sized to its circle. Emoji further from the foreground are smaller, and blurrier: a circle's size gives its
 * depth (as for parallax, see `depthsOf()`), which picks one of `DEPTH_LAYERS` blur steps.
 *
 * The background is a gradient from the palette's darkest colour towards the second darkest, top to bottom. Each
 * emoji is tinted one of the colours left over (see `tintFilter()`). The filters are defined once for each colour
 * and blur, in a `<defs>` that stays put with parallax. The emoji is the `emoji` option, or the seed's pick.
 */
export function emojiStormArt({ colours, random, width, height, idPrefix, options, depth }: GeneratorInput): string {
	const { background, foregrounds } = splitColours(colours);
	const circles = packCircles({ random, width, height, ...PACKING });
	// Always drawn, so asking for an emoji doesn't change the rest of the picture.
	const seeded = RANDOM_EMOJI[Math.floor(random() * RANDOM_EMOJI.length)]!;
	const emoji = options?.emoji && isEmoji(options.emoji) ? asEmoji(options.emoji) : seeded;

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
		const id = filterId({ idPrefix, colourIndex: foregrounds.indexOf(colour), layer });
		return {
			markup: `<text x="${round(x)}" y="${round(y)}" font-size="${round(radius * EMOJI_SCALE)}" font-family="${EMOJI_FONT}" text-anchor="middle" dominant-baseline="central" transform="rotate(${round(tilt)} ${round(x)} ${round(y)})" filter="url(#${id})">${emoji}</text>`,
			size: radius
		};
	});

	const filters = foregrounds
		.flatMap((colour, colourIndex) =>
			Array.from({ length: DEPTH_LAYERS }, (_, layer) => tintFilter({ id: filterId({ idPrefix, colourIndex, layer }), colour, blur: blurForLayer(layer) }))
		)
		.join('');

	// The gradient only reaches part of the way to the second darkest colour; a one-colour palette's second colour is white.
	const gradientId = `${idPrefix}-emoji-ground`;
	const bottom = mixHex(background, foregrounds[0]!, GRADIENT_REACH);
	const ground = `<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${height}"><stop offset="0" stop-color="${background}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;

	const layers = depthLayers({ items, range: SIZE_RANGE, settings: depth });
	return `<defs>${ground}${filters}</defs><rect width="${width}" height="${height}" fill="url(#${gradientId})"/>${layers}`;
}
