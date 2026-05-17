<script>
	import { getContext } from 'svelte';
	import localize from '#utils/localize.js';
	import { createEffectNode } from '../../../utils/treeManipulation/createEffectNode.js';
	import { deleteEffectNode } from '../../../utils/treeManipulation/deleteEffectNode.js';
	import { updateEffectNode } from '../../../utils/treeManipulation/updateEffectNode.js';
	import TagGroup from '../../components/TagGroup.svelte';
	import {
		POOL_PREDICATE_PLACEHOLDER,
		getDamageOutcomes,
		getDispositionOptions,
		getNodeOptions,
		getNoteTypes,
		getPoolActions,
		getPoolTypes,
		getValidActionConsequences,
		prepareSavingThrowOptions,
	} from './itemActivationEffectsConfigTabHelpers.js';

	const { conditions, damageTypes, healingTypes, savingThrows, saves } = CONFIG.NIMBLE;

	const damageOutcomes = getDamageOutcomes();
	const dispositionOptions = getDispositionOptions();
	const noteTypes = getNoteTypes();
	const poolTypes = getPoolTypes();
	const poolActions = getPoolActions();
	const savingThrowOptions = prepareSavingThrowOptions(savingThrows);

	// Maps a node.type back to its render snippet. Snippets are template-bound
	// so they cannot be lifted into a helper; this dispatcher must stay here.
	function getNodeSnippet(nodeType) {
		switch (nodeType) {
			case 'condition':
				return ConditionNode;
			case 'damage':
				return DamageNode;
			case 'damageOutcome':
				return DamageOutcomeNode;
			case 'healing':
				return HealingNode;
			case 'pool':
				return PoolNode;
			case 'savingThrow':
				return SaveNode;
			case 'note':
				return TextNode;
		}

		return null;
	}

	function toggleEffectCreationOptions() {
		const creationButtons = this.closest('header').nextElementSibling;
		creationButtons.style.display = 'block';
	}

	let document = getContext('document');

	let effects = $derived(document.reactive.system.activation.effects);
</script>

<section>
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.activationEffects.effects')}
		</h3>

		<button
			class="nimble-button"
			data-button-variant="icon"
			aria-label={localize('NIMBLE.activationEffects.addEffect')}
			data-tooltip={localize('NIMBLE.activationEffects.addEffect')}
			onclick={toggleEffectCreationOptions}
		>
			<i class="fa-solid fa-square-plus"></i>
		</button>
	</header>

	{@render EffectCreationButtons(null, null)}

	<section class="nimble-effect-tree">
		<ul>
			{#each effects as node}
				{@render getNodeSnippet(node?.type)?.(node)}
			{/each}
		</ul>
	</section>
</section>

{#snippet EffectCreationButtons(node, context, sharedRoll = null)}
	<div style="display: none; margin-bottom: 0.25rem;">
		<TagGroup
			options={getNodeOptions(node, context)}
			toggleOption={(nodeType, event) =>
				createEffectNode(document, effects, nodeType, event, context, sharedRoll)}
		/>
	</div>
{/snippet}

{#snippet DamageNode(node, parentNode = null)}
	{#snippet MainConfig(node, parentNode = null)}
		<div
			class="nimble-effect-main-config"
			class:nimble-effect-main-config--roll={node.type === 'damage' || node.type === 'healing'}
			class:nimble-effect-main-config--no-sub-config={parentNode &&
				node.parentContext !== 'sharedRolls'}
		>
			<div class="nimble-config-block nimble-card">
				<!-- Check the damage node id against the first damage node id in the effects list -->
				{#if node.id === effects.find((effect) => effect.type === 'damage')?.id}
					<label class="nimble-field">
						<input
							type="checkbox"
							checked={node.canMiss}
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'canMiss', target.checked)}
						/>

						<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
							{localize('NIMBLE.activationEffects.canMiss')}
						</h5>
					</label>

					<label class="nimble-field">
						<input
							type="checkbox"
							checked={node.canCrit}
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'canCrit', target.checked)}
						/>

						<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
							{localize('NIMBLE.activationEffects.canCrit')}
						</h5>
					</label>
				{/if}

				<label class="nimble-field">
					<input
						type="checkbox"
						checked={node.ignoreArmor}
						onchange={({ target }) =>
							updateEffectNode(document, effects, node, 'ignoreArmor', target.checked)}
					/>

					<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
						{localize('NIMBLE.activationEffects.ignoreArmor')}
					</h5>
				</label>

				<label class="nimble-field">
					<input
						type="checkbox"
						checked={node.ignoreAllies}
						onchange={({ target }) =>
							updateEffectNode(document, effects, node, 'ignoreAllies', target.checked)}
					/>

					<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
						{localize('NIMBLE.activationEffects.onlyDamageHostile')}
					</h5>
				</label>

				<div style="display: flex; gap: 0.5rem; width: 100%;">
					<label style="width: 100%; flex-grow: 1;">
						<header class="nimble-header">
							<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
								{localize('NIMBLE.activationEffects.rollFormula')}
							</h5>
						</header>

						<input
							type="text"
							value={node.formula}
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'formula', target.value)}
						/>
					</label>

					<!-- <button
                        class="nimble-button"
                        data-button-variant="basic"
                        data-tooltip="Configure Damage Scaling"
                        aria-label="Configure Damage Scaling"
                        type="button"
                        onclick={() => openScalingDialog(document, node)}
                    >
                        <i
                            class="nimble-button__icon fa-solid fa-arrow-up-right-dots"
                        ></i>
                    </button> -->

					<label>
						<header class="nimble-header" style="padding-inline-end: 0.5rem;">
							<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
								{localize('NIMBLE.activationEffects.damageType')}
							</h5>
						</header>

						<select
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'damageType', target.value)}
						>
							{#each Object.entries(damageTypes) as [value, label]}
								<option {value} selected={value === node.damageType}>{label}</option>
							{/each}
						</select>
					</label>

					<label>
						<header class="nimble-header" style="padding-inline-end: 0.5rem;">
							<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
								Target Disposition
							</h5>
						</header>

						<select
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'targetDisposition', target.value)}
						>
							{#each dispositionOptions as { value, label }}
								<option {value} selected={value === (node.targetDisposition ?? 'any')}>
									{label}
								</option>
							{/each}
						</select>
					</label>
				</div>
			</div>
		</div>
	{/snippet}

	<li data-node-id={node.id}>
		{#if !parentNode || node.parentContext === 'sharedRolls'}
			<details open>
				<summary class="nimble-tree-node-summary">
					<h4 class="nimble-heading" data-heading-variant="field">
						{localize('NIMBLE.activationEffects.damage')}
					</h4>

					<button
						class="nimble-button"
						data-button-variant="icon"
						aria-label={localize('NIMBLE.activationEffects.deleteDamage')}
						data-tooltip={localize('NIMBLE.activationEffects.deleteDamage')}
						type="button"
						onclick={() => deleteEffectNode(document, effects, node.id)}
					>
						<i class="fa-solid fa-trash"></i>
					</button>
				</summary>

				{@render MainConfig(node, parentNode)}

				<ul>
					{#each getValidActionConsequences(node) as [key, label]}
						<li>
							<header>
								<h4 class="nimble-heading" data-heading-variant="field">
									{label}
								</h4>

								{#if node.parentContext === 'sharedRolls'}
									<button
										class="nimble-button"
										data-button-variant="icon"
										aria-label={localize('NIMBLE.activationEffects.addSharedRoll')}
										data-tooltip={localize('NIMBLE.activationEffects.addSharedRoll')}
										type="button"
										onclick={(event) =>
											createEffectNode(document, effects, 'damageOutcome', event, key)}
									>
										<i class="fa-solid fa-square-plus"></i>
									</button>
								{:else}
									<button
										class="nimble-button"
										data-button-variant="icon"
										aria-label={localize('NIMBLE.activationEffects.addChild')}
										data-tooltip={localize('NIMBLE.activationEffects.addChild')}
										type="button"
										onclick={toggleEffectCreationOptions}
									>
										<i class="fa-solid fa-square-plus"></i>
									</button>
								{/if}
							</header>

							{@render EffectCreationButtons(node, key)}

							{#if node?.on?.[key]?.length}
								<ul>
									{#each node.on[key] as childNode}
										{@render getNodeSnippet(childNode?.type)(childNode, node)}
									{/each}
								</ul>
							{:else}
								<span>{localize('NIMBLE.activationEffects.noAdditionalEffects')}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</details>
		{:else}
			<header>
				<h4 class="nimble-heading" data-heading-variant="field">
					{localize('NIMBLE.activationEffects.damage')}
				</h4>

				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label={localize('NIMBLE.activationEffects.deleteDamage')}
					data-tooltip={localize('NIMBLE.activationEffects.deleteDamage')}
					type="button"
					onclick={() => deleteEffectNode(document, effects, node.id)}
				>
					<i class="fa-solid fa-trash"></i>
				</button>
			</header>

			{@render MainConfig(node, parentNode)}
		{/if}
	</li>
{/snippet}

{#snippet HealingNode(node, _parentNode = null)}
	<li data-node-id={node.id}>
		<header>
			<h4 class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.activationEffects.healing')}
			</h4>

			<button
				class="nimble-button"
				data-button-variant="icon"
				aria-label={localize('NIMBLE.activationEffects.deleteHealing')}
				data-tooltip={localize('NIMBLE.activationEffects.deleteHealing')}
				type="button"
				onclick={() => deleteEffectNode(document, effects, node.id)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</header>

		<div class="nimble-effect-main-config nimble-effect-main-config--no-sub-config">
			<div class="nimble-config-block nimble-card">
				<div style="display: flex; gap: 0.5rem; width: 100%;">
					<label style="width: 100%; flex-grow: 1;">
						<header class="nimble-header">
							<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
								{localize('NIMBLE.activationEffects.rollFormula')}
							</h5>
						</header>

						<input
							type="text"
							value={node.formula}
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'formula', target.value)}
						/>
					</label>

					<!-- <button
                        class="nimble-button"
                        data-button-variant="basic"
                        data-tooltip="Configure Damage Scaling"
                        aria-label="Configure Damage Scaling"
                        type="button"
                    >
                        <i
                            class="nimble-button__icon fa-solid fa-arrow-up-right-dots"
                        ></i>
                    </button> -->

					<label>
						<header class="nimble-header" style="padding-inline-end: 0.5rem;">
							<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
								{localize('NIMBLE.activationEffects.healingType')}
							</h5>
						</header>

						<select
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'healingType', target.value)}
						>
							{#each Object.entries(healingTypes) as [value, label]}
								<option {value} selected={value === node.healingType}>{label}</option>
							{/each}
						</select>
					</label>

					<label>
						<header class="nimble-header" style="padding-inline-end: 0.5rem;">
							<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
								Target Disposition
							</h5>
						</header>

						<select
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'targetDisposition', target.value)}
						>
							{#each dispositionOptions as { value, label }}
								<option {value} selected={value === (node.targetDisposition ?? 'any')}>
									{label}
								</option>
							{/each}
						</select>
					</label>
				</div>
			</div>
		</div>
	</li>
{/snippet}

{#snippet SaveNode(node, _parentNode = null)}
	<li data-node-id={node.id}>
		<details open>
			<summary class="nimble-tree-node-summary">
				<h4 class="nimble-heading" data-heading-variant="field">{saves.save}</h4>

				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label={saves.deleteSavePrompt}
					data-tooltip={saves.deleteSavePrompt}
					type="button"
					onclick={() => deleteEffectNode(document, effects, node.id)}
				>
					<i class="fa-solid fa-trash"></i>
				</button>
			</summary>

			<div class="nimble-effect-main-config">
				<div class="nimble-config-block nimble-card">
					<div style="width: 100%; flex-grow: 1;">
						<header class="nimble-header">
							<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
								{saves.saveType}
							</h5>
						</header>

						<TagGroup
							options={savingThrowOptions}
							selectedOptions={[node.saveType]}
							toggleOption={(value) => updateEffectNode(document, effects, node, 'saveType', value)}
						/>
					</div>

					<label>
						<header class="nimble-header">
							<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
								{localize('NIMBLE.activationEffects.customSaveDC')}
							</h5>
						</header>

						<input
							type="number"
							value={node.saveDC}
							onchange={({ target }) =>
								updateEffectNode(document, effects, node, 'saveDC', target.value)}
						/>
					</label>
				</div>
			</div>

			<ul>
				<li>
					<header>
						<h4 class="nimble-heading" data-heading-variant="field">
							{localize('NIMBLE.activationEffects.sharedRolls')}
						</h4>

						<button
							class="nimble-button"
							data-button-variant="icon"
							aria-label={localize('NIMBLE.activationEffects.addSharedRoll')}
							data-tooltip={localize('NIMBLE.activationEffects.addSharedRoll')}
							type="button"
							onclick={(event) =>
								createEffectNode(document, effects, 'damage', event, 'sharedRolls')}
						>
							<i class="fa-solid fa-square-plus"></i>
						</button>
					</header>

					{#if node?.sharedRolls?.length}
						<ul>
							{#each node.sharedRolls as childNode}
								{@render getNodeSnippet(childNode?.type)(childNode, node)}
							{/each}
						</ul>
					{:else}
						<span>{localize('NIMBLE.activationEffects.none')}</span>
					{/if}
				</li>

				<li>
					<header>
						<h4 class="nimble-heading" data-heading-variant="field">
							{localize('NIMBLE.activationEffects.onFailedSave')}
						</h4>

						<button
							class="nimble-button"
							data-button-variant="icon"
							aria-label={localize('NIMBLE.activationEffects.addOnFail')}
							data-tooltip={localize('NIMBLE.activationEffects.addOnFail')}
							type="button"
							onclick={toggleEffectCreationOptions}
						>
							<i class="fa-solid fa-square-plus"></i>
						</button>
					</header>

					{@render EffectCreationButtons(node, 'failedSave', node.sharedRolls[0]?.id)}

					{#if node?.on?.failedSave?.length}
						<ul>
							{#each node.on.failedSave as childNode}
								{@render getNodeSnippet(childNode?.type)(childNode, node)}
							{/each}
						</ul>
					{:else}
						<span>{localize('NIMBLE.activationEffects.noAdditionalEffects')}</span>
					{/if}
				</li>

				<li>
					<header>
						<h4 class="nimble-heading" data-heading-variant="field">
							{localize('NIMBLE.activationEffects.onPassedSave')}
						</h4>

						<button
							class="nimble-button"
							data-button-variant="icon"
							aria-label={localize('NIMBLE.activationEffects.addOnSave')}
							data-tooltip={localize('NIMBLE.activationEffects.addOnSave')}
							type="button"
							onclick={toggleEffectCreationOptions}
						>
							<i class="fa-solid fa-square-plus"></i>
						</button>
					</header>

					{@render EffectCreationButtons(node, 'passedSave', node.sharedRolls[0]?.id)}

					{#if node?.on?.passedSave?.length}
						<ul>
							{#each node.on.passedSave as childNode}
								{@render getNodeSnippet(childNode?.type)(childNode, node)}
							{/each}
						</ul>
					{:else}
						<span>{localize('NIMBLE.activationEffects.noAdditionalEffects')}</span>
					{/if}
				</li>
			</ul>
		</details>
	</li>
{/snippet}

{#snippet ConditionNode(node, _parentNode = null)}
	<li data-node-id={node.id}>
		<header>
			<h4 class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.activationEffects.statusCondition')}
			</h4>

			<button
				class="nimble-button"
				data-button-variant="icon"
				aria-label={localize('NIMBLE.activationEffects.deleteCondition')}
				data-tooltip={localize('NIMBLE.activationEffects.deleteCondition')}
				type="button"
				onclick={() => deleteEffectNode(document, effects, node.id)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</header>

		<div class="nimble-effect-main-config nimble-effect-main-config--no-sub-config">
			<div class="nimble-config-block nimble-card">
				<label class="nimble-field" data-field-variant="stacked">
					<select
						onchange={({ target }) =>
							updateEffectNode(document, effects, node, 'condition', target.value)}
					>
						{#each Object.entries(conditions) as [value, label]}
							<option {value} selected={value === node.condition}>
								{label}
							</option>
						{/each}
					</select>
				</label>
			</div>
		</div>
	</li>
{/snippet}

{#snippet DamageOutcomeNode(node, parentNode = null)}
	<li data-node-id={node.id}>
		<header>
			<h4 class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.activationEffects.damageOutcome')}
			</h4>

			<button
				class="nimble-button"
				data-button-variant="icon"
				aria-label={localize('NIMBLE.activationEffects.deleteDamageOutcome')}
				data-tooltip={localize('NIMBLE.activationEffects.deleteDamageOutcome')}
				type="button"
				onclick={() => deleteEffectNode(document, effects, node.id)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</header>

		<div class="nimble-effect-main-config nimble-effect-main-config--no-sub-config">
			<div class="nimble-config-block nimble-card">
				<label class="nimble-field" style="gap: 0;" data-field-variant="stacked">
					{#if parentNode.type === 'savingThrow'}
						<header>
							<h4 class="nimble-heading" data-heading-variant="field">
								{localize('NIMBLE.activationEffects.damageOutcome')}
							</h4>
						</header>
					{/if}

					<select
						onchange={({ target }) =>
							updateEffectNode(document, effects, node, 'outcome', target.value)}
					>
						{#each damageOutcomes as { value, label }}
							<option {value} selected={value === node.outcome}>
								{label}
							</option>
						{/each}
					</select>
				</label>
			</div>
		</div>
	</li>
{/snippet}

{#snippet PoolNode(node, _parentNode = null)}
	<li data-node-id={node.id}>
		<header>
			<h4 class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.activationEffects.pool')}
			</h4>

			<button
				class="nimble-button"
				data-button-variant="icon"
				aria-label={localize('NIMBLE.activationEffects.poolNode.config.deleteLabel')}
				data-tooltip={localize('NIMBLE.activationEffects.poolNode.config.deleteLabel')}
				type="button"
				onclick={() => deleteEffectNode(document, effects, node.id)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</header>

		<div
			class="nimble-effect-main-config nimble-effect-main-config--no-sub-config"
			style="--nimble-card-width: 320px;"
		>
			<div class="nimble-config-block nimble-card">
				<div style="width: 100%;">
					<header class="nimble-header">
						<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
							{localize('NIMBLE.activationEffects.poolNode.config.poolTypeLabel')}
						</h5>
					</header>
					<TagGroup
						options={poolTypes}
						selectedOptions={[node.poolType]}
						toggleOption={(value) => updateEffectNode(document, effects, node, 'poolType', value)}
					/>
				</div>

				<div style="width: 100%;">
					<header class="nimble-header">
						<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
							{localize('NIMBLE.activationEffects.poolNode.config.actionLabel')}
						</h5>
					</header>
					<TagGroup
						options={poolActions}
						selectedOptions={[node.action]}
						toggleOption={(value) => updateEffectNode(document, effects, node, 'action', value)}
					/>
				</div>

				<label class="nimble-field" style="width: 100%;">
					<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
						{localize('NIMBLE.activationEffects.poolNode.config.identifierLabel')}
					</h5>
					<input
						type="text"
						value={node.poolIdentifier}
						onchange={({ target }) =>
							updateEffectNode(document, effects, node, 'poolIdentifier', target.value)}
					/>
				</label>

				<label class="nimble-field" style="width: 100%;">
					<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
						{localize('NIMBLE.activationEffects.poolNode.config.valueLabel')}
					</h5>
					<input
						type="number"
						min="0"
						step="1"
						value={node.value}
						onchange={({ target }) =>
							updateEffectNode(document, effects, node, 'value', Number(target.value) || 0)}
					/>
				</label>

				<label class="nimble-field" style="width: 100%;">
					<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
						{localize('NIMBLE.activationEffects.poolNode.config.predicateLabel')}
					</h5>
					<textarea
						rows="2"
						placeholder={POOL_PREDICATE_PLACEHOLDER}
						value={JSON.stringify(node.predicate ?? {})}
						onchange={({ target }) => {
							try {
								const parsed = target.value.trim() ? JSON.parse(target.value) : {};
								updateEffectNode(document, effects, node, 'predicate', parsed);
							} catch (_err) {
								ui.notifications?.error(
									localize('NIMBLE.activationEffects.poolNode.config.predicateInvalid'),
								);
								target.value = JSON.stringify(node.predicate ?? {});
							}
						}}
					></textarea>
				</label>
			</div>
		</div>
	</li>
{/snippet}

{#snippet TextNode(node, _parentNode = null)}
	<li data-node-id={node.id}>
		<header>
			<h4 class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.activationEffects.note')}
			</h4>

			<button
				class="nimble-button"
				data-button-variant="icon"
				aria-label={localize('NIMBLE.activationEffects.deleteNote')}
				data-tooltip={localize('NIMBLE.activationEffects.deleteNote')}
				type="button"
				onclick={() => deleteEffectNode(document, effects, node.id)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</header>

		<div
			class="nimble-effect-main-config nimble-effect-main-config--no-sub-config"
			style="--nimble-card-width: 275px;"
		>
			<div class="nimble-config-block nimble-card">
				<textarea
					rows="3"
					onchange={({ target }) => updateEffectNode(document, effects, node, 'text', target.value)}
					value={node.text}
				></textarea>

				<div style="width: 100%; flex-grow: 1;">
					<header class="nimble-header">
						<h5 class="nimble-field__label nimble-heading" data-heading-variant="field">
							{localize('NIMBLE.activationEffects.noteType')}
						</h5>
					</header>

					<TagGroup
						options={noteTypes}
						selectedOptions={[node.noteType]}
						toggleOption={(value) => updateEffectNode(document, effects, node, 'noteType', value)}
					/>
				</div>
			</div>
		</div>
	</li>
{/snippet}

<style lang="scss">
	.nimble-effect-tree {
		--tree-clr: #dfddd5;
		--tree-font-size: var(--nimble-sm-text);
		--tree-item-height: 2;
		--tree-offset: 0.375rem;
		--tree-thickness: 2px;
		--tree-style: solid;

		--nimble-heading-line-height: var(--tree-item-height);
		--nimble-heading-margin: 0 0.375rem;

		margin-block-start: 1.25rem;
	}

	.nimble-effect-tree .nimble-field__label {
		text-indent: 0;
	}

	.nimble-effect-tree header {
		display: flex;
		align-items: baseline;
	}

	.nimble-effect-tree summary {
		position: relative;

		* {
			display: inline !important;
		}
	}

	.nimble-effect-tree ul {
		display: grid;
		list-style: none;
		font-size: var(--tree-font-size);
		margin-block: 0.75rem 0;
	}

	.nimble-effect-tree li {
		line-height: var(--tree-item-height);
		padding-inline-start: var(--tree-offset);
		border-left: var(--tree-thickness) var(--tree-style) var(--tree-clr);
		position: relative;
		text-indent: 0.5rem;
		margin-bottom: 0;
		transform: translateY(-1px);

		&:last-child {
			border-color: transparent; /* hide (not remove!) border on last li element*/
		}

		& span {
			display: block;
			font-size: var(--nimble-xs-text);
			font-weight: 200;
			opacity: 0.65;
			text-indent: 1rem;
		}

		&::before {
			content: '';
			position: absolute;
			top: calc(
				var(--tree-item-height) / 2 * -1 * var(--tree-font-size) + var(--tree-thickness) - 2.5px
			);
			left: calc(var(--tree-thickness) * -1 + 0.5px);
			width: calc(var(--tree-offset) + var(--tree-thickness) * 2);
			height: calc(var(--tree-item-height) * var(--tree-font-size));
			border-left: var(--tree-thickness) var(--tree-style) var(--tree-clr);
			border-bottom: var(--tree-thickness) var(--tree-style) var(--tree-clr);
		}
	}

	.nimble-effect-main-config {
		--nimble-card-padding: 0.375rem;
		--nimble-heading-margin: 0;

		max-width: 22rem;
		width: fit-content;
		margin-block-end: 0;
		margin-inline-start: 1.25rem;
		padding-block-start: 0.5rem;
		padding-inline-start: 0.75rem;
		border-inline-start: var(--tree-thickness) var(--tree-style) var(--tree-clr);

		&--roll {
			width: 100%;
		}

		&--no-sub-config {
			border-inline-start: 0;
			margin-inline-start: 0;
			padding-block-start: 0.25rem;
			margin-block-end: 0.25rem;
		}

		.nimble-card {
			gap: 0;
			text-indent: 0;
		}

		.nimble-button {
			--nimble-button-min-width: var(--input-height);
			--nimble-button-height: var(--input-height);

			align-self: end;
		}
	}

	textarea {
		width: 100%;
		padding: 0.375rem;
		resize: none;
	}
</style>
