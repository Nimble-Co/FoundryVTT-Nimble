<script lang="ts">
	import { onMount } from 'svelte';
	import ActorConditionsList from '../components/ActorConditionsList.svelte';

	let actor = $state<Actor.Implementation | null>(null);

	function getControlledActor() {
		return canvas?.tokens?.controlled?.[0]?.actor ?? null;
	}

	function refreshActor() {
		actor = getControlledActor();
	}

	onMount(() => {
		refreshActor();

		const hookListeners = [
			{ hook: 'controlToken', listener: refreshActor },
			{ hook: 'updateActor', listener: refreshActor },
			{ hook: 'createActiveEffect', listener: refreshActor },
			{ hook: 'updateActiveEffect', listener: refreshActor },
			{ hook: 'deleteActiveEffect', listener: refreshActor },
			{ hook: 'createToken', listener: refreshActor },
			{ hook: 'updateToken', listener: refreshActor },
			{ hook: 'deleteToken', listener: refreshActor },
			{ hook: 'canvasReady', listener: refreshActor },
		];

		const hooks = hookListeners.map(({ hook, listener }) => {
			return { hook, id: Hooks.on(hook, listener) };
		});

		return () => {
			for (const { hook, id } of hooks) {
				Hooks.off(hook, id);
			}
		};
	});
</script>

{#if actor}
	<section class="nimble-canvas-conditions-panel">
		<ActorConditionsList {actor} mode="canvas" allowRemove={true} />
	</section>
{/if}
