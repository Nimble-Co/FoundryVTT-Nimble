<script lang="ts">
	import localize from '#utils/localize.ts';

	import type { SkillMoveLineProps } from '#types/components/SkillMoveLine.d.ts';

	let { section }: SkillMoveLineProps = $props();
</script>

<div class="nimble-skill-move">
	<span class="nimble-skill-move__label">
		<i class="fa-solid fa-arrow-right-arrow-left"></i>
		{localize('NIMBLE.optionSwap.skillMoveLabel')}
	</span>

	<div class="nimble-skill-move__selects">
		<select
			class="nimble-skill-move__select"
			aria-label={localize('NIMBLE.optionSwap.skillFrom')}
			value={section.skillMoveFrom}
			onchange={(event) => section.setSkillFrom(event.currentTarget.value)}
		>
			<option value="">{localize('NIMBLE.optionSwap.skillFrom')}</option>
			{#each section.skillRows as row (row.key)}
				{#if row.canGive || row.key === section.skillMoveFrom}
					<option value={row.key}>{row.label}</option>
				{/if}
			{/each}
		</select>

		<i class="fa-solid fa-arrow-right"></i>

		<select
			class="nimble-skill-move__select"
			aria-label={localize('NIMBLE.optionSwap.skillTo')}
			disabled={!section.skillMoveFrom}
			value={section.skillMoveTo}
			onchange={(event) => section.setSkillTo(event.currentTarget.value)}
		>
			<option value="">{localize('NIMBLE.optionSwap.skillTo')}</option>
			{#each section.skillRows as row (row.key)}
				{#if row.key !== section.skillMoveFrom && (row.canTake || row.key === section.skillMoveTo)}
					<option value={row.key}>{row.label}</option>
				{/if}
			{/each}
		</select>
	</div>

	{#if section.skillMoveSummary}
		<small class="nimble-skill-move__result">{section.skillMoveSummary}</small>
	{:else if section.hasUnplacedPoint}
		<small class="nimble-skill-move__result nimble-skill-move__result--warning">
			{localize('NIMBLE.optionSwap.skillMoveNeedsTarget')}
		</small>
	{/if}
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
