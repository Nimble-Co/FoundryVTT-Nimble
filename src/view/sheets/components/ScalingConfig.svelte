<script>
	import { getContext } from 'svelte';
	import TagGroup from '../../components/TagGroup.svelte';
	import { flattenEffectsTree } from '../../../utils/treeManipulation/flattenEffectsTree.js';
	import localize from '../../../utils/localize.js';

	let item = getContext('document');

	const t = (key) => localize(`NIMBLE.spellConfig.scaling.${key}`);

	let scalingMode = $derived(item.reactive.system.scaling?.mode ?? 'none');
	let scalingDeltas = $derived(item.reactive.system.scaling?.deltas ?? []);
	let scalingChoices = $derived(item.reactive.system.scaling?.choices ?? []);

	const scalingModeOptions = [
		{ label: t('modes.none'), value: 'none' },
		{ label: t('modes.upcast'), value: 'upcast' },
		{ label: t('modes.upcastChoice'), value: 'upcastChoice' },
	];

	const operationOptions = [
		{ label: t('operations.addFlatDamage'), value: 'addFlatDamage' },
		{ label: t('operations.addDice'), value: 'addDice' },
		{ label: t('operations.addReach'), value: 'addReach' },
		{ label: t('operations.addRange'), value: 'addRange' },
		{ label: t('operations.addTargets'), value: 'addTargets' },
		{ label: t('operations.addAreaSize'), value: 'addAreaSize' },
		{ label: t('operations.addDC'), value: 'addDC' },
		{ label: t('operations.addArmor'), value: 'addArmor' },
		{ label: t('operations.addDuration'), value: 'addDuration' },
		{ label: t('operations.addCondition'), value: 'addCondition' },
	];

	const diceFaceOptions = [4, 6, 8, 10, 12, 20];

	// Operations that can target a specific effect node
	const targetableOperations = new Set(['addFlatDamage', 'addDice', 'addDC']);

	// Build a list of targetable effect nodes from the spell's activation effects
	let targetableEffects = $derived.by(() => {
		const effects = item.reactive.system.activation?.effects ?? [];
		const flattened = flattenEffectsTree(effects);
		return flattened
			.filter(
				(node) => node.type === 'damage' || node.type === 'healing' || node.type === 'savingThrow',
			)
			.map((node) => ({
				id: node.id,
				label: formatEffectLabel(node),
			}));
	});

	function formatEffectLabel(node) {
		const type = node.type === 'savingThrow' ? 'Save' : node.type;
		const detail = node.damageType || node.saveType || node.formula || '';
		const context = node.parentContext ? ` (${node.parentContext})` : '';
		return `${type}${detail ? ': ' + detail : ''}${context}`;
	}

	function createEmptyDelta() {
		return {
			operation: 'addFlatDamage',
			value: 1,
			dice: null,
			condition: null,
			targetEffectId: null,
			durationType: null,
		};
	}

	async function toggleScalingMode(mode) {
		const updates = { 'system.scaling.mode': mode };
		if (mode === 'upcastChoice' && !item.reactive.system.scaling?.choices) {
			updates['system.scaling.choices'] = [];
		}
		await item.update(updates);
	}

	// ---- Delta CRUD (for "upcast" mode) ----

	async function addDelta() {
		const deltas = [...scalingDeltas, createEmptyDelta()];
		await item.update({ 'system.scaling.deltas': deltas });
	}

	async function removeDelta(index) {
		const deltas = scalingDeltas.filter((_, i) => i !== index);
		await item.update({ 'system.scaling.deltas': deltas });
	}

	async function updateDelta(index, field, value) {
		const deltas = foundry.utils.deepClone(scalingDeltas);
		if (field === 'operation') {
			deltas[index].operation = value;
			if (value === 'addDice') {
				deltas[index].dice = deltas[index].dice ?? { count: 1, faces: 6 };
				deltas[index].value = null;
				deltas[index].condition = null;
			} else if (value === 'addCondition') {
				deltas[index].condition = deltas[index].condition ?? '';
				deltas[index].value = null;
				deltas[index].dice = null;
			} else {
				deltas[index].value = deltas[index].value ?? 1;
				deltas[index].dice = null;
				deltas[index].condition = null;
			}
		} else if (field === 'dice') {
			deltas[index].dice = value;
		} else {
			deltas[index][field] = value;
		}
		await item.update({ 'system.scaling.deltas': deltas });
	}

	// ---- Choice CRUD (for "upcastChoice" mode) ----

	async function addChoice() {
		const choices = [...(scalingChoices ?? []), { label: '', deltas: [createEmptyDelta()] }];
		await item.update({ 'system.scaling.choices': choices });
	}

	async function removeChoice(choiceIndex) {
		const choices = (scalingChoices ?? []).filter((_, i) => i !== choiceIndex);
		await item.update({ 'system.scaling.choices': choices });
	}

	async function updateChoiceLabel(choiceIndex, label) {
		const choices = foundry.utils.deepClone(scalingChoices ?? []);
		choices[choiceIndex].label = label;
		await item.update({ 'system.scaling.choices': choices });
	}

	async function addChoiceDelta(choiceIndex) {
		const choices = foundry.utils.deepClone(scalingChoices ?? []);
		choices[choiceIndex].deltas.push(createEmptyDelta());
		await item.update({ 'system.scaling.choices': choices });
	}

	async function removeChoiceDelta(choiceIndex, deltaIndex) {
		const choices = foundry.utils.deepClone(scalingChoices ?? []);
		choices[choiceIndex].deltas = choices[choiceIndex].deltas.filter((_, i) => i !== deltaIndex);
		await item.update({ 'system.scaling.choices': choices });
	}

	async function updateChoiceDelta(choiceIndex, deltaIndex, field, value) {
		const choices = foundry.utils.deepClone(scalingChoices ?? []);
		const delta = choices[choiceIndex].deltas[deltaIndex];
		if (field === 'operation') {
			delta.operation = value;
			if (value === 'addDice') {
				delta.dice = delta.dice ?? { count: 1, faces: 6 };
				delta.value = null;
				delta.condition = null;
			} else if (value === 'addCondition') {
				delta.condition = delta.condition ?? '';
				delta.value = null;
				delta.dice = null;
			} else {
				delta.value = delta.value ?? 1;
				delta.dice = null;
				delta.condition = null;
			}
		} else if (field === 'dice') {
			delta.dice = value;
		} else {
			delta[field] = value;
		}
		await item.update({ 'system.scaling.choices': choices });
	}
</script>

{#snippet DeltaEditor(delta, index, onUpdate, onRemove)}
	<div class="nimble-scaling-delta nimble-card">
		<div class="nimble-scaling-delta__row">
			<label class="nimble-field" data-field-variant="stacked">
				<span class="nimble-heading" data-heading-variant="field">{t('operation')}</span>
				<select
					value={delta.operation}
					onchange={({ target }) => onUpdate(index, 'operation', target.value)}
				>
					{#each operationOptions as { value, label }}
						<option {value} selected={value === delta.operation}>{label}</option>
					{/each}
				</select>
			</label>

			{#if delta.operation === 'addDice'}
				<label class="nimble-field" data-field-variant="stacked">
					<span class="nimble-heading" data-heading-variant="field">{t('count')}</span>
					<input
						type="number"
						min="1"
						value={delta.dice?.count ?? 1}
						onchange={({ target }) =>
							onUpdate(index, 'dice', {
								...delta.dice,
								count: Number(target.value),
							})}
					/>
				</label>
				<label class="nimble-field" data-field-variant="stacked">
					<span class="nimble-heading" data-heading-variant="field">{t('die')}</span>
					<select
						value={delta.dice?.faces ?? 6}
						onchange={({ target }) =>
							onUpdate(index, 'dice', {
								...delta.dice,
								faces: Number(target.value),
							})}
					>
						{#each diceFaceOptions as faces}
							<option value={faces} selected={faces === (delta.dice?.faces ?? 6)}>d{faces}</option>
						{/each}
					</select>
				</label>
			{:else if delta.operation === 'addCondition'}
				<label class="nimble-field" data-field-variant="stacked">
					<span class="nimble-heading" data-heading-variant="field">{t('condition')}</span>
					<input
						type="text"
						value={delta.condition ?? ''}
						placeholder={t('conditionPlaceholder')}
						onchange={({ target }) => onUpdate(index, 'condition', target.value || null)}
					/>
				</label>
			{:else}
				<label class="nimble-field" data-field-variant="stacked">
					<span class="nimble-heading" data-heading-variant="field">{t('value')}</span>
					<input
						type="number"
						value={delta.value ?? 0}
						onchange={({ target }) => onUpdate(index, 'value', Number(target.value))}
					/>
				</label>
			{/if}

			{#if targetableOperations.has(delta.operation)}
				{@const hasEffects = targetableEffects.length > 0}
				{@const currentIdMatchesEffect = targetableEffects.some(
					(e) => e.id === delta.targetEffectId,
				)}
				<label class="nimble-field" data-field-variant="stacked">
					<span class="nimble-heading" data-heading-variant="field">{t('targetEffect')}</span>
					{#if hasEffects && (currentIdMatchesEffect || !delta.targetEffectId)}
						<select
							value={delta.targetEffectId ?? ''}
							onchange={({ target }) => onUpdate(index, 'targetEffectId', target.value || null)}
						>
							<option value="">{t('targetEffectAuto')}</option>
							{#each targetableEffects as effect}
								<option value={effect.id} selected={effect.id === delta.targetEffectId}
									>{effect.label}</option
								>
							{/each}
						</select>
					{:else}
						<input
							type="text"
							value={delta.targetEffectId ?? ''}
							data-tooltip={!hasEffects ? t('targetEffectHint') : undefined}
							data-tooltip-direction="UP"
							placeholder={t('targetEffectPlaceholder')}
							onchange={({ target }) => onUpdate(index, 'targetEffectId', target.value || null)}
						/>
					{/if}
				</label>
			{/if}

			<button
				class="nimble-button nimble-scaling-delta__remove"
				data-button-variant="icon"
				type="button"
				aria-label={t('removeDelta')}
				data-tooltip={t('removeDelta')}
				onclick={() => onRemove(index)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</div>
	</div>
{/snippet}

<section>
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">{t('heading')}</h3>
	</header>

	<TagGroup
		grid={true}
		options={scalingModeOptions}
		selectedOptions={[scalingMode]}
		toggleOption={toggleScalingMode}
		--nimble-tag-group-grid-columns="repeat(3, 1fr)"
	/>

	{#if scalingMode === 'upcast'}
		<div class="nimble-scaling-deltas">
			<header class="nimble-section-header nimble-section-header--sub">
				<h4 class="nimble-heading" data-heading-variant="field">{t('perUpcastStep')}</h4>

				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					aria-label={t('addDelta')}
					data-tooltip={t('addDelta')}
					onclick={addDelta}
				>
					<i class="fa-solid fa-square-plus"></i>
				</button>
			</header>

			{#each scalingDeltas as delta, index}
				{@render DeltaEditor(delta, index, updateDelta, removeDelta)}
			{/each}

			{#if scalingDeltas.length === 0}
				<p class="nimble-scaling-empty">{t('noDeltas')}</p>
			{/if}
		</div>
	{/if}

	{#if scalingMode === 'upcastChoice'}
		<div class="nimble-scaling-choices">
			<header class="nimble-section-header nimble-section-header--sub">
				<h4 class="nimble-heading" data-heading-variant="field">{t('upcastChoices')}</h4>

				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					aria-label={t('addChoice')}
					data-tooltip={t('addChoice')}
					onclick={addChoice}
				>
					<i class="fa-solid fa-square-plus"></i>
				</button>
			</header>

			{#each scalingChoices ?? [] as choice, choiceIndex}
				<div class="nimble-scaling-choice nimble-card">
					<div class="nimble-scaling-choice__header">
						<label class="nimble-field" data-field-variant="stacked">
							<span class="nimble-heading" data-heading-variant="field">{t('choiceLabel')}</span>
							<input
								type="text"
								value={choice.label}
								placeholder={t('choiceLabelPlaceholder')}
								onchange={({ target }) => updateChoiceLabel(choiceIndex, target.value)}
							/>
						</label>

						<button
							class="nimble-button"
							data-button-variant="icon"
							type="button"
							aria-label={t('removeChoice')}
							data-tooltip={t('removeChoice')}
							onclick={() => removeChoice(choiceIndex)}
						>
							<i class="fa-solid fa-trash"></i>
						</button>
					</div>

					<div class="nimble-scaling-choice__deltas">
						<header class="nimble-section-header nimble-section-header--sub">
							<h5 class="nimble-heading" data-heading-variant="field">{t('deltas')}</h5>

							<button
								class="nimble-button"
								data-button-variant="icon"
								type="button"
								aria-label={t('addDelta')}
								data-tooltip={t('addDelta')}
								onclick={() => addChoiceDelta(choiceIndex)}
							>
								<i class="fa-solid fa-square-plus"></i>
							</button>
						</header>

						{#each choice.deltas as delta, deltaIndex}
							{@render DeltaEditor(
								delta,
								deltaIndex,
								(i, f, v) => updateChoiceDelta(choiceIndex, i, f, v),
								(i) => removeChoiceDelta(choiceIndex, i),
							)}
						{/each}
					</div>
				</div>
			{/each}

			{#if (scalingChoices ?? []).length === 0}
				<p class="nimble-scaling-empty">{t('noChoices')}</p>
			{/if}
		</div>
	{/if}
</section>

<style lang="scss">
	.nimble-scaling-deltas,
	.nimble-scaling-choices {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.nimble-scaling-delta {
		padding: 0.5rem;

		&__row {
			display: flex;
			gap: 0.375rem;
			align-items: flex-end;
			flex-wrap: wrap;

			.nimble-field {
				flex: 1;
				min-width: 0;
			}

			select,
			input {
				width: 100%;
			}
		}

		&__remove {
			flex: 0 0 auto;
			align-self: flex-end;
			margin-bottom: 0.125rem;
		}
	}

	.nimble-scaling-choice {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__header {
			display: flex;
			gap: 0.375rem;
			align-items: flex-end;

			.nimble-field {
				flex: 1;
			}
		}

		&__deltas {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			padding-left: 0.5rem;
			border-left: 2px solid var(--nimble-accent-color);
		}
	}

	.nimble-scaling-empty {
		font-size: var(--nimble-sm-text);
		color: var(--nimble-text-color-secondary);
		font-style: italic;
		margin: 0;
	}

	.nimble-section-header--sub {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-block-end: 0.25rem;
	}
</style>
