<script lang="ts">
	import { placeAoERegion } from '../../../canvas/placeAoERegion.js';
	import localize from '../../../utils/localize.js';

	const SHAPE_ICONS: Record<string, string> = {
		circle: 'fa-regular fa-circle',
		cone: 'fa-solid fa-wifi fa-rotate-90',
		emanation: 'fa-solid fa-circle-dot',
		line: 'fa-solid fa-arrows-left-right',
		square: 'fa-regular fa-square',
	};

	async function placeTemplate() {
		if (placing) return;
		placing = true;

		try {
			const region = await placeAoERegion(template, { name });

			if (region) await messageDocument.addTokensInRegionAsTargets(region);
		} finally {
			placing = false;
		}
	}

	let { messageDocument, name } = $props();

	let placing = $state(false);

	let template = $derived(messageDocument.reactive.system.activation?.template);
	let shape = $derived(template?.shape ?? '');
	let size = $derived(
		shape === 'circle' || shape === 'emanation' ? template.radius : template.length,
	);
	let label = $derived(shape ? localize(`NIMBLE.aoe.place.${shape}`, { size: String(size) }) : '');
</script>

{#if shape}
	<section class="nimble-card-section nimble-card-section--template">
		<button class="nimble-aoe-place-button" disabled={placing} onclick={() => placeTemplate()}>
			<i class={SHAPE_ICONS[shape] ?? 'fa-solid fa-bullseye'}></i>
			{label}
		</button>
	</section>
{/if}

<style lang="scss">
	.nimble-aoe-place-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
	}
</style>
