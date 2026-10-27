<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { RerollHistoryProps } from '#types/components/RerollHistory.d.ts';

	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import DieFace from '../../components/DieFace.svelte';
	import { createRerollHistoryState } from './RerollHistory.svelte.ts';
	type RerollHistoryLine = RerollHistoryProps['lines'][number];

	const TAG_ICONS: Record<RerollHistoryLine['tags'][number]['kind'], string> = {
		automatic: 'fa-gear',
		rollMode: 'fa-dice',
		extraDamage: 'fa-burst',
		action: 'fa-bolt',
		noAction: 'fa-ban',
		tempHp: 'fa-shield-heart',
	};

	let { legacyLines, lines, pendingKeep, pendingLine, held }: RerollHistoryProps = $props();

	const keepChoice = createRerollHistoryState(
		getContext<NimbleChatMessage>('messageDocument'),
		() => ({ pendingKeep, held }),
	);
</script>

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
			<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
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
					<i class="nimble-roll-changes__arrow fa-solid fa-arrow-right" aria-hidden="true"></i>
					<DieFace {...line.dice.next} discarded={keptOld} />
				</span>
			{/if}
		</div>

		{#if line.tags.length > 0}
			<div class="nimble-roll-changes__tags">
				{#each line.tags as tag (tag.kind + tag.label)}
					{#if tag.kind === 'tempHp' && line.tempHpNote}
						{@const open = keepChoice.tempHpNoteOpen(key)}
						<button
							type="button"
							class="nimble-reroll-tag nimble-reroll-tag--button"
							class:nimble-reroll-tag--off={tag.off}
							aria-expanded={open}
							aria-label={`${tag.label}. ${localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpToggle')}`}
							data-tooltip={tag.tooltip}
							onclick={() => keepChoice.toggleTempHpNote(key)}
						>
							<i class="fa-solid {tag.off ? 'fa-hand' : TAG_ICONS[tag.kind]}" aria-hidden="true"
							></i>
							<span>{tag.label}</span>
							<i class="fa-solid {open ? 'fa-angle-up' : 'fa-angle-down'}" aria-hidden="true"></i>
						</button>
					{:else}
						<span
							class="nimble-reroll-tag"
							class:nimble-reroll-tag--off={tag.off}
							class:nimble-reroll-tag--none={tag.kind === 'noAction'}
							data-tooltip={tag.tooltip}
						>
							<i class="fa-solid {tag.off ? 'fa-hand' : TAG_ICONS[tag.kind]}" aria-hidden="true"
							></i>
							<span>{tag.label}</span>
						</span>
					{/if}
				{/each}
				{#if line.tempHpNote && keepChoice.tempHpNoteOpen(key)}
					<p class="nimble-roll-changes__note">{line.tempHpNote}</p>
				{/if}
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

		&__detail {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
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

		> i {
			font-size: 0.75em;
			opacity: 0.7;
		}

		&--button {
			cursor: pointer;

			&:focus-visible {
				outline: 2px solid var(--nimble-card-text-color);
				outline-offset: 1px;
			}
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
