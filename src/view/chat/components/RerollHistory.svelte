<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { RerollHistoryProps } from '#types/components/RerollHistory.d.ts';

	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import DieFace from '../../components/DieFace.svelte';
	import { createRerollHistoryState } from './RerollHistory.svelte.ts';

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

{#each lines as line, index (index)}
	<div class="nimble-roll-changes__history nimble-roll-changes__history--reroll">
		<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
		<div class="nimble-roll-changes__text">
			<p>{line.text}</p>
			{#if line.detail}
				<p class="nimble-roll-changes__detail">{line.detail}</p>
			{/if}
		</div>
		{#if line.dice}
			<span class="nimble-roll-changes__dice">
				<DieFace {...line.dice.previous} discarded={!line.keptOld} />
				<i class="nimble-roll-changes__arrow fa-solid fa-arrow-right" aria-hidden="true"></i>
				<DieFace {...line.dice.next} discarded={line.keptOld} />
			</span>
		{/if}
	</div>
{/each}

{#if pendingKeep && pendingLine}
	<div class="nimble-roll-changes__history nimble-roll-changes__history--reroll">
		<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
		<div class="nimble-roll-changes__text">
			<p>{pendingLine.text}</p>
			{#if pendingLine.detail}
				<p class="nimble-roll-changes__detail">{pendingLine.detail}</p>
			{/if}
		</div>
		{#if pendingLine.dice}
			<span class="nimble-roll-changes__dice">
				<DieFace {...pendingLine.dice.previous} discarded />
				<i class="nimble-roll-changes__arrow fa-solid fa-arrow-right" aria-hidden="true"></i>
				<DieFace {...pendingLine.dice.next} />
			</span>
		{/if}
	</div>

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

		&__history--reroll {
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
