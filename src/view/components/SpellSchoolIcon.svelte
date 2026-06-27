<script lang="ts">
	import isImageIcon from '#utils/isImageIcon.js';

	interface Props {
		/** Either a Font Awesome class (built-in schools) or an image path (custom schools). */
		icon: string;
		/** Classes applied to the rendered `<i>` or `<img>` so call sites keep their styling. */
		class?: string;
		/** Accessible label for image icons; decorative Font Awesome icons stay aria-hidden. */
		alt?: string;
	}

	let { icon, class: className = '', alt = '' }: Props = $props();
</script>

{#if isImageIcon(icon)}
	<img class={className} src={icon} {alt} />
{:else}
	<i class="{className} {icon}" aria-hidden="true"></i>
{/if}

<style lang="scss">
	// Render image icons at the surrounding text size so they line up with the
	// Font Awesome icons used by built-in schools, regardless of call site.
	img {
		width: 1em;
		height: 1em;
		object-fit: contain;
		border: none;
		vertical-align: middle;
	}
</style>
