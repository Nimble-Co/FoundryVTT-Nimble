<!--
@component
The HP and Temp HP plates of a monster. You type the numbers. In edit mode they rest and you type the max HP.
`compact` is the form of the narrow header.
-->
<script lang="ts">
	import type { MonsterHitPointsProps } from '#types/components/actorSheets/MonsterHitPoints.d.ts';
	import VitalPlate from '../../parts/VitalPlate.svelte';

	let { view, perform, editing = false, compact = false }: MonsterHitPointsProps = $props();
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
			rest={editing}
			onchange={(value) => perform({ kind: 'setHp', value })}
			onmaxchange={editing ? (value) => perform({ kind: 'setMaxHp', value }) : undefined}
		/>
		<VitalPlate
			variant={compact ? 'block' : 'badge'}
			{compact}
			temp
			label={view.text.tempHp}
			value={hp.temp}
			rest={editing}
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
