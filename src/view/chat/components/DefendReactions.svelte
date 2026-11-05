<!--
@component
The heroes who can react to an attack: one button each that opens the Defend
window. A Defend made shows on the hero's target row.
-->
<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import { getContext } from 'svelte';
	import {
		attackCannotBeDefended,
		canReactFor,
		defendReactors,
	} from '#utils/defend/defendReactors.js';
	import { openDefendWindow } from '#utils/defend/openDefendWindow.js';
	import localize from '#utils/localize.js';

	const TEXT = 'NIMBLE.chat.defend';
	const messageDocument = getContext<NimbleChatMessage>('messageDocument');
	const isGM = game.user?.isGM === true;

	const card = $derived({
		system: messageDocument?.reactive?.system,
		speaker: messageDocument?.speaker,
	});
	const COMBAT_HOOKS = [
		'createCombat',
		'updateCombat',
		'deleteCombat',
		'renderCombatTracker',
	] as const;
	let combatVersion = $state(0);
	$effect(() => {
		const ids = COMBAT_HOOKS.map((hook) => [hook, Hooks.on(hook, () => combatVersion++)] as const);
		return () => {
			for (const [hook, id] of ids) Hooks.off(hook, id);
		};
	});
	const inCombat = $derived(combatVersion >= 0 && game.combat?.started === true);
	const blocked = $derived(attackCannotBeDefended(card));
	const reactors = $derived(
		blocked ? [] : defendReactors(card).filter((reactor) => canReactFor(reactor.actor)),
	);
	const open = $derived(inCombat ? reactors.filter((reactor) => !reactor.defend) : []);
	const solo = $derived(!isGM && open.length === 1);

	let opening = $state<string | null>(null);

	async function react(actor: Actor.Implementation) {
		const key = actor.uuid ?? '';
		if (opening === key) return;
		opening = key;
		try {
			await openDefendWindow(messageDocument, actor);
		} finally {
			if (opening === key) opening = null;
		}
	}
</script>

{#if blocked && isGM}
	<p class="nimble-defend__blocked">{localize(`${TEXT}.cannotBeDefended`)}</p>
{:else if open.length > 0}
	<section class="nimble-defend" aria-label={localize(`${TEXT}.reactions`)}>
		{#if !solo}
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize(`${TEXT}.reactions`)}
			</h3>
		{/if}
		<div class="nimble-defend__heroes" class:nimble-defend__heroes--solo={solo}>
			{#each open as reactor (reactor.actor.uuid)}
				<button
					class="nimble-defend__hero"
					type="button"
					disabled={opening === reactor.actor.uuid}
					onclick={() => react(reactor.actor)}
				>
					<img src={reactor.actor.img || 'icons/svg/mystery-man.svg'} alt="" />
					<span>
						{solo
							? localize(`${TEXT}.reactAs`, { name: reactor.actor.name ?? '' })
							: reactor.actor.name}
					</span>
				</button>
			{/each}
		</div>
	</section>
{/if}

<style lang="scss">
	.nimble-defend {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem 0.5rem 0;

		&__blocked {
			margin: 0;
			padding: 0.375rem 0.5rem 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			color: var(--nimble-medium-text-color);
		}

		&__heroes {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
			gap: 0.375rem;

			&--solo {
				grid-template-columns: 1fr;
			}
		}

		&__hero {
			display: flex;
			align-items: center;
			margin: 0;
			font-family: var(--nimble-primary-font);
			line-height: 1;
			color: inherit;
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			box-shadow: none;
			cursor: pointer;
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease;

			&:hover:not(:disabled) {
				color: inherit;
				background: color-mix(in srgb, currentColor 8%, transparent);
			}

			&:focus-visible {
				outline: 2px solid currentColor;
				outline-offset: 1px;
			}

			&:disabled {
				cursor: default;
				opacity: 0.6;
			}
		}

		&__hero {
			justify-content: center;
			gap: 0.5rem;
			width: 100%;
			height: 2.25rem;
			padding: 0 0.625rem;
			font-size: var(--nimble-sm-text);
			font-weight: 900;
			border-radius: 4px;

			img {
				flex: none;
				width: 1.375rem;
				height: 1.375rem;
				border: 0;
				border-radius: 50%;
				object-fit: cover;
			}

			span {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		}
	}
</style>
