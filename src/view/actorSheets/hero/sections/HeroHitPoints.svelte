<!--
@component
The HP and Temp HP plates. You type the numbers in play; in edit mode they rest, and an EditZone on HP
opens Configure Hit Points. `compact` is the form of the narrow header.
-->
<script lang="ts">
	import type { HeroHitPointsProps } from '#types/components/actorSheets/HeroHitPoints.d.ts';
	import EditZone from '../../parts/EditZone.svelte';
	import VitalPlate from '../../parts/VitalPlate.svelte';

	let { view, editing, perform, compact = false }: HeroHitPointsProps = $props();
</script>

<div class="plates" class:compact class:editing>
	<div class="hp">
		<VitalPlate
			variant="block"
			{compact}
			label={view.text.hp}
			value={view.hp.value}
			max={view.hp.max}
			state={view.hp.state ?? undefined}
			dying={view.hp.dying}
			icon={compact ? undefined : 'fa-solid fa-heart'}
			tooltip={view.hp.tooltip}
			rest={editing}
			onchange={(value) => perform({ kind: 'setHp', value })}
		/>
		{#if editing}
			<EditZone
				short={view.text.hpShort}
				label={view.text.configureHp}
				onclick={() => perform({ kind: 'configure', target: 'hitPoints' })}
			/>
		{/if}
	</div>
	<div class="temp">
		<VitalPlate
			variant="block"
			{compact}
			temp
			label={view.text.tempHp}
			value={view.hp.temp}
			rest={editing}
			onchange={(value) => perform({ kind: 'setTempHp', value })}
		/>
	</div>
</div>

<style>
	.plates {
		display: grid;
		grid-template-columns: 1.6fr 1fr;
		gap: 5px;
	}
	.compact {
		display: flex;
		align-items: flex-end;
	}
	.editing {
		gap: 13px;
	}
	.hp {
		position: relative;
	}
	.compact .hp {
		min-width: 88px;
	}
	.compact .temp {
		min-width: 60px;
	}
</style>
