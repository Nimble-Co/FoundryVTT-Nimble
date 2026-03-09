<script>
	import { onMount, onDestroy } from 'svelte';
	import localize from '../../utils/localize.js';

	const ASSESS_DC = 12;

	const assessOptions = [
		{
			id: 'ask-question',
			icon: 'fa-solid fa-circle-question',
			titleKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.description',
			successKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.success',
			failureKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.failure',
			requiresTarget: false,
		},
		{
			id: 'create-opening',
			icon: 'fa-solid fa-crosshairs',
			titleKey: 'NIMBLE.ui.heroicActions.assess.createOpening.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.assess.createOpening.description',
			successKey: 'NIMBLE.ui.heroicActions.assess.createOpening.success',
			failureKey: 'NIMBLE.ui.heroicActions.assess.createOpening.failure',
			requiresTarget: true,
		},
		{
			id: 'anticipate-danger',
			icon: 'fa-solid fa-shield',
			titleKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.title',
			descriptionKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.description',
			successKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.success',
			failureKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.failure',
			requiresTarget: false,
		},
	];

	function getTargetedTokens(actorId) {
		const targets = Array.from(game.user?.targets ?? []);
		// Filter out tokens belonging to the same actor (can't target self)
		return targets.filter((token) => token.actor?.id !== actorId);
	}

	function getInvalidTargets(actorId) {
		const targets = Array.from(game.user?.targets ?? []);
		// Return tokens that were filtered out (self-targeting)
		return targets.filter((token) => token.actor?.id === actorId);
	}

	function getTargetName(token) {
		return token?.actor?.name || token?.name || 'Unknown';
	}

	// Track targeting changes reactively
	let targetingVersion = $state(0);
	let hookId = null;

	onMount(() => {
		hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
	});

	onDestroy(() => {
		if (hookId !== null) {
			Hooks.off('targetToken', hookId);
		}
	});

	async function handleSubmit() {
		if (!selectedOption || !selectedSkill) return;

		const option = assessOptions.find((o) => o.id === selectedOption);

		// Check if target is required but not selected
		if (option.requiresTarget && !selectedTarget) return;

		// Only deduct action pip if in combat
		if (inCombat) {
			await deductActionPip();
		}

		// Roll the skill check (skip the roll dialog since we're already in a dialog)
		const { roll } = await document.rollSkillCheck(selectedSkill, { skipRollDialog: true });

		if (!roll) {
			dialog.close();
			return;
		}

		// Determine success/failure based on DC 12
		const isSuccess = roll.total >= ASSESS_DC;
		const resultKey = isSuccess ? option.successKey : option.failureKey;

		// Include target name in the message if there's a target
		const targetName = selectedTarget ? getTargetName(selectedTarget) : null;
		const resultMessage = localize(resultKey, { name: document.name, target: targetName });

		// Create chat message with proper type for Svelte rendering
		await ChatMessage.create({
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor: document }),
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			type: 'assessAction',
			system: {
				actorName: document.name,
				actorType: document.type,
				permissions: document.permission,
				rollMode: 0,
				skillKey: selectedSkill,
				dc: ASSESS_DC,
				isSuccess,
				optionTitle: localize(option.titleKey),
				resultMessage,
				target: selectedTarget ? selectedTarget.document.uuid : null,
				targetName,
			},
		});

		dialog.submit({
			option: selectedOption,
			skill: selectedSkill,
			isSuccess,
			target: selectedTarget?.document.uuid,
		});
	}

	let { document, dialog, deductActionPip, inCombat = false } = $props();

	const { skills: skillNames } = CONFIG.NIMBLE;

	let selectedOption = $state(null);
	let selectedSkill = $state(null);
	let selectedTarget = $state(null);

	// Check if the current option requires a target
	let currentOptionRequiresTarget = $derived(
		assessOptions.find((o) => o.id === selectedOption)?.requiresTarget ?? false,
	);

	// Get available targets (currently targeted tokens) - depends on targetingVersion for reactivity
	let availableTargets = $derived.by(() => {
		// Reference targetingVersion to trigger reactivity when targeting changes
		void targetingVersion;
		return getTargetedTokens(document.id);
	});

	// Track if the user has targeted themselves (to show a helpful message)
	let hasTargetedSelf = $derived.by(() => {
		void targetingVersion;
		return getInvalidTargets(document.id).length > 0;
	});

	// Auto-select target if exactly one is targeted
	$effect(() => {
		if (currentOptionRequiresTarget && availableTargets.length === 1) {
			selectedTarget = availableTargets[0];
		} else if (currentOptionRequiresTarget && availableTargets.length !== 1) {
			selectedTarget = null;
		}
	});

	// Clear target when switching to an option that doesn't require it
	$effect(() => {
		if (!currentOptionRequiresTarget) {
			selectedTarget = null;
		}
	});

	let sortedSkills = $derived(
		Object.entries(skillNames).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB)),
	);

	// Determine if submit should be disabled (requires exactly one target for Create an Opening)
	let isSubmitDisabled = $derived(
		!selectedOption ||
			!selectedSkill ||
			(currentOptionRequiresTarget && availableTargets.length !== 1),
	);
</script>

<article class="nimble-sheet__body assess-dialog">
	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.ui.heroicActions.assess.chooseOption')}
			</h3>
		</header>

		<div class="assess-dialog__options">
			{#each assessOptions as option}
				<label class="assess-option" class:assess-option--active={selectedOption === option.id}>
					<input
						class="assess-option__input"
						type="radio"
						name="assess-option"
						value={option.id}
						bind:group={selectedOption}
					/>

					<i class="assess-option__icon {option.icon}"></i>

					<div class="assess-option__content">
						<span class="assess-option__title">{localize(option.titleKey)}</span>
						<span class="assess-option__description">{localize(option.descriptionKey)}</span>
					</div>

					<div class="assess-option__indicator"></div>
				</label>
			{/each}
		</div>
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.ui.heroicActions.assess.selectSkill')}
			</h3>
		</header>

		<select class="assess-dialog__select" bind:value={selectedSkill}>
			<option value={null} disabled
				>{localize('NIMBLE.ui.heroicActions.assess.selectSkillPlaceholder')}</option
			>
			{#each sortedSkills as [skillKey, skillName]}
				<option value={skillKey}>{skillName}</option>
			{/each}
		</select>
	</section>

	{#if currentOptionRequiresTarget}
		<section>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ui.heroicActions.assess.selectTarget')}
				</h3>
			</header>

			{#if availableTargets.length === 0}
				<div class="assess-dialog__no-targets">
					<i class="fa-solid fa-crosshairs"></i>
					{#if hasTargetedSelf}
						<span>{localize('NIMBLE.ui.heroicActions.assess.cannotTargetSelf')}</span>
					{:else}
						<span>{localize('NIMBLE.ui.heroicActions.assess.noTargetsHint')}</span>
					{/if}
				</div>
			{:else if availableTargets.length === 1}
				<div class="assess-dialog__targets">
					<div class="assess-target assess-target--active assess-target--single">
						<img
							class="assess-target__img"
							src={availableTargets[0].document?.texture?.src || 'icons/svg/mystery-man.svg'}
							alt={getTargetName(availableTargets[0])}
						/>
						<span class="assess-target__name">{getTargetName(availableTargets[0])}</span>
						<i class="fa-solid fa-check assess-target__check"></i>
					</div>
				</div>
			{:else}
				<div class="assess-dialog__no-targets assess-dialog__no-targets--warning">
					<i class="fa-solid fa-triangle-exclamation"></i>
					<span>{localize('NIMBLE.ui.heroicActions.assess.tooManyTargetsHint')}</span>
				</div>
			{/if}
		</section>
	{/if}
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={() => dialog.close()}>
		{localize('NIMBLE.ui.cancel')}
	</button>
	<button
		class="nimble-button"
		data-button-variant="primary"
		disabled={isSubmitDisabled}
		onclick={handleSubmit}
	>
		{#if selectedSkill}
			{localize('NIMBLE.ui.heroicActions.assess.rollToAssess', {
				skill: skillNames[selectedSkill],
			})}
		{:else}
			{localize('NIMBLE.ui.heroicActions.assess.rollToAssessNoSkill')}
		{/if}
	</button>
</footer>

<style lang="scss">
	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;

		display: flex;
		gap: 0.5rem;

		.nimble-button {
			flex: 1;
		}
	}

	.assess-dialog {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.75rem;

		&__options {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__select {
			width: 100%;
			padding: 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 4px;
			cursor: pointer;

			&:focus {
				outline: none;
				border-color: var(--nimble-input-focus-border-color);
			}
		}
	}

	.assess-option {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover:not(&--active) {
			border-color: var(--nimble-accent-color);
		}

		&--active {
			border-color: hsl(45, 60%, 45%);
			background: hsla(45, 60%, 50%, 0.12);
			box-shadow: inset 0 0 0 1px hsla(45, 60%, 50%, 0.2);
		}

		&__input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&__icon {
			flex-shrink: 0;
			font-size: var(--nimble-md-text);
			color: var(--nimble-medium-text-color);
			transition: color 0.2s ease;

			.assess-option--active & {
				color: hsl(45, 60%, 40%);
			}
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			flex: 1;
			min-width: 0;
		}

		&__title {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
			transition: color 0.2s ease;

			.assess-option--active & {
				color: hsl(45, 50%, 30%);
			}
		}

		&__description {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			line-height: 1.4;
		}

		&__indicator {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			width: 0.625rem;
			height: 0.625rem;
			border-radius: 50%;
			background: transparent;
			border: 2px solid transparent;
			transition: all 0.2s ease;

			.assess-option--active & {
				background: hsl(45, 70%, 50%);
				border-color: hsl(45, 70%, 40%);
				box-shadow: 0 0 8px hsla(45, 70%, 50%, 0.6);
			}
		}
	}

	:global(.theme-dark) .assess-option {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover:not(.assess-option--active) {
			border-color: hsl(220, 15%, 45%);
			background: hsl(220, 15%, 22%);
		}
	}

	:global(.theme-dark) .assess-option--active {
		border-color: hsl(45, 70%, 55%);
		background: linear-gradient(135deg, hsla(45, 60%, 50%, 0.2) 0%, hsla(45, 60%, 40%, 0.1) 100%);
		box-shadow:
			inset 0 0 0 1px hsla(45, 60%, 60%, 0.3),
			0 0 12px hsla(45, 60%, 50%, 0.15);
	}

	:global(.theme-dark) .assess-option--active .assess-option__icon {
		color: hsl(45, 70%, 65%);
	}

	:global(.theme-dark) .assess-option--active .assess-option__title {
		color: hsl(45, 60%, 75%);
	}

	:global(.theme-dark) .assess-option--active .assess-option__description {
		color: hsl(220, 10%, 80%);
	}

	:global(.theme-dark) .assess-option--active .assess-option__indicator {
		background: hsl(45, 70%, 55%);
		border-color: hsl(45, 70%, 65%);
		box-shadow: 0 0 10px hsla(45, 70%, 55%, 0.7);
	}

	.assess-dialog__no-targets {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		color: var(--nimble-medium-text-color);
		font-size: var(--nimble-sm-text);
		text-align: center;
		background: var(--nimble-box-background-color);
		border: 1px dashed var(--nimble-card-border-color);
		border-radius: 4px;

		i {
			font-size: var(--nimble-lg-text);
			opacity: 0.5;
		}

		&--warning {
			color: #fff;
			background: hsl(35, 85%, 55%);
			border-color: hsl(35, 85%, 45%);
			border-style: solid;

			i {
				opacity: 1;
			}
		}
	}

	.assess-dialog__targets {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.assess-target {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;

		&:hover:not(&--active) {
			border-color: var(--nimble-accent-color);
		}

		&--active {
			border-color: hsl(45, 60%, 45%);
			background: hsla(45, 60%, 50%, 0.12);
		}

		&__input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&__img {
			width: 1.75rem;
			height: 1.75rem;
			border-radius: 3px;
			object-fit: cover;
			border: 1px solid var(--nimble-card-border-color);
		}

		&__name {
			flex: 1;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			color: var(--nimble-dark-text-color);
		}

		&__check {
			color: hsl(139, 50%, 40%);
			font-size: var(--nimble-sm-text);
		}

		&--single {
			cursor: default;
		}
	}

	:global(.theme-dark) .assess-target {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover:not(.assess-target--active) {
			border-color: hsl(220, 15%, 45%);
		}
	}

	:global(.theme-dark) .assess-target--active {
		border-color: hsl(45, 70%, 55%);
		background: hsla(45, 60%, 50%, 0.15);
	}

	:global(.theme-dark) .assess-target__check {
		color: hsl(139, 50%, 55%);
	}
</style>
