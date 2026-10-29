<!--
@component
The Effects tab: the active effects, the conditions on you and the passive effects, each group with its count, then all conditions.
A row that ends at once does so on a click; a row that removes something asks first.
Any owner can turn a condition on or off. The arrow keys, Home and End move the focus in the condition grid.
-->
<script lang="ts">
	import type { HeroEffectsTabProps } from '#types/components/actorSheets/HeroEffectsTab.d.ts';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import { setOpenRows } from '../../shared/sheetUiState.ts';
	import HeroRowGroupList from './HeroRowGroupList.svelte';

	let { view, ui, perform }: HeroEffectsTabProps = $props();

	let grid: HTMLElement | undefined = $state();

	const rowIds = $derived(view.groups.flatMap((group) => group.rows.map((row) => row.id)));
	const allOpen = $derived(rowIds.length > 0 && rowIds.every((id) => ui.openRows.includes(id)));

	/** The grid fills its width, so the columns are the buttons on the first line. */
	function columnsOf(buttons: HTMLElement[]): number {
		const top = buttons[0]?.offsetTop ?? 0;
		return Math.max(1, buttons.filter((button) => button.offsetTop === top).length);
	}

	function onkeydown(event: KeyboardEvent) {
		const buttons = [...(grid?.querySelectorAll<HTMLElement>('button') ?? [])];
		const index = buttons.indexOf(event.target as HTMLElement);
		if (index < 0) return;
		const columns = columnsOf(buttons);
		const last = buttons.length - 1;
		const next: Record<string, number> = {
			ArrowRight: Math.min(index + 1, last),
			ArrowLeft: Math.max(index - 1, 0),
			ArrowDown: Math.min(index + columns, last),
			ArrowUp: Math.max(index - columns, 0),
			Home: 0,
			End: last,
		};
		if (!(event.key in next)) return;
		event.preventDefault();
		buttons[next[event.key]]?.focus();
	}
</script>

<div class="bar">
	<ExpandAllButton {allOpen} onclick={() => setOpenRows(ui, allOpen ? [] : rowIds)} />
</div>
<HeroRowGroupList groups={view.groups} {ui} {perform} none={view.none} />
<GroupHeading label={view.conditions.label} />
<div class="conditions" role="group" aria-label={view.conditions.label} bind:this={grid}>
	{#each view.conditions.options as condition (condition.id)}
		<button
			type="button"
			class="nimble-u-reset-button condition"
			class:on={condition.on}
			aria-pressed={condition.on}
			onclick={() => perform(condition.intent)}
			{onkeydown}
		>
			<img src={condition.img} alt="" />{condition.name}
		</button>
	{/each}
</div>

<style>
	.bar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		margin: 0 0 6px;
	}
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
		font-size: 0.929rem;
		font-weight: 600;
		color: var(--nimble-ui-ink);
	}
	.condition:hover,
	.condition:focus-visible {
		border-color: var(--nimble-ui-highlight);
		outline: none;
	}
	.condition.on {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-well);
	}
	.condition img {
		width: 18px;
		height: 18px;
		border: 0;
	}
</style>
