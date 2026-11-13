<script lang="ts">
	import type { EffectTabProps } from '#types/components/EffectSheet.d.ts';
	import localize from '#utils/localize.js';
	import ItemEffectSelect from '../../components/ItemEffectSelect.svelte';
	import TagGroup from '../../components/TagGroup.svelte';
	import Editor from '../components/Editor.svelte';
	import { effectConditionOptions, toggledStatus } from './effectConditions.ts';
	import {
		stackAtUpdate,
		stackCountUpdate,
		stackEffectItem,
		stackFieldsOf,
	} from './effectStackFields.ts';

	let { effect }: EffectTabProps = $props();

	const DETAILS = 'NIMBLE.effectSheet.details';

	const reactive = $derived(effect.reactive);
	const onItem = $derived(effect.parent?.documentName === 'Item');
	const fromName = $derived.by(() => {
		if (!reactive.origin) return '';
		const origin = fromUuidSync(reactive.origin as never, { strict: false }) as {
			name?: string;
		} | null;
		return origin?.name ?? '';
	});

	const update = (data: Record<string, unknown>) => effect.update(data as never);

	const conditions = effectConditionOptions();
	const statuses = $derived([...((reactive.statuses ?? []) as Iterable<string>)]);

	const stacks = $derived(stackFieldsOf(reactive.system));
	const stackItem = $derived(stackEffectItem(reactive as never));
	const onCreature = $derived(effect.parent?.documentName === 'Actor');
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
	{#if fromName}
		<p class="nimble-effect-details__from">
			<span class="nimble-heading" data-heading-variant="field">{localize(`${DETAILS}.from`)}</span>
			{fromName}
		</p>
	{/if}

	<div>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize(`${DETAILS}.state`)}
			</h3>
		</header>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={reactive.disabled}
				onchange={({ currentTarget }) => update({ disabled: currentTarget.checked })}
			/>
			<span class="nimble-effect-details__text">
				<span class="nimble-field__label">{localize(`${DETAILS}.off`)}</span>
				<small>{localize(`${DETAILS}.offHint`)}</small>
			</span>
		</label>

		{#if onItem}
			<label class="nimble-field">
				<input
					type="checkbox"
					checked={reactive.transfer}
					onchange={({ currentTarget }) => update({ transfer: currentTarget.checked })}
				/>
				<span class="nimble-effect-details__text">
					<span class="nimble-field__label">{localize(`${DETAILS}.transfer`)}</span>
					<small>{localize(`${DETAILS}.transferHint`)}</small>
				</span>
			</label>
		{/if}
	</div>

	<div>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize(`${DETAILS}.conditions`)}
			</h3>
		</header>
		<p class="nimble-effect-details__hint">{localize(`${DETAILS}.conditionsHint`)}</p>
		<TagGroup
			options={conditions}
			selectedOptions={statuses}
			toggleOption={async (id) => {
				await update({ statuses: toggledStatus(statuses, String(id)) });
			}}
		/>
	</div>

	<div>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize(`${DETAILS}.stacks`)}
			</h3>
		</header>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={stacks.on}
				onchange={({ currentTarget }) => update({ 'system.stacks.on': currentTarget.checked })}
			/>
			<span class="nimble-effect-details__text">
				<span class="nimble-field__label">{localize(`${DETAILS}.stacksOn`)}</span>
				<small>{localize(`${DETAILS}.stacksOnHint`)}</small>
			</span>
		</label>

		{#if stacks.on}
			<div class="nimble-effect-details__stack-row">
				<span>{localize(`${DETAILS}.stacksAt`)}</span>
				<input
					class="nimble-effect-details__number"
					type="number"
					min="2"
					step="1"
					aria-label={localize(`${DETAILS}.stacksAtLabel`)}
					value={stacks.at ?? ''}
					disabled={!onItem}
					onchange={({ currentTarget }) => update(stackAtUpdate(currentTarget.value))}
				/>
				<span>{localize(`${DETAILS}.stacksGain`)}</span>
				<span class="nimble-effect-details__stack-effect">
					<ItemEffectSelect
						item={stackItem}
						value={stacks.effectId || null}
						onchange={(effectId) => update({ 'system.stacks.effectId': effectId ?? '' })}
						recipient="targets"
						label={localize(`${DETAILS}.stacksEffectLabel`)}
						disabled={!onItem}
					/>
				</span>
			</div>

			{#if onCreature}
				<label class="nimble-effect-details__stack-row">
					<span>{localize(`${DETAILS}.stacksNow`)}</span>
					<input
						class="nimble-effect-details__number"
						type="number"
						min="1"
						step="1"
						aria-label={localize(`${DETAILS}.stacksNowLabel`)}
						value={stacks.count}
						onchange={({ currentTarget }) => update(stackCountUpdate(currentTarget.value))}
					/>
				</label>
			{/if}
		{/if}
	</div>

	{#key reactive.description}
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize(`${DETAILS}.description`)}
			</h3>
		</header>

		<Editor field="description" content={reactive.description ?? ''} document={effect} />
	{/key}
</section>

<style lang="scss">
	.nimble-effect-details__from {
		display: flex;
		gap: 0.375rem;
		align-items: baseline;
		margin: 0;
		color: var(--nimble-ui-ink);
	}

	.nimble-effect-details__hint {
		margin: 0 0 0.375rem;
		font-size: var(--nimble-xs-text);
		color: var(--nimble-ui-ink-muted);
	}

	.nimble-effect-details__stack-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
		margin-block-start: 0.375rem;
		color: var(--nimble-ui-ink);
	}

	.nimble-effect-details__number {
		flex: 0 0 3.5rem;
		width: 3.5rem;
	}

	.nimble-effect-details__stack-effect {
		flex: 1 1 10rem;
		min-width: 0;
	}

	.nimble-effect-details__text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;

		small {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-ui-ink-muted);
		}
	}
</style>
