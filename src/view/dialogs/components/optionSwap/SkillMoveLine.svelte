<script lang="ts">
	import localize from '#utils/localize.ts';

	import type { SkillMoveLineProps } from '#types/components/SkillMoveLine.d.ts';

	let { section, moveIndices }: SkillMoveLineProps = $props();

	let moves = $derived(
		moveIndices
			.map((index) => ({ index, move: section.skillMoves[index] }))
			.filter((line) => line.move !== undefined),
	);

	// A single line needs no number to be told apart from the others.
	let isNumbered = $derived(section.skillMoves.length > 1);

	const fromLabel = (index: number) =>
		isNumbered
			? localize('NIMBLE.optionSwap.skillFromNumbered', { number: String(index + 1) })
			: localize('NIMBLE.optionSwap.skillFrom');

	const toLabel = (index: number) =>
		isNumbered
			? localize('NIMBLE.optionSwap.skillToNumbered', { number: String(index + 1) })
			: localize('NIMBLE.optionSwap.skillTo');
</script>

<div class="nimble-skill-move">
	<span class="nimble-skill-move__label">
		<i class="fa-solid fa-arrow-right-arrow-left"></i>
		{localize('NIMBLE.optionSwap.skillMoveLabel')}
	</span>

	{#each moves as { index, move } (index)}
		<div class="nimble-skill-move__selects">
			<select
				class="nimble-skill-move__select"
				aria-label={fromLabel(index)}
				value={move.from}
				onchange={(event) => section.setSkillFrom(index, event.currentTarget.value)}
			>
				<option value="">{localize('NIMBLE.optionSwap.skillFrom')}</option>
				{#each section.skillRows as row (row.key)}
					{#if row.canGive || row.key === move.from}
						<option value={row.key}>{row.label}</option>
					{/if}
				{/each}
			</select>

			<i class="fa-solid fa-arrow-right"></i>

			<select
				class="nimble-skill-move__select"
				aria-label={toLabel(index)}
				disabled={!move.from}
				value={move.to}
				onchange={(event) => section.setSkillTo(index, event.currentTarget.value)}
			>
				<option value="">{localize('NIMBLE.optionSwap.skillTo')}</option>
				{#each section.skillRows as row (row.key)}
					{#if row.key !== move.from && (row.canTake || row.key === move.to)}
						<option value={row.key}>{row.label}</option>
					{/if}
				{/each}
			</select>
		</div>

		{#if move.summary}
			<small class="nimble-skill-move__result">{move.summary}</small>
		{:else if move.needsTarget}
			<small class="nimble-skill-move__result nimble-skill-move__result--warning">
				{localize('NIMBLE.optionSwap.skillMoveNeedsTarget')}
			</small>
		{/if}
	{/each}
</div>

<style lang="scss">
	.nimble-skill-move {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;
		font-size: var(--nimble-sm-text);

		&__label {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			color: var(--nimble-medium-text-color);
		}

		&__selects {
			display: flex;
			align-items: center;
			gap: 0.375rem;
		}

		&__select {
			flex: 1 1 0;
			width: auto;
			min-width: 0;
			font-size: var(--nimble-sm-text);
		}

		&__result {
			color: var(--nimble-medium-text-color);

			&--warning {
				color: var(--nimble-warning-color, hsl(36deg 75% 45%));
			}
		}
	}
</style>
