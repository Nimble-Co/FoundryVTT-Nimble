<!--
@component
The Changes tab of the effect window: core's changes to the data of the holder, one row each.
-->
<script lang="ts">
	import type { EffectTabProps } from '#types/components/EffectSheet.d.ts';
	import localize from '#utils/localize.js';
	import {
		CHANGES_WORDS,
		createEffectChangesTabState,
		parsedValue,
		shownValue,
	} from './EffectChangesTabState.svelte.ts';

	let { effect }: EffectTabProps = $props();

	const state = createEffectChangesTabState(() => effect);
	const { change, add, remove, priorityHint } = state;
	const changes = $derived(state.changes);
	const changeTypes = $derived(state.changeTypes);

	const word = (path: string, data?: Record<string, string>) =>
		localize(`${CHANGES_WORDS}.${path}`, data);
</script>

<section class="nimble-sheet__body nimble-sheet__body--item nimble-effect-changes">
	<div class="nimble-effect-changes__grid">
		<span class="nimble-effect-changes__head">{word('key')}</span>
		<span class="nimble-effect-changes__head">{word('type')}</span>
		<span class="nimble-effect-changes__head">{word('value')}</span>
		<span class="nimble-effect-changes__head">{word('priority')}</span>
		<button
			type="button"
			class="nimble-effect-changes__icon"
			aria-label={word('add')}
			data-tooltip={word('add')}
			onclick={add}
		>
			<i class="fa-solid fa-plus" aria-hidden="true"></i>
		</button>

		{#each changes as each, index (index)}
			{@const number = String(index + 1)}
			<div class="nimble-effect-changes__row" role="group" aria-label={word('change', { number })}>
				<input
					type="text"
					aria-label={word('key')}
					value={each.key}
					onchange={({ currentTarget }) => change(index, { key: currentTarget.value.trim() })}
				/>
				<select
					aria-label={word('type')}
					value={each.type}
					onchange={({ currentTarget }) => change(index, { type: currentTarget.value })}
				>
					{#each changeTypes as type (type.type)}
						<option value={type.type}>{type.label}</option>
					{/each}
				</select>
				<input
					type="text"
					aria-label={word('value')}
					value={shownValue(each.value)}
					onchange={({ currentTarget }) =>
						change(index, { value: parsedValue(currentTarget.value) })}
				/>
				<input
					type="number"
					aria-label={word('priority')}
					placeholder={priorityHint(each.type)}
					value={each.priority ?? ''}
					onchange={({ currentTarget }) =>
						change(index, {
							priority: currentTarget.value === '' ? null : Number(currentTarget.value),
						})}
				/>
				<button
					type="button"
					class="nimble-effect-changes__icon"
					aria-label={word('remove', { number })}
					data-tooltip={word('remove', { number })}
					onclick={() => remove(index)}
				>
					<i class="fa-solid fa-trash" aria-hidden="true"></i>
				</button>
			</div>
		{/each}
	</div>

	{#if changes.length === 0}
		<p class="nimble-effect-changes__none">{word('none')}</p>
	{/if}
</section>

<style lang="scss">
	.nimble-effect-changes {
		&__grid {
			display: grid;
			grid-template-columns: minmax(0, 2fr) minmax(0, 1.3fr) minmax(0, 1.5fr) 4rem 1.5rem;
			align-items: center;
			gap: 0.375rem;
		}

		&__row {
			display: contents;
		}

		&__head {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-muted);
		}

		&__icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			border: 0;
			border-radius: 4px;
			background: transparent;
			color: var(--nimble-ui-ink-muted);
			cursor: pointer;

			&:hover {
				color: var(--nimble-ui-ink);
				background: var(--nimble-ui-hover);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}
		}

		&__none {
			margin: 0.5rem 0 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-ui-ink-muted);
		}
	}
</style>
