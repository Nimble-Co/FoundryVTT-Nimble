<!--
@component
Armor and the speeds of the hero. In edit mode an EditZone on the speeds opens Configure Movement.
-->
<script lang="ts">
	import type { HeroStatsProps } from '#types/components/actorSheets/HeroStats.d.ts';
	import EditZone from '../../parts/EditZone.svelte';
	import StatBox from '../../parts/StatBox.svelte';

	let { view, editing, perform, centered = false }: HeroStatsProps = $props();
</script>

<div class="stats" class:centered>
	<StatBox
		variant="inline"
		icon="fa-solid fa-shield-halved"
		label={view.armor.label}
		value={view.armor.value}
		tooltip={view.armor.tooltip}
	/>
	<span class="speeds">
		{#each view.speeds as speed (speed.type)}
			<StatBox
				variant="inline"
				icon={speed.icon}
				label={speed.label}
				value={speed.value}
				note={speed.note ?? undefined}
				tooltip={speed.tooltip}
			/>
		{/each}
		{#if editing}
			<EditZone
				short={view.text.movementShort}
				label={view.text.configureMovement}
				onclick={() => perform({ kind: 'configure', target: 'movement' })}
			/>
		{/if}
	</span>
</div>

<style>
	.stats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
	}
	.centered {
		justify-content: center;
	}
	.speeds {
		position: relative;
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 14px;
	}
</style>
