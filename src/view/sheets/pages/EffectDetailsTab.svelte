<script lang="ts">
	import type { NimbleActiveEffect } from '#documents/activeEffect/activeEffect.js';
	import localize from '#utils/localize.js';
	import Editor from '../components/Editor.svelte';

	let { effect }: { effect: NimbleActiveEffect } = $props();

	const DETAILS = 'NIMBLE.effectSheet.details';

	const reactive = $derived(effect.reactive);
	const system = $derived(reactive.system as unknown as { minor?: boolean });
	const onItem = $derived(effect.parent?.documentName === 'Item');
	const fromName = $derived.by(() => {
		if (!reactive.origin) return '';
		const origin = fromUuidSync(reactive.origin as never, { strict: false }) as {
			name?: string;
		} | null;
		return origin?.name ?? '';
	});

	const update = (data: Record<string, unknown>) => effect.update(data as never);
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
			<span class="nimble-field__label">{localize(`${DETAILS}.off`)}</span>
			<small class="nimble-effect-details__hint">{localize(`${DETAILS}.offHint`)}</small>
		</label>

		{#if onItem}
			<label class="nimble-field">
				<input
					type="checkbox"
					checked={reactive.transfer}
					onchange={({ currentTarget }) => update({ transfer: currentTarget.checked })}
				/>
				<span class="nimble-field__label">{localize(`${DETAILS}.transfer`)}</span>
				<small class="nimble-effect-details__hint">{localize(`${DETAILS}.transferHint`)}</small>
			</label>
		{/if}

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={system.minor ?? false}
				onchange={({ currentTarget }) => update({ 'system.minor': currentTarget.checked })}
			/>
			<span class="nimble-field__label">{localize('NIMBLE.settings.customConditions.minor')}</span>
			<small class="nimble-effect-details__hint">
				{localize('NIMBLE.settings.customConditions.minorHint')}
			</small>
		</label>
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

	.nimble-field {
		flex-wrap: wrap;
	}

	.nimble-effect-details__hint {
		flex-basis: 100%;
		padding-inline-start: 1.5rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
