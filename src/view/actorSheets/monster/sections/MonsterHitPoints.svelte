<!--
@component
The HP and Temp HP plates of a monster. You type the numbers. `compact` is the form of the narrow header.
-->
<script lang="ts">
	import type { MonsterHitPointsProps } from '#types/components/actorSheets/MonsterHitPoints.d.ts';
	import VitalPlate from '../../parts/VitalPlate.svelte';

	let { view, perform, compact = false }: MonsterHitPointsProps = $props();
</script>

{#if view.hp}
	{@const hp = view.hp}
	<div class="plates" class:compact>
		<VitalPlate
			variant={compact ? 'block' : 'badge'}
			{compact}
			label={view.text.hp}
			value={hp.value}
			max={hp.max}
			state={hp.state ?? undefined}
			tooltip={hp.tooltip}
			onchange={(value) => perform({ kind: 'setHp', value })}
		/>
		<VitalPlate
			variant={compact ? 'block' : 'badge'}
			{compact}
			temp
			label={view.text.tempHp}
			value={hp.temp}
			onchange={(value) => perform({ kind: 'setTempHp', value })}
		/>
	</div>
{/if}

<style>
	.plates {
		display: flex;
		gap: 8px;
		justify-content: center;
	}
	.compact {
		justify-content: flex-start;
		gap: 6px;
	}
</style>
