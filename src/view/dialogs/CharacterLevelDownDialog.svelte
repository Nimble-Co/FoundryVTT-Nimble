<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
	import type { NimbleClassItem } from '../../documents/item/class.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	function submit() {
		dialog.submit({
			confirmed: true,
		});
	}

	let { document: actor, dialog }: Props = $props();

	const levelUpHistory = actor.system.levelUpHistory;
	const lastHistory = levelUpHistory[levelUpHistory.length - 1];

	const characterClass: NimbleClassItem | undefined = lastHistory
		? actor.classes[lastHistory.classIdentifier]
		: undefined;

	const currentLevel = characterClass?.system?.classLevel ?? 1;
	const newLevel = currentLevel - 1;

	// Get skill names for display
	const skillChanges = Object.entries(lastHistory?.skillIncreases ?? {})
		.filter(([, value]) => (value as number) > 0)
		.map(([key, value]) => ({
			name: CONFIG.NIMBLE.skills[key]?.label ?? key,
			points: value as number,
		}));

	// Get ability score names for display
	const abilityChanges = Object.entries(lastHistory?.abilityIncreases ?? {})
		.filter(([, value]) => (value as number) > 0)
		.map(([key, value]) => ({
			name: CONFIG.NIMBLE.abilities[key]?.label ?? key,
			points: value as number,
		}));

	// Check if subclass will be removed
	const willRemoveSubclass = lastHistory?.level <= 3;
	const subclasses = actor.items.filter((i) => i.type === 'subclass');
	const hasSubclass = subclasses.length > 0;
</script>

<article class="nimble-sheet__body">
	<section class="nimble-level-down-header">
		<div class="nimble-level-down-portrait">
			<img src={actor.img} alt={actor.name} />
		</div>
		<div class="nimble-level-down-info">
			<h3 class="nimble-heading" data-heading-variant="section">{actor.name}</h3>
			<p class="nimble-level-transition">
				<span class="nimble-level-current"
					>{CONFIG.NIMBLE.levelDownDialog.level} {currentLevel}</span
				>
				<i class="fa-solid fa-arrow-right"></i>
				<span class="nimble-level-new">{CONFIG.NIMBLE.levelDownDialog.level} {newLevel}</span>
			</p>
		</div>
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{CONFIG.NIMBLE.levelDownDialog.changesToRevert}
			</h3>
		</header>

		<ul class="nimble-level-down-preview">
			{#if lastHistory?.hpIncrease > 0}
				<li class="nimble-level-down-preview__item nimble-level-down-preview__item--loss">
					<span class="nimble-level-down-preview__label">
						<i class="fa-solid fa-heart"></i>
						{CONFIG.NIMBLE.levelDownDialog.hitPoints}
					</span>
					<span class="nimble-level-down-preview__value">
						-{lastHistory.hpIncrease}
						{CONFIG.NIMBLE.levelDownDialog.hp}
					</span>
				</li>
			{/if}

			{#if lastHistory?.hitDieAdded}
				<li class="nimble-level-down-preview__item nimble-level-down-preview__item--loss">
					<span class="nimble-level-down-preview__label">
						<i class="fa-solid fa-dice-d20"></i>
						{CONFIG.NIMBLE.levelDownDialog.hitDie}
					</span>
					<span class="nimble-level-down-preview__value">
						-1 d{characterClass?.system?.hitDieSize ?? '?'}
					</span>
				</li>
			{/if}

			{#if abilityChanges.length > 0}
				{#each abilityChanges as ability}
					<li class="nimble-level-down-preview__item nimble-level-down-preview__item--loss">
						<span class="nimble-level-down-preview__label">
							<i class="fa-solid fa-chart-simple"></i>
							{ability.name}
						</span>
						<span class="nimble-level-down-preview__value">
							-{ability.points}
						</span>
					</li>
				{/each}
			{/if}

			{#if skillChanges.length > 0}
				{#each skillChanges as skill}
					<li class="nimble-level-down-preview__item nimble-level-down-preview__item--loss">
						<span class="nimble-level-down-preview__label">
							<i class="fa-solid fa-book"></i>
							{skill.name}
						</span>
						<span class="nimble-level-down-preview__value">
							-{skill.points}
							{skill.points !== 1
								? CONFIG.NIMBLE.levelDownDialog.points
								: CONFIG.NIMBLE.levelDownDialog.point}
						</span>
					</li>
				{/each}
			{/if}

			{#if willRemoveSubclass && hasSubclass}
				{#each subclasses as subclass}
					<li class="nimble-level-down-preview__item nimble-level-down-preview__item--warning">
						<span class="nimble-level-down-preview__label">
							<i class="fa-solid fa-star"></i>
							{CONFIG.NIMBLE.levelDownDialog.subclass}
						</span>
						<span class="nimble-level-down-preview__value">
							{subclass.name}
							{CONFIG.NIMBLE.levelDownDialog.removed}
						</span>
					</li>
				{/each}
			{/if}
		</ul>
	</section>

	<section class="nimble-level-down-warning">
		<i class="fa-solid fa-triangle-exclamation"></i>
		<p>{CONFIG.NIMBLE.levelDownDialog.warningMessage}</p>
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button nimble-button--danger"
		data-button-variant="full-width"
		onclick={submit}
	>
		{CONFIG.NIMBLE.levelDownDialog.confirmLevelDown}
	</button>
</footer>

<style lang="scss">
	.nimble-level-down-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--nimble-card-background);
		border-radius: 8px;
		box-shadow: var(--nimble-card-box-shadow);
	}

	.nimble-level-down-portrait {
		flex-shrink: 0;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--nimble-border-color);

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.nimble-level-down-info {
		flex: 1;

		.nimble-heading {
			margin: 0 0 0.25rem 0;
		}
	}

	.nimble-level-transition {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: var(--nimble-md-text);
		color: var(--nimble-medium-text-color);

		i {
			font-size: 0.75rem;
			opacity: 0.6;
		}
	}

	.nimble-level-current {
		font-weight: 600;
	}

	.nimble-level-new {
		font-weight: 600;
		color: var(--nimble-danger-color, hsl(0, 60%, 50%));
	}

	.nimble-level-down-preview {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;

		&__item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.5rem 0.75rem;
			background: var(--nimble-card-background);
			border-radius: 4px;
			box-shadow: var(--nimble-card-box-shadow);

			&--loss {
				.nimble-level-down-preview__value {
					color: var(--nimble-danger-color, hsl(0, 60%, 50%));
				}
			}

			&--warning {
				border-left: 3px solid var(--nimble-warning-color, hsl(40, 90%, 50%));

				.nimble-level-down-preview__value {
					color: var(--nimble-warning-color, hsl(40, 90%, 50%));
				}
			}
		}

		&__label {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			font-weight: 600;

			i {
				width: 1rem;
				text-align: center;
				opacity: 0.7;
			}
		}

		&__value {
			font-weight: 500;
		}
	}

	.nimble-level-down-warning {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-top: 1rem;
		padding: 0.75rem;
		background: hsla(0, 60%, 50%, 0.1);
		border-radius: 4px;
		border-left: 3px solid var(--nimble-danger-color, hsl(0, 60%, 50%));
		color: var(--nimble-danger-color, hsl(0, 60%, 50%));

		i {
			font-size: 1rem;
			margin-top: 0.125rem;
		}

		p {
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.4;
		}
	}

	.nimble-button--danger {
		background-color: var(--nimble-danger-color, hsl(0, 60%, 50%)) !important;
		color: white !important;

		&:hover:not(:disabled) {
			background-color: hsl(0, 60%, 45%) !important;
		}
	}
</style>
