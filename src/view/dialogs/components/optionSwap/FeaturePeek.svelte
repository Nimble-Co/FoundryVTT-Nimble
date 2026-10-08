<script lang="ts">
	import type { FeaturePeekProps } from '#types/components/FeaturePeek.d.ts';

	import { createFeatureCardState } from '../characterCreator/FeatureCard.svelte.ts';
	import SpellReferenceCard from '../characterCreator/SpellReferenceCard.svelte';

	let { feature, anchor, note = '' }: FeaturePeekProps = $props();

	const CARD_WIDTH = 20 * 16;
	const CARD_HEIGHT = 16 * 16;
	const GAP = 6;

	const card = createFeatureCardState(() => feature);

	// The card follows the anchor, and flips above it rather than off the bottom of the screen.
	const placement = $derived.by(() => {
		const rect = anchor.getBoundingClientRect();
		const left = Math.max(GAP, Math.min(rect.left, window.innerWidth - CARD_WIDTH - GAP));
		const fitsBelow = rect.bottom + CARD_HEIGHT < window.innerHeight;

		return fitsBelow
			? `top: ${rect.bottom + GAP}px; left: ${left}px;`
			: `bottom: ${window.innerHeight - rect.top + GAP}px; left: ${left}px;`;
	});

	/** Moves the card to the body, so the dialog it belongs to cannot clip it. */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}
</script>

<div class="nimble-option-peek" style={placement} role="tooltip" use:portal>
	<header class="nimble-option-peek__header">
		<img class="nimble-option-peek__img" src={feature.img} alt="" />
		<strong class="nimble-option-peek__name">{feature.name}</strong>
	</header>

	{#if note}
		<p class="nimble-option-peek__note">{note}</p>
	{/if}

	{#if card.hasDescription}
		<div class="nimble-option-peek__body">
			{#each card.descriptionParts as part, index (index)}
				{#if part.type === 'spell' && part.spell}
					<SpellReferenceCard spell={part.spell} />
				{:else}
					{@html part.content}
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-option-peek {
		position: fixed;
		z-index: var(--z-index-tooltip, 9999);
		width: 20rem;
		max-height: 16rem;
		overflow: hidden;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--nimble-accent-color);
		border-radius: 8px;
		background: var(--nimble-box-background-color);
		color: var(--nimble-dark-text-color);
		box-shadow: 0 8px 24px rgb(0 0 0 / 45%);
		font-size: var(--nimble-sm-text);
		pointer-events: none;

		&__header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-block-end: 0.375rem;
		}

		&__img {
			width: 2rem;
			height: 2rem;
			border: none;
			border-radius: 6px;
			object-fit: cover;
		}

		&__note {
			margin: 0 0 0.375rem;
			padding: 0.125rem 0.5rem;
			border-radius: 4px;
			background: hsl(0deg 0% 100% / 8%);
			font-size: var(--nimble-xs-text);
		}

		&__body {
			color: var(--nimble-medium-text-color);
			line-height: 1.35;

			:global(p) {
				margin: 0 0 0.375rem;
			}
		}
	}

	:global(.theme-dark) {
		.nimble-option-peek {
			background: hsl(220deg 15% 18%);
		}
	}
</style>
