<!--
@component
The Lasts Until tab of the effect window. Each moment is one sentence: its words are the fields.
The first moment that happens ends the effect. Escape lets the holder roll a save to end it.
-->
<script lang="ts">
	import type { EffectTabProps } from '#types/components/EffectSheet.d.ts';
	import {
		eventRowSubject,
		isRoundSpan,
		NEW_MOMENT_KINDS,
		type NewMomentKind,
		withBoundary,
		withClock,
		withEffectName,
		withEvent,
		withSpan,
		withSubject,
		withUnits,
		withValue,
	} from '#utils/lastsUntil/momentForm.js';
	import localize from '#utils/localize.js';
	import {
		CLOCKS,
		ESCAPE_SAVES,
		type LastsUntilEvent,
		TIME_UNITS,
		TURN_BOUNDARIES,
		TURN_SPANS,
	} from '../../../models/activeEffect/nimbleEffectChoices.js';
	import {
		createEffectLastsUntilTabState,
		ESCAPE_WORDS,
		eventLabel,
		eventsFor,
		lastsUntilWord as word,
	} from './EffectLastsUntilTabState.svelte.ts';

	let { effect }: EffectTabProps = $props();

	const SUBJECTS = ['holder', 'source', 'effect'] as const;

	const state = createEffectLastsUntilTabState(() => effect);
	const { change, remove, add, setEscapeDc, setEscapeSaves } = state;
	const moments = $derived(state.moments);
	const escapeData = $derived(state.escape);
	const coreDuration = $derived(state.coreDuration);

	function onAdd(event: Event & { currentTarget: HTMLSelectElement }) {
		const kind = event.currentTarget.value as NewMomentKind | '';
		event.currentTarget.value = '';
		return add(kind);
	}
</script>

<section class="nimble-sheet__body nimble-sheet__body--item nimble-lasts-until">
	<fieldset class="nimble-lasts-until__group">
		<legend>{word('heading')}</legend>

		{#if coreDuration}
			<p class="nimble-lasts-until__none">{word('coreDuration', { duration: coreDuration })}</p>
		{:else if moments.length === 0}
			<p class="nimble-lasts-until__none">{word('none')}</p>
		{/if}

		{#each moments as moment, index (index)}
			<div
				class="nimble-lasts-until__row"
				role="group"
				aria-label={word('moment', { number: String(index + 1) })}
			>
				<span class="nimble-lasts-until__lead">{index === 0 ? word('until') : word('orUntil')}</span
				>

				<span class="nimble-lasts-until__words">
					{#if moment.kind === 'turn'}
						<select
							aria-label={word('fields.boundary')}
							value={moment.boundary ?? 'end'}
							onchange={({ currentTarget }) =>
								change(
									index,
									withBoundary(moment, currentTarget.value as (typeof TURN_BOUNDARIES)[number]),
								)}
						>
							{#each TURN_BOUNDARIES as boundary (boundary)}
								<option value={boundary}>{word(`boundary.${boundary}`)}</option>
							{/each}
						</select>

						{#if isRoundSpan(moment.span)}
							<span>{word('the')}</span>
						{:else}
							<select
								aria-label={word('fields.clock')}
								value={moment.clock ?? 'holder'}
								onchange={({ currentTarget }) =>
									change(index, withClock(moment, currentTarget.value as (typeof CLOCKS)[number]))}
							>
								{#each CLOCKS as clock (clock)}
									<option value={clock}>{word(`clock.${clock}`)}</option>
								{/each}
							</select>
						{/if}

						<select
							aria-label={word('fields.span')}
							value={moment.span ?? 'nextTurn'}
							onchange={({ currentTarget }) =>
								change(index, withSpan(moment, currentTarget.value as (typeof TURN_SPANS)[number]))}
						>
							{#each TURN_SPANS as span (span)}
								<option value={span}>{word(`span.${span}`)}</option>
							{/each}
						</select>
					{:else if moment.kind === 'time'}
						<input
							class="nimble-lasts-until__number"
							type="number"
							min="1"
							step="1"
							aria-label={word('fields.value')}
							value={moment.value ?? 1}
							onchange={({ currentTarget }) =>
								change(index, withValue(moment, Number(currentTarget.value)))}
						/>
						<select
							aria-label={word('fields.units')}
							value={moment.units ?? 'rounds'}
							onchange={({ currentTarget }) =>
								change(
									index,
									withUnits(moment, currentTarget.value as (typeof TIME_UNITS)[number]),
								)}
						>
							{#each TIME_UNITS as units (units)}
								<option value={units}>{word(`units.${units}`)}</option>
							{/each}
						</select>
						<span>{word('pass')}</span>
					{:else}
						{@const subject = eventRowSubject(moment)}
						<select
							aria-label={word('fields.subject')}
							value={subject}
							onchange={({ currentTarget }) =>
								change(
									index,
									withSubject(moment, currentTarget.value as (typeof SUBJECTS)[number]),
								)}
						>
							{#each SUBJECTS as each (each)}
								<option value={each}>{word(`subject.${each}`)}</option>
							{/each}
						</select>

						{#if subject === 'effect'}
							<input
								class="nimble-lasts-until__name"
								type="text"
								aria-label={word('fields.effectName')}
								placeholder={word('effectNamePlaceholder')}
								value={moment.effectName}
								onchange={({ currentTarget }) =>
									change(index, withEffectName(moment, currentTarget.value))}
							/>
							<span>{word('ends')}</span>
						{:else}
							<select
								aria-label={word('fields.event')}
								value={moment.event ?? 'attack'}
								onchange={({ currentTarget }) =>
									change(index, withEvent(moment, currentTarget.value as LastsUntilEvent))}
							>
								{#each eventsFor(moment) as event (event)}
									<option value={event}>{eventLabel(event)}</option>
								{/each}
							</select>
						{/if}
					{/if}
				</span>

				<button
					type="button"
					class="nimble-lasts-until__remove"
					aria-label={word('remove', { number: String(index + 1) })}
					data-tooltip={word('remove', { number: String(index + 1) })}
					onclick={() => remove(index)}
				>
					<i class="fa-solid fa-trash" aria-hidden="true"></i>
				</button>
			</div>
		{/each}

		<div class="nimble-lasts-until__row">
			<span class="nimble-lasts-until__lead"
				>{moments.length ? word('orUntil') : word('until')}</span
			>
			<span class="nimble-lasts-until__words">
				<select aria-label={word('fields.add')} value="" onchange={onAdd}>
					<option value="">{word('add')}</option>
					{#each NEW_MOMENT_KINDS as kind (kind)}
						<option value={kind}>{word(`addKind.${kind}`)}</option>
					{/each}
				</select>
			</span>
		</div>
	</fieldset>

	<fieldset class="nimble-lasts-until__group">
		<legend>{localize(`${ESCAPE_WORDS}.heading`)}</legend>

		<div class="nimble-lasts-until__row nimble-lasts-until__row--escape">
			<span class="nimble-lasts-until__lead">{localize(`${ESCAPE_WORDS}.dc`)}</span>
			<span class="nimble-lasts-until__words">
				<input
					class="nimble-lasts-until__dc"
					type="text"
					aria-label={localize(`${ESCAPE_WORDS}.dcLabel`)}
					value={escapeData.dc}
					onchange={({ currentTarget }) => setEscapeDc(currentTarget.value)}
				/>
				<span>{localize(`${ESCAPE_WORDS}.withA`)}</span>
				<select
					aria-label={localize(`${ESCAPE_WORDS}.savesLabel`)}
					value={escapeData.saves}
					onchange={({ currentTarget }) => setEscapeSaves(currentTarget.value)}
				>
					{#each ESCAPE_SAVES as saves (saves)}
						<option value={saves}>{localize(`${ESCAPE_WORDS}.saves.${saves}`)}</option>
					{/each}
				</select>
				<span>{localize(`${ESCAPE_WORDS}.save`)}</span>
			</span>
		</div>

		<p class="nimble-lasts-until__hint">{localize(`${ESCAPE_WORDS}.hint`)}</p>
	</fieldset>
</section>

<style lang="scss">
	.nimble-lasts-until {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		&__group {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			margin: 0;
			padding: 0.5rem 0.75rem 0.75rem;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 6px;

			legend {
				padding: 0 0.25rem;
				font-weight: 700;
				color: var(--nimble-ui-ink);
			}
		}

		&__row {
			display: grid;
			grid-template-columns: 5rem 1fr 1.5rem;
			align-items: center;
			gap: 0.5rem;
			min-height: 1.75rem;
		}

		&__lead {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-muted);
		}

		&__words {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.375rem;
			min-width: 0;
			color: var(--nimble-ui-ink);

			select {
				width: auto;
				max-width: 100%;
			}

			> span {
				font-size: var(--nimble-sm-text);
			}
		}

		&__number {
			width: 4rem;
		}

		&__name {
			width: 9rem;
		}

		&__dc {
			flex: 1 1 8rem;
			min-width: 6rem;
		}

		&__remove {
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

		&__none,
		&__hint {
			margin: 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-ui-ink-muted);
		}
	}
</style>
