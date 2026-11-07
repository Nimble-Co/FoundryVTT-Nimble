<!--
@component
Armor and the walking speed of the hero. In edit mode an EditZone on the speed opens Configure Movement.
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
	<span class="speed">
		<StatBox
			variant="inline"
			icon={view.speed.icon}
			label={view.speed.label}
			value={view.speed.value}
			note={view.speed.note ?? undefined}
			tooltip={view.speed.tooltip}
		/>
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
	.speed {
		position: relative;
		display: inline-flex;
		align-items: center;
	}
</style>
