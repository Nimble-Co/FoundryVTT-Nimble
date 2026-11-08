<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { AttackOutcomeTag } from '#types/attackOutcome.d.ts';
	import type { RerollHistoryProps } from '#types/components/RerollHistory.d.ts';

	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import DieFace from '../../components/DieFace.svelte';
	import { signed } from './primaryDieBonusText.ts';
	import { REACTION_VERB_ICONS } from './reactionVerbs.ts';
	import { createRerollHistoryState } from './RerollHistory.svelte.ts';
	import { createTagNotes } from './tagNotes.ts';
	type RerollHistoryLine = RerollHistoryProps['lines'][number];

	const OUTCOME_TAG_ICONS: Record<AttackOutcomeTag['kind'], string> = {
		maxDamage: 'fa-angles-up',
		keptAmount: 'fa-angles-up',
		critDice: 'fa-dice-d20',
		crit: 'fa-burst',
		cannotMiss: 'fa-bullseye',
		noOutcome: 'fa-ban',
		mustAttackOther: 'fa-arrows-turn-to-dots',
	};

	const TAG_ICONS: Record<RerollHistoryLine['tags'][number]['kind'], string> = {
		automatic: 'fa-gear',
		rollMode: 'fa-dice',
		extraDamage: 'fa-burst',
		action: 'fa-bolt',
		noAction: 'fa-ban',
		tempHp: 'fa-shield-heart',
		crit: 'fa-burst',
		miss: 'fa-xmark',
		stat: 'fa-arrows-rotate',
		cannotMiss: 'fa-bullseye',
	};

	let {
		legacyLines,
		lines,
		pendingKeep,
		pendingLine,
		held,
		primaryDieBonuses = [],
		keptAmount = null,
		bonusNotAdded = null,
		outcomeTags = [],
	}: RerollHistoryProps = $props();

	const message = getContext<NimbleChatMessage>('messageDocument');
	const keepChoice = createRerollHistoryState(message, () => ({ pendingKeep, held }));
	const tagNotes = createTagNotes(message?.id ?? '');
</script>

{#snippet tagButton(
	row: string,
	id: string,
	tag: { label: string; tooltip: string },
	icon: string,
	look: { off?: boolean; none?: boolean; crit?: boolean },
)}
	<button
		type="button"
		class="nimble-reroll-tag"
		class:nimble-reroll-tag--off={look.off}
		class:nimble-reroll-tag--none={look.none}
		class:nimble-reroll-tag--crit={look.crit}
		aria-expanded={tagNotes.openTag(row) === id}
		data-tooltip={tag.tooltip}
		onclick={() => tagNotes.toggle(row, id)}
	>
		<i class="fa-solid {icon}" aria-hidden="true"></i>
		<span>{tag.label}</span>
	</button>
{/snippet}

{#snippet tagNote(row: string, tags: { id: string; tooltip: string }[])}
	{@const open = tags.find((tag) => tag.id === tagNotes.openTag(row))}
	{#if open}
		<p class="nimble-roll-changes__note">{open.tooltip}</p>
	{/if}
{/snippet}

{#if outcomeTags.length > 0}
	<div class="nimble-roll-changes__tags nimble-roll-changes__tags--outcome">
		{#each outcomeTags as tag (tag.label)}
			{@render tagButton('outcome', tag.label, tag, OUTCOME_TAG_ICONS[tag.kind], {
				none: tag.kind === 'noOutcome',
				crit: tag.kind === 'crit',
			})}
		{/each}
		{@render tagNote(
			'outcome',
			outcomeTags.map((tag) => ({ id: tag.label, tooltip: tag.tooltip })),
		)}
	</div>
{/if}

{#if keptAmount}
	<div class="nimble-roll-changes__history nimble-roll-changes__history--bonus">
		<i class="fa-solid fa-rotate" aria-hidden="true"></i>
		<p class="nimble-roll-changes__text">
			{localize('NIMBLE.heldChange.keptOnCard', {
				label: keptAmount.label,
				amount: String(keptAmount.amount),
			})}
		</p>
	</div>
{/if}

{#each primaryDieBonuses as bonus, index (index)}
	{@const value = signed(bonus.value)}
	{@const sentence =
		bonusNotAdded ?? localize('NIMBLE.chat.primaryDieBonus.text', { label: bonus.label, value })}
	<div
		class="nimble-roll-changes__history nimble-roll-changes__history--bonus"
		data-tooltip={sentence}
	>
		<i
			class="fa-solid {bonusNotAdded
				? 'fa-ban'
				: bonus.value > 0
					? 'fa-arrow-up'
					: 'fa-arrow-down'}"
			aria-hidden="true"
		></i>
		<p class="nimble-roll-changes__text">
			<span aria-hidden="true">{bonus.label}</span>
			<span class="nimble-roll-changes__spoken">{sentence}</span>
		</p>
		{@render tagButton(
			`bonus-${index}`,
			'bonus',
			{
				label: localize(
					bonusNotAdded
						? 'NIMBLE.chat.primaryDieBonus.notAdded'
						: 'NIMBLE.chat.primaryDieBonus.tag',
					{ value },
				),
				tooltip: sentence,
			},
			bonusNotAdded ? 'fa-ban' : 'fa-dice-d6',
			{ none: !!bonusNotAdded },
		)}
	</div>
	{#if tagNotes.openTag(`bonus-${index}`)}
		<p class="nimble-roll-changes__note nimble-roll-changes__note--line">{sentence}</p>
	{/if}
{/each}

{#each legacyLines as line (line.id)}
	<div class="nimble-roll-changes__history">
		<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
		<p>{line.text}</p>
	</div>
{/each}

{#snippet historyLine(line: RerollHistoryLine, key: number | 'pending', keptOld: boolean)}
	<div class="nimble-roll-changes__reroll">
		<div
			class="nimble-roll-changes__history nimble-roll-changes__history--reroll"
			data-tooltip={line.text}
		>
			<i class={REACTION_VERB_ICONS[line.use]} aria-hidden="true"></i>
			<div class="nimble-roll-changes__text">
				<p>
					<span aria-hidden="true">{line.title}</span>
					<span class="nimble-roll-changes__spoken">{line.text}</span>
				</p>
				{#if line.detail}
					<p class="nimble-roll-changes__detail">{line.detail}</p>
				{/if}
			</div>
			{#if line.dice}
				<span class="nimble-roll-changes__dice">
					<DieFace {...line.dice.previous} discarded={!keptOld} />
					{#if line.change}
						<span class="nimble-roll-changes__change" aria-hidden="true">
							<span class="nimble-roll-changes__change-label">{line.change.arrow}</span>
							<i class="nimble-roll-changes__arrow fa-solid fa-arrow-right"></i>
						</span>
					{:else}
						<i class="nimble-roll-changes__arrow fa-solid fa-arrow-right" aria-hidden="true"></i>
					{/if}
					<DieFace {...line.dice.next} discarded={keptOld} />
				</span>
			{/if}
		</div>

		{#if line.tags.length > 0}
			<div class="nimble-roll-changes__tags">
				{#each line.tags as tag (tag.kind + tag.label)}
					{@render tagButton(
						`line-${key}`,
						tag.kind + tag.label,
						tag,
						tag.off ? 'fa-hand' : TAG_ICONS[tag.kind],
						{
							off: tag.off,
							none: tag.kind === 'noAction',
							crit: tag.kind === 'crit' && !tag.off,
						},
					)}
				{/each}
				{@render tagNote(
					`line-${key}`,
					line.tags.map((tag) => ({ id: tag.kind + tag.label, tooltip: tag.tooltip })),
				)}
				{#if line.offNote}
					<p class="nimble-roll-changes__note">
						<i class="fa-solid fa-hand" aria-hidden="true"></i>
						{line.offNote}
					</p>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#each lines as line, index (index)}
	{@render historyLine(line, index, line.keptOld)}
{/each}

{#if pendingKeep && pendingLine}
	{@render historyLine(pendingLine, 'pending', false)}

	{#if keepChoice.canKeep}
		<div class="nimble-keep-choice">
			{#each [['old', pendingKeep.old], ['new', pendingKeep.new]] as const as [choice, roll] (choice)}
				<button
					class="nimble-button nimble-keep-choice__button"
					type="button"
					disabled={keepChoice.keepHeld}
					onclick={() => keepChoice.keep(choice)}
				>
					<span class="nimble-keep-choice__total">{keepChoice.keepLabel(roll)}</span>
					{#if roll.outcome}
						<span class="nimble-keep-choice__outcome">
							{localize(`NIMBLE.chat.incomingReactions.keepOutcomes.${roll.outcome}`)}
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{:else}
		<div class="nimble-roll-changes__history nimble-roll-changes__history--waiting">
			<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
			<p>
				{localize('NIMBLE.chat.incomingReactions.keepWaiting', {
					name: keepChoice.chooser?.name ?? '',
					old: String(pendingKeep.old.total),
					new: String(pendingKeep.new.total),
				})}
			</p>
		</div>
	{/if}
{/if}

<style lang="scss">
	.nimble-roll-changes {
		&__history {
			display: flex;
			align-items: flex-start;
			gap: 0.375rem;
			font-size: var(--nimble-sm-text);

			> i {
				margin-top: 0.125rem;
			}

			p {
				margin: 0;
				text-wrap: pretty;
			}
		}

		&__reroll {
			display: flex;
			flex-direction: column;
		}

		&__spoken {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}

		// Aligned with the feature name: past the icon and its gap.
		&__tags {
			display: flex;
			flex-wrap: wrap;
			align-items: flex-start;
			gap: 0.25rem;
			margin: 0.3125rem 0 0.25rem calc(1em + 0.25rem);

			&--outcome {
				margin: 0;
			}
		}

		&__note {
			flex-basis: 100%;
			margin: 0.125rem 0 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.35;
			color: var(--nimble-medium-text-color);
			text-wrap: pretty;

			i {
				margin-right: 0.25rem;
				font-size: 0.75em;
			}

			&--line {
				margin-left: calc(1em + 0.375rem);
			}
		}

		&__history--reroll {
			--nimble-die-face-size: 1.375rem;

			align-items: center;
			gap: 0.25rem;

			> i {
				align-self: flex-start;
			}
		}

		&__text {
			flex: 1;
			min-width: 0;
		}

		&__dice {
			display: flex;
			flex: none;
			align-items: center;
			gap: 0.25rem;
		}

		&__arrow {
			font-size: 0.625rem;
			color: var(--nimble-medium-text-color);
		}

		&__change {
			display: flex;
			flex-direction: column;
			align-items: center;
			line-height: 1;
		}

		&__change-label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		&__detail {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__history--bonus {
			align-items: center;

			> i {
				margin-top: 0;
			}
		}

		&__history--waiting {
			align-items: center;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);

			> i {
				margin-top: 0;
			}
		}
	}

	.nimble-reroll-tag {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 0.3125rem;
		width: auto;
		height: auto;
		min-height: 0;
		margin: 0;
		padding: 0.0625rem 0.375rem;
		border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
		border-radius: 3px;
		background: color-mix(in srgb, currentColor 8%, transparent);
		box-shadow: none;
		font-family: inherit;
		font-size: var(--nimble-xs-text);
		font-weight: 500;
		line-height: 1.4;
		white-space: nowrap;
		color: var(--nimble-card-text-color);
		cursor: pointer;

		> i {
			font-size: 0.75em;
			opacity: 0.7;
		}

		&:hover {
			background: color-mix(in srgb, currentColor 14%, transparent);
		}

		&[aria-expanded='true'] {
			border-color: color-mix(in srgb, currentColor 45%, transparent);
			background: color-mix(in srgb, currentColor 18%, transparent);
		}

		&:focus {
			outline: none;
		}

		&:focus-visible {
			outline: 2px solid var(--nimble-card-text-color);
			outline-offset: 1px;
		}

		&--crit > i {
			color: var(--nimble-crit-cause-color);
			opacity: 1;
		}

		&--off,
		&--none {
			border-style: dashed;
			background: transparent;
			color: var(--nimble-medium-text-color);
		}
	}

	.nimble-keep-choice {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.375rem;

		&__button {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0;
			min-height: 2.25rem;
			padding: 0.25rem 0.5rem;
			line-height: 1.15;
		}

		&__total {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
		}

		&__outcome {
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
		}
	}
</style>
