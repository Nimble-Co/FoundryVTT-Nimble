<!--
@component
Every condition of the system as a toggle button, on both sheets. `compact` shows them as small pills. The arrow keys, Home and End move the focus in the grid.
-->
<script lang="ts" generics="T extends ConditionGridOption">
	import type {
		ConditionGridOption,
		ConditionGridProps,
	} from '#types/components/actorSheets/ConditionGrid.d.ts';
	import { moveGridFocus } from './gridKeys.ts';

	let { label, options, onpick, compact = false }: ConditionGridProps<T> = $props();

	let grid: HTMLElement | undefined = $state();
</script>

<div class="conditions" class:compact role="group" aria-label={label} bind:this={grid}>
	{#each options as condition (condition.id)}
		<button
			type="button"
			class="nimble-u-reset-button condition"
			class:on={condition.on}
			aria-pressed={condition.on}
			onclick={() => onpick(condition)}
			onkeydown={(event) => moveGridFocus(grid, event)}
		>
			<img src={condition.img} alt="" /><span class="name">{condition.name}</span
			>{#if condition.on}<i class="fa-solid fa-check" aria-hidden="true"></i>{/if}
		</button>
	{/each}
</div>

<style>
	.conditions {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
		gap: 5px;
		margin-top: 6px;
	}
	.condition {
		display: flex;
		align-items: center;
		gap: 7px;
		height: 32px;
		padding: 0 9px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.813rem;
		font-weight: 600;
		color: var(--nimble-ui-ink);
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.condition:hover {
		border-color: var(--nimble-ui-highlight);
	}
	.condition:focus-visible {
		outline: 2px solid var(--nimble-ui-highlight);
		outline-offset: 2px;
	}
	.condition.on {
		border-color: var(--nimble-crimson);
		background: var(--nimble-crimson);
		color: var(--nimble-ui-fill-ink);
	}
	.condition i {
		flex: none;
		font-size: 0.75rem;
	}
	.condition img {
		flex: none;
		width: 20px;
		height: 20px;
		padding: 2px;
		border: 0;
		border-radius: 3px;
		background: var(--nimble-ui-chrome);
	}
	.compact {
		display: flex;
		flex-wrap: wrap;
	}
	.compact .condition {
		gap: 6px;
		height: 26px;
		padding: 0 11px 0 4px;
		border-radius: 13px;
		font-size: 0.75rem;
	}
	.compact .condition img {
		width: 18px;
		height: 18px;
		border-radius: 50%;
	}
</style>
