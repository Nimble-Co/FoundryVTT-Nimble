<script lang="ts">
	import type { NimbleFeatureItem } from '#documents/item/feature.js';

	import FeatureCard from '../characterCreator/FeatureCard.svelte';
	import localize from '#utils/localize.js';

	let { features }: { features: NimbleFeatureItem[] } = $props();
</script>

<section class="subclass-features">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.levelUpDialog.subclassFeatures')}
		</h3>
	</header>

	<ul class="subclass-features__list">
		{#each features as feature (feature.uuid)}
			<FeatureCard {feature} />
		{/each}
	</ul>
</section>

<style lang="scss">
	.subclass-features__list {
		display: flex;
		flex-direction: column;
		margin: 0.5rem 0 0 0;
		padding: 0;
	}
</style>
