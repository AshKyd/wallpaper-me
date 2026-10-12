import { FAN_STYLES } from './artdeco.js';
import type { PaletteVariant } from './generators.js';
import { STORM_EMOJI, isEmoji } from './emojiStorm.js';
import { CELL_FACINGS, CELL_SHAPES } from './midcentury.js';
import { NEON_SHAPES } from './neon.js';

export interface VariantOption {
	/** The key in `options`, and in the URL. */
	key: string;
	/** What the control is called. */
	label: string;
	/** Every sub-type. Leaving the option out lets the seed choose. */
	values: readonly string[];
	/** The values are glyphs (emoji), so the control shows each one itself rather than a preview of the art. */
	glyphs?: boolean;
	/** Accepts values beyond `values` (the URL and the API can set any emoji, though the control lists only some). */
	accepts?: (value: string) => boolean;
}

/** Whether `value` is something `option` can be set to. */
export const isOptionValue = (option: VariantOption, value: string) => option.values.includes(value) || (option.accepts?.(value) ?? false);

/**
 * The sub-types a variant picks from its seed, which can be fixed instead. Variants not listed have none.
 * Each value is a name from the variant's own list, so adding one there adds it here.
 */
export const VARIANT_OPTIONS: Partial<Record<PaletteVariant, readonly VariantOption[]>> = {
	artdeco: [{ key: 'style', label: 'Style', values: FAN_STYLES }],
	midcentury: [
		{ key: 'shape', label: 'Shape', values: CELL_SHAPES },
		{ key: 'facing', label: 'Facing', values: CELL_FACINGS }
	],
	'emoji-storm': [{ key: 'emoji', label: 'Emoji', values: STORM_EMOJI, glyphs: true, accepts: isEmoji }],
	neon: [{ key: 'shape', label: 'Shape', values: NEON_SHAPES }]
};

/** The options of `variant`, or none. */
export const optionsFor = (variant: PaletteVariant): readonly VariantOption[] => VARIANT_OPTIONS[variant] ?? [];
