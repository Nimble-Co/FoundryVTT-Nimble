<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { ConditionTargetActor } from '#utils/applyConditionToActor.ts';

	import { getContext } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import applyConditionToActor from '#utils/applyConditionToActor.ts';
	import localize from '#utils/localize.ts';

	const { node } = $props();

	const { conditions, conditionDescriptions } = CONFIG.NIMBLE;

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	/**
	 * Application is GM-only, like the card's damage buttons: the card's targets
	 * are rarely tokens a player owns, so a player's click could only be refused
	 * on permissions. Players keep the chip and its description tooltip.
	 */
	const canApplyConditions = game.user?.isGM ?? false;

	function getConditionTooltip(condition: string) {
		// Names can be free-form GM text and the header is built as an HTML string, so an unescaped
		// `<` would swallow the rest of the tooltip. Descriptions arrive from CONFIG already escaped.
		const label = foundry.utils.escapeHTML(conditions[condition]);
		const description = conditionDescriptions[condition];

		const tooltipHeader = `
        <header class="nimble-tooltip__enricher-header">
          <h3 class="nimble-tooltip__enricher-heading">${label}</h3>
          <span class="nimble-tooltip__tag">Condition</span>
        </header>
   `;

		const parts = [tooltipHeader, description];

		if (canApplyConditions) {
			parts.push(`<footer><small>${localize('NIMBLE.chat.applyConditionHint')}</small></footer>`);
		}

		return parts.join('');
	}

	/**
	 * The creature and the feature that produced this card. The item is what the
	 * conditions readout would rather name; the actor is the fallback for a card
	 * whose item no longer exists.
	 */
	async function resolveConditionSource() {
		const flags = messageDocument?.flags?.[SYSTEM_ID] as
			| { itemUuid?: string; actorId?: string }
			| undefined;

		const sourceItem = flags?.itemUuid
			? ((await fromUuid(flags.itemUuid)) as { uuid?: string; actor?: { uuid?: string } } | null)
			: null;
		const sourceActor =
			sourceItem?.actor ?? (flags?.actorId ? (game.actors?.get(flags.actorId) ?? null) : null);

		return { sourceItem, sourceActor };
	}

	/**
	 * The card's own targets, not whatever the clicking user happens to have
	 * selected on the canvas.
	 */
	async function resolveTargetActors(): Promise<ConditionTargetActor[]> {
		const targetUuids: string[] = messageDocument?.reactive?.system?.targets ?? [];
		const tokenDocuments = await Promise.all(targetUuids.map((uuid) => fromUuid(uuid)));

		return tokenDocuments
			.map((tokenDocument) => (tokenDocument as { actor?: ConditionTargetActor } | null)?.actor)
			.filter((actor): actor is ConditionTargetActor => Boolean(actor));
	}

	async function applyConditionToCardTargets() {
		const [targetActors, { sourceItem, sourceActor }] = await Promise.all([
			resolveTargetActors(),
			resolveConditionSource(),
		]);

		// Each target is applied independently, so one being refused cannot stop
		// the conditions the remaining targets can still take.
		const results = await Promise.allSettled(
			targetActors.map((targetActor) =>
				applyConditionToActor(targetActor, node.condition, { sourceItem, sourceActor }),
			),
		);

		for (const result of results) {
			if (result.status === 'rejected') console.error(result.reason);
		}
	}

	const tooltip = $derived(getConditionTooltip(node.condition));
</script>

<button
	class="nimble-button"
	data-button-variant="enricher"
	data-enricher-type="condition"
	type="button"
	aria-label={canApplyConditions ? localize('NIMBLE.chat.applyConditionToTargets') : undefined}
	data-tooltip={tooltip}
	data-tooltip-class="nimble-tooltip nimble-tooltip--rules"
	data-tooltip-position="UP"
	onclick={canApplyConditions ? applyConditionToCardTargets : undefined}
>
	<i class="nimble-button__icon fa-solid fa-biohazard"></i>

	{conditions[node.condition]}
</button>
