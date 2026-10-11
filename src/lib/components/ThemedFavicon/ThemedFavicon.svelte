<script lang="ts">
	import iconSvg from '#lib/assets/favicon.svg?raw';

	interface Props {
		/** Colour of the icon, e.g. the selected palette's mid colour in the selected tone. */
		colour?: string;
	}

	/** Shown when a page has no palette to take a colour from. */
	const FALLBACK_COLOUR = '#888888';

	let { colour = FALLBACK_COLOUR }: Props = $props();

	// The icon uses `currentColor`; swapping it for a real colour tints the favicon.
	const href = $derived(`data:image/svg+xml,${encodeURIComponent(iconSvg.replace('currentColor', colour))}`);
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" {href} />
</svelte:head>
