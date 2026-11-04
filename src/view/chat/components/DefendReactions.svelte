<!--
@component
The heroes who can react to an attack: one button each that opens the Defend
window, and a line for each Defend made, with the GM's armor toggle and Undo.
-->
<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import { getContext } from 'svelte';
	import { damageAppliedTo } from '#utils/defend/defendRecords.js';
	import {
		attackCannotBeDefended,
		canReactFor,
		defendReactors,
	} from '#utils/defend/defendReactors.js';
	import { setDefendArmorApplies, undoDefend } from '#utils/defend/defendRequests.js';
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
	const done = $derived(reactors.filter((reactor) => reactor.defend));
	const applied = $derived(damageAppliedTo(card.system));

	let busy = $state(false);

	async function react(actor: Actor.Implementation) {
		if (busy) return;
		busy = true;
		try {
			await openDefendWindow(messageDocument, actor);
		} finally {
			busy = false;
		}
	}

	function damageLine(tokenUuid: string, armor: number): string {
		const before = messageDocument.previewDamageFor(tokenUuid, 0);
		const after = messageDocument.previewDamageFor(tokenUuid, armor);
		if (before === null || after === null) return '';
		return localize(`${TEXT}.damageChange`, { before: String(before), after: String(after) });
	}
</script>

{#if blocked && isGM}
	<p class="nimble-defend__blocked">{localize(`${TEXT}.cannotBeDefended`)}</p>
{:else if open.length > 0 || done.length > 0}
	<section class="nimble-defend" aria-label={localize(`${TEXT}.reactions`)}>
		{#each done as reactor (reactor.actor.uuid)}
			{@const defend = reactor.defend!}
			<div class="nimble-defend__line">
				<p class="nimble-defend__text">
					<span class="nimble-defend__name">{reactor.actor.name}</span>
					<span class="nimble-defend__verb">
						{defend.label
							? localize(`${TEXT}.defendedWith`, { feature: defend.label })
							: localize(`${TEXT}.defended`)}
					</span>
					<span class="nimble-defend__detail">
						{damageLine(defend.tokenUuid, defend.armorApplies ? defend.armor : 0)}
					</span>
				</p>
				{#if isGM && !applied.has(defend.tokenUuid)}
					<button
						class="nimble-defend__chip"
						type="button"
						aria-pressed={defend.armorApplies}
						data-tooltip={localize(`${TEXT}.armorAppliesHint`)}
						onclick={() =>
							setDefendArmorApplies(messageDocument.id ?? '', defend.id, !defend.armorApplies)}
					>
						<i class="fa-solid {defend.armorApplies ? 'fa-check' : 'fa-xmark'}" aria-hidden="true"
						></i>
						{localize(`${TEXT}.armorApplies`)}
					</button>
					<button
						class="nimble-defend__chip"
						type="button"
						data-tooltip={localize(`${TEXT}.undoHint`)}
						onclick={() => undoDefend(messageDocument.id ?? '', defend.id)}
					>
						{localize(`${TEXT}.undo`)}
					</button>
				{/if}
			</div>
		{/each}

		{#if open.length > 0}
			{#if isGM || open.length > 1}
				<p class="nimble-defend__label">{localize(`${TEXT}.reactions`)}</p>
			{/if}
			<div
				class="nimble-defend__heroes"
				class:nimble-defend__heroes--one={!isGM && open.length === 1}
			>
				{#each open as reactor (reactor.actor.uuid)}
					<button
						class="nimble-defend__hero"
						type="button"
						disabled={busy}
						onclick={() => react(reactor.actor)}
					>
						<img src={reactor.actor.img || 'icons/svg/mystery-man.svg'} alt="" />
						<span>
							{!isGM && open.length === 1
								? localize(`${TEXT}.reactAs`, { name: reactor.actor.name ?? '' })
								: reactor.actor.name}
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style lang="scss">
	.nimble-defend {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.375rem 0.5rem 0;

		&__blocked {
			margin: 0;
			padding: 0.375rem 0.5rem 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			color: var(--nimble-medium-text-color);
		}

		&__label {
			margin: 0.125rem 0 0;
			font-size: var(--nimble-xs-text);
			font-weight: 800;
			color: var(--nimble-medium-text-color);
		}

		&__heroes {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
			gap: 0.25rem;

			&--one {
				grid-template-columns: 1fr;
			}
		}

		&__hero,
		&__chip {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			width: 100%;
			height: auto;
			min-height: 32px;
			margin: 0;
			padding: 0 0.375rem;
			font-family: var(--nimble-primary-font);
			font-size: var(--nimble-sm-text);
			font-weight: 800;
			line-height: 1.1;
			color: inherit;
			background: transparent;
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 3px;
			box-shadow: none;
			cursor: pointer;

			&:hover:not(:disabled) {
				color: inherit;
				background: var(--nimble-card-border-color);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-dark-text-color);
				outline-offset: 1px;
			}

			&:disabled {
				cursor: default;
				opacity: 0.6;
			}
		}

		&__hero img {
			flex: none;
			width: 20px;
			height: 20px;
			border: 0;
			border-radius: 50%;
			object-fit: cover;
		}

		&__hero span {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&__heroes--one &__hero {
			justify-content: center;
		}

		&__line {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			min-height: 28px;
		}

		&__text {
			flex: 1;
			min-width: 0;
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.2;
		}

		&__name {
			font-weight: 800;
		}

		&__verb,
		&__detail {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__chip {
			flex: none;
			width: auto;
			min-height: 22px;
			padding: 0 0.5rem;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			border-radius: 999px;

			&[aria-pressed='true'] {
				background: var(--nimble-card-border-color);
			}
		}
	}
</style>
