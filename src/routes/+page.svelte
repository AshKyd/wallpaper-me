<script lang="ts">
	import { Padding } from 'svelte-akui';
	import FullscreenWallpaper from '#lib/components/FullscreenWallpaper/FullscreenWallpaper.svelte';
	import GlassPanel from '#lib/components/GlassPanel/GlassPanel.svelte';
	import ThemedFavicon from '#lib/components/ThemedFavicon/ThemedFavicon.svelte';
	import { toneColour } from '#lib/wallpaper/toneSwatches.js';
	import VariantChooser from '#lib/components/VariantChooser/VariantChooser.svelte';
	import { palettes } from '#lib/wallpaper/palettes.js';

	const [firstPalette] = palettes;
</script>

<!-- Step one: pick a variant. Each card links to its editor. -->
{#if firstPalette}
	<ThemedFavicon colour={toneColour(firstPalette, 'subtleDark')} />
	<FullscreenWallpaper palette={firstPalette} variant="bokeh" tone="subtleDark" />

	<main>
		<GlassPanel class="chooser">
			<Padding size="l">
				<h1>Wallpaper Me</h1>
				<p style="margin-bottom:.5rem">
					Pick a style to start. You can change everything afterwards.
				</p>
				<VariantChooser palette={firstPalette} />
			</Padding>
		</GlassPanel>
	</main>
{/if}

<style>
	main {
		position: fixed;
		inset: 0;
		z-index: 1;
		display: grid;
		place-items: center;
		padding: 1rem;
		overflow: auto;
	}

	main :global(.chooser) {
		width: min(60rem, 100%);
		max-height: 100%;
		overflow: auto;
	}

	h1 {
		margin: 0 0 0.25rem;
	}
</style>
