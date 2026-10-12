<script lang="ts">
	import { cubicInOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import { Button, FeedbackButton, Field, Icon, InputGroup, SelectableItem, TextInput, motion } from 'svelte-akui';
	import { WIPE_DURATION, hold } from '#lib/transitions/wipe.js';
	import PaletteBackground from '#lib/components/PaletteBackground/PaletteBackground.svelte';
	import { PALETTE_VARIANTS } from '#lib/components/PaletteBackground/generators.js';
	import type { Palette } from '#lib/components/PaletteBackground/paletteUtils.js';
	import { emojiFrom } from '#lib/components/PaletteBackground/emojiStorm.js';
	import TwemojiImage from '#lib/components/TwemojiImage/TwemojiImage.svelte';
	import { optionsFor } from '#lib/components/PaletteBackground/variantOptions.js';
	import { toneLabel, toneSwatches } from '#lib/wallpaper/toneSwatches.js';
	import { SEED_MAX, type WallpaperSettings } from '#lib/wallpaper/wallpaperSettings.js';

	interface Props {
		settings: WallpaperSettings;
		palettes: Palette[];
		/** Called with just the properties the user changed. */
		onchange: (patch: Partial<WallpaperSettings>) => void;
		/** Saves the wallpaper as an image. Returning a promise makes the button show progress and the result. */
		ondownload: () => Promise<void>;
	}

	let { settings, palettes, onchange, ondownload }: Props = $props();

	const uniqueId = $props.id();

	const currentPalette = $derived(palettes[settings.paletteIndex] ?? palettes[0]!);
	/** The palette's mid colour in each tone, so the choices preview what each tone does to this palette. */
	const swatches = $derived(toneSwatches(currentPalette));

	const newSeed = () => onchange({ seed: 1 + Math.floor(Math.random() * SEED_MAX) });

	const variantOptions = $derived(optionsFor(settings.variant));

	/** The current options with `key` set to `value`; an empty value puts the choice back with the seed, by leaving it out. */
	function optionsWith(key: string, value: string): Record<string, string> {
		const { [key]: _removed, ...rest } = settings.options;
		return value ? { ...rest, [key]: value } : rest;
	}

	const setOption = (key: string, value: string) => onchange({ options: optionsWith(key, value) });

	/** `subtleDark` -> `Subtle dark`; `sharp` -> `Sharp`. */
	const sentenceCase = (name: string) => name.replace(/([A-Z])/g, ' $1').replace(/^./, (first) => first.toUpperCase()).replace(/ ([A-Z])/g, (_, letter: string) => ` ${letter.toLowerCase()}`);
</script>

{#snippet slider({ id, label, value, min, max, step, key }: {
	id: string;
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	key: 'gap';
})}
	<Field {label} for="{uniqueId}-{id}">
		<input
			id="{uniqueId}-{id}"
			type="range"
			{min}
			{max}
			{step}
			{value}
			oninput={(event) => onchange({ [key]: Number(event.currentTarget.value) })}
		/>
	</Field>
{/snippet}

<div class="wallpaper-controls">
	<Field label="Variant">
		<div class="variant-grid" role="radiogroup" aria-label="Variant">
			{#each PALETTE_VARIANTS as variant (variant)}
				<SelectableItem
					name="{uniqueId}-variant"
					value={variant}
					group={settings.variant}
					onchange={() => onchange({ variant })}
				>
					<!-- A live preview in the current palette and tone; the name is for screen readers only. -->
					<span class="variant-preview" aria-hidden="true">
						<!-- A new palette or tone fades in over the old preview, which stays until it is covered (as with the wallpaper). -->
						{#key `${currentPalette.title}|${settings.tone}`}
							<span class="variant-layer" in:fade={motion({ duration: WIPE_DURATION, easing: cubicInOut })} out:hold={motion({ duration: WIPE_DURATION })}>
								<PaletteBackground palette={currentPalette} {variant} tone={settings.tone} seed={1} />
							</span>
						{/key}
					</span>
					<span class="sr-only">{variant}</span>
				</SelectableItem>
			{/each}
		</div>
	</Field>

	<!-- The sub-types this variant would otherwise pick from the seed. Left on "From seed", the seed decides. -->
	{#each variantOptions as { key, label, values, glyphs, accepts } (key)}
		{@const chosen = settings.options[key] ?? ''}
		<Field {label}>
			<div class="variant-grid" role="radiogroup" aria-label={label}>
				<!-- Each tile previews this variant with that sub-type fixed (and the other options as they are now). The first leaves it to the seed. -->
				{#each ['', ...values] as value (value)}
					<SelectableItem
						name="{uniqueId}-option-{key}"
						{value}
						group={settings.options[key] ?? ''}
						onchange={() => setOption(key, value)}
					>
						<span class="variant-preview" aria-hidden="true">
							{#if value === ''}
								<!-- No preview: this tile means "the seed decides", which a dice says better than any one result. -->
								<span class="seed-tile"><Icon name="dice-5" size="1.5rem" /></span>
							{:else if glyphs}
								<!-- Glyph options are shown as themselves: a preview of the art would look much the same each time. -->
								<span class="seed-tile glyph-tile"><TwemojiImage emoji={value} /></span>
							{:else}
								{#key `${currentPalette.title}|${settings.tone}|${settings.seed}`}
									<span class="variant-layer" in:fade={motion({ duration: WIPE_DURATION, easing: cubicInOut })} out:hold={motion({ duration: WIPE_DURATION })}>
										<PaletteBackground
											palette={currentPalette}
											variant={settings.variant}
											tone={settings.tone}
											seed={settings.seed}
											options={optionsWith(key, value)}
										/>
									</span>
								{/key}
							{/if}
						</span>
						<span class="sr-only">{value ? sentenceCase(value) : 'From seed'}</span>
					</SelectableItem>
				{/each}
				<!-- A custom choice is not in the list, so it gets a tile of its own while it is the one chosen. -->
				{#if glyphs && chosen && !values.includes(chosen)}
					<SelectableItem name="{uniqueId}-option-{key}" value={chosen} group={chosen} onchange={() => setOption(key, chosen)}>
						<span class="variant-preview" aria-hidden="true"><span class="seed-tile glyph-tile"><TwemojiImage emoji={chosen} /></span></span>
						<span class="sr-only">Custom {label.toLowerCase()}</span>
					</SelectableItem>
				{/if}
			</div>
		</Field>
		<!-- Anything typed or pasted is reduced to its first emoji, which is drawn from Twemoji whatever the system's emoji look like. -->
		{#if accepts}
			<Field label="Custom {label.toLowerCase()}" for="{uniqueId}-custom-{key}" hint="Type or paste any emoji. It is drawn as Twemoji.">
				<TextInput
					id="{uniqueId}-custom-{key}"
					placeholder="🦖"
					autocomplete="off"
					oninput={(event: Event) => {
						const custom = emojiFrom((event.currentTarget as HTMLInputElement).value);
						if (custom) setOption(key, custom);
					}}
				/>
			</Field>
		{/if}
	{/each}

	<Field label="Palette">
		<div class="palette-list" role="radiogroup" aria-label="Palette">
			{#each palettes as { title, colors }, index (index)}
				<SelectableItem
					class="palette-item"
					name="{uniqueId}-palette"
					value={String(index)}
					group={String(settings.paletteIndex)}
					onchange={() => onchange({ paletteIndex: index })}
				>
					<span class="swatches" aria-hidden="true">
						<!-- Keyed by position: a palette can repeat a hex. -->
						{#each colors as { hex }, colourIndex (colourIndex)}
							<span style:background={hex}></span>
						{/each}
					</span>
					<span class="sr-only">{title}</span>
				</SelectableItem>
			{/each}
		</div>

		<!-- The chosen palette's name and credit. Both lines always take their space, so the controls below
		     don't move when you pick a palette that has no creator or link. -->
		<p class="palette-credit">
			<strong class="palette-name">{currentPalette.title}</strong>
			<small class="palette-attribution">
				{#if currentPalette.creator}by {currentPalette.creator}{/if}
				{#if currentPalette.url}
					<a href={currentPalette.url} target="_blank" rel="noopener noreferrer">{currentPalette.creator ? '(source)' : 'Source'}</a>
				{/if}
			</small>
		</p>
	</Field>

	<Field label="Tone">
		<div class="tone-grid" role="radiogroup" aria-label="Tone">
			{#each swatches as { tone, hex } (tone)}
				<SelectableItem name="{uniqueId}-tone" value={tone} group={settings.tone} onchange={() => onchange({ tone })}>
					<span class="tone-swatch" style:background={hex} aria-hidden="true"></span>
					<span class="tone-name">{toneLabel(tone)}</span>
				</SelectableItem>
			{/each}
		</div>
	</Field>

	<Field label="Seed" for="{uniqueId}-seed" hint="The same seed always gives the same arrangement.">
		<!-- InputGroup gives the field and the button the same size, so they are the same height. -->
		<InputGroup size="medium">
			<TextInput
				id="{uniqueId}-seed"
				type="number"
				min="1"
				max={SEED_MAX}
				step="1"
				value={settings.seed}
				onchange={(event: Event) => onchange({ seed: Number((event.currentTarget as HTMLInputElement).value) })}
			/>
			<Button icon="shuffle" iconPosition="only" aria-label="New random seed" onclick={newSeed} />
		</InputGroup>
	</Field>

	{#if settings.variant === 'hexagons' || settings.variant === 'mondrian'}
		{@render slider({ id: 'gap', label: 'Border', value: settings.gap, min: 0, max: 0.4, step: 0.02, key: 'gap' })}
	{/if}
	<label class="grain-toggle">
		<input type="checkbox" checked={settings.grain} onchange={(event) => onchange({ grain: event.currentTarget.checked })} />
		Grain
	</label>
	<label class="grain-toggle">
		<input type="checkbox" checked={settings.aberration} onchange={(event) => onchange({ aberration: event.currentTarget.checked })} />
		Chromatic aberration
	</label>
	<!-- Parallax has no controls: it is always on unless Reduced Motion is. -->

	<FeedbackButton class="download" variant="accent" icon="download" label="Download wallpaper" errorAriaLabel="Download failed" onclick={ondownload} />
</div>

<style>
	.wallpaper-controls {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.palette-credit {
		display: flex;
		flex-direction: column;
		margin: 0.5rem 0 0;
		padding: 0 4px;
	}

	/* One line each, truncated, so a long name or creator can't change the height either. */
	.palette-name,
	.palette-attribution {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		line-height: 1.4;
	}

	/* Empty when a palette has no creator or link, but the line is still reserved. */
	.palette-attribution {
		min-height: 1.4em;
	}

	.wallpaper-controls :global(.download) {
		width: 100%;
	}

	.grain-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 4px;
		cursor: pointer;
	}

	input[type='range'] {
		width: 100%;
	}

	/*
	 * akui's selected glow is a faint inset shadow, which busy artwork hides. These lists add a solid accent
	 * ring on the Glow overlay (it paints above the contents), keeping akui's own inset shadow on top of it.
	 */
	.variant-grid :global(.akui-selectable[data-checked='true'] .akui-glow),
	.tone-grid :global(.akui-selectable[data-checked='true'] .akui-glow),
	.palette-list :global(.akui-selectable[data-checked='true'] .akui-glow) {
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.1),
			inset 0 0 0 2px var(--akui-bg-accent),
			inset 0 0 12px 2px rgba(var(--akui-bg-accent-rgb), 0.6);
	}

	/* Padding leaves room for each item's focus ring. */
	.variant-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		padding: 4px;
	}

	.tone-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		padding: 4px;
	}

	.tone-grid :global(.akui-selectable) {
		background: var(--akui-bg-secondary);
	}

	/*
	 * The swatches change colour when the palette does, in step with the wallpaper's circle wipe: same duration
	 * (WIPE_DURATION, 800ms) and easing (cubicInOut from svelte/easing, written as its cubic-bezier).
	 * akui's UIRoot stops CSS transitions under Reduced Motion, so this is instant there.
	 */
	.tone-swatch {
		display: block;
		height: 2.5rem;
		transition: background-color 800ms cubic-bezier(0.645, 0.045, 0.355, 1);
	}

	.tone-name {
		display: block;
		padding: 0.3rem 0.25rem;
		font-size: 0.75rem;
		text-align: center;
	}

	.variant-preview {
		position: relative;
		display: block;
		height: 3.5rem;
	}

	/* The "seed decides" tile: an icon on a plain ground, the height of a preview. */
	.seed-tile {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		background: var(--akui-bg-secondary);
	}

	.glyph-tile {
		font-size: 1.75rem;
	}

	/* Old and new previews overlap while crossfading. */
	.variant-layer {
		position: absolute;
		inset: 0;
	}

	/* Never scrolls itself: the panel does, so there is no scroll area inside a scroll area. The padding leaves room for each item's focus ring. */
	.palette-list {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		padding: 4px;
	}

	/* The class is passed to SelectableItem, so it lands on an element this component's scoping can't see. */
	.palette-list :global(.palette-item) {
		background: var(--akui-bg-secondary);
	}

	/* The palette's colours as equal vertical stripes. */
	.swatches {
		display: flex;
		aspect-ratio: 3 / 2;
	}

	.swatches span {
		flex: 1;
	}
</style>
