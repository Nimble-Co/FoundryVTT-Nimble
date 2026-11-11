<script lang="ts">
	import type { CardEventText } from '#types/cardEvent.d.ts';
	import type { ChatCardProps } from '#types/components/ChatCard.d.ts';
	import CardEvents from './components/CardEvents.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import { cardEventText } from '#utils/chat/cardEvents.js';

	let { messageDocument }: ChatCardProps = $props();

	const system = $derived(
		(
			messageDocument.reactive as unknown as {
				system: { heading: string; momentHeading?: CardEventText | null };
			}
		).system,
	);
	// Cards from before the moment heading have it in words.
	const heading = $derived(
		system.momentHeading ? cardEventText(system.momentHeading) : system.heading,
	);
</script>

<CardHeader {messageDocument} />

<article class="nimble-chat-card__body nimble-effects-ended" data-card-type="effectsEnded">
	<h3 class="nimble-effects-ended__heading">{heading}</h3>

	<CardEvents {messageDocument} labelled={false} />
</article>

<style lang="scss">
	.nimble-effects-ended {
		--nimble-card-section-padding: 0.125rem 0.5rem 0.375rem;

		&__heading {
			margin: 0;
			padding: 0.375rem 0.5rem 0.125rem;
			border: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			color: var(--nimble-card-text-color);
		}
	}
</style>
