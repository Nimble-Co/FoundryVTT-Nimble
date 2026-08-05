<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import applyConditionToActor from '#utils/applyConditionToActor.ts';
	import localize from '#utils/localize.ts';

	const { node } = $props();

	const { conditions, conditionDescriptions } = CONFIG.NIMBLE;

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	function getConditionTooltip(condition: string) {
		const label = conditions[condition];
		const description = conditionDescriptions[condition];

		const tooltipHeader = `
        <header class="nimble-tooltip__enricher-header">
          <h3 class="nimble-tooltip__enricher-heading">${label}</h3>
          <span class="nimble-tooltip__tag">Condition</span>
        </header>
   `;

		const tooltipFooter = `<footer><small>${localize('NIMBLE.chat.applyConditionHint')}</small></footer>`;

		return [tooltipHeader, description, tooltipFooter].join('');
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
	async function resolveTargetActors() {
		const targetUuids: string[] = messageDocument?.reactive?.system?.targets ?? [];
		const tokenDocuments = await Promise.all(targetUuids.map((uuid) => fromUuid(uuid)));

		return tokenDocuments
			.map((tokenDocument) => (tokenDocument as { actor?: unknown } | null)?.actor)
			.filter(Boolean);
	}

	async function applyConditionToCardTargets() {
		const [targetActors, { sourceItem, sourceActor }] = await Promise.all([
			resolveTargetActors(),
			resolveConditionSource(),
		]);

		for (const targetActor of targetActors) {
			await applyConditionToActor(targetActor as never, node.condition, {
				sourceItem,
				sourceActor,
			});
		}
	}

	const tooltip = $derived(getConditionTooltip(node.condition));
</script>

<button
	class="nimble-button"
	data-button-variant="enricher"
	data-enricher-type="condition"
	type="button"
	aria-label={localize('NIMBLE.chat.applyConditionToTargets')}
	data-tooltip={tooltip}
	data-tooltip-class="nimble-tooltip nimble-tooltip--rules"
	data-tooltip-position="UP"
	onclick={applyConditionToCardTargets}
>
	<i class="nimble-button__icon fa-solid fa-biohazard"></i>

	{conditions[node.condition]}
</button>
