<script lang="ts">
	import { motion, reducedMotion } from 'svelte-akui';
	import PaletteBackground from '#lib/components/PaletteBackground/PaletteBackground.svelte';
	import type { Palette } from '#lib/components/PaletteBackground/paletteUtils.js';
	import type { PaletteTone } from '#lib/components/PaletteBackground/tones.js';
	import type { PaletteVariant } from '#lib/components/PaletteBackground/generators.js';
	import { hold, wipe } from '#lib/transitions/wipe.js';

	interface Props {
		palette: Palette;
		variant: PaletteVariant;
		seed?: number;
		tone?: PaletteTone;
		gap?: number;
		grain?: boolean;
		aberration?: boolean;
		/** Sub-types fixed by the user (see `VARIANT_OPTIONS`). */
		options?: Record<string, string>;
	}

	let { palette, variant, seed = 1, tone = 'original', gap = 0, grain = false, aberration = false, options = {} }: Props = $props();

	// Parallax is always on, except when the user has asked for reduced motion (system setting or akui override).
	const parallax = $derived(!reducedMotion.value);

	// A new look (variant, sub-type, palette, seed or tone) wipes in over the old one. Gap is left out on purpose:
	// it is dragged with a slider, and wiping on every tick would be unusable.
	const lookKey = $derived(`${variant}|${JSON.stringify(options)}|${palette.title}|${seed}|${tone}`);
</script>

<!-- Fixed behind everything; the interface floats above it. The host stays put while the layers inside it swap. -->
<div class="wallpaper-host">
	{#key lookKey}
		<!-- Old and new are both on screen during the wipe. The new one is later in the DOM, so it sits on top. -->
		<div class="fullscreen-wallpaper" in:wipe={motion({ duration: 800 })} out:hold={motion({ duration: 800 })}>
			<PaletteBackground {palette} {variant} {seed} {tone} {gap} {grain} {aberration} {options} {parallax} />
		</div>
	{/key}
</div>

<style>
	.wallpaper-host {
		position: fixed;
		inset: 0;
		z-index: 0;
	}

	.fullscreen-wallpaper {
		position: absolute;
		inset: 0;
	}
</style>
