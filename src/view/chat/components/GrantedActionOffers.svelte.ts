import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import {
	type GrantedActionOffer,
	requestGrantedActionOfferUse,
} from '#utils/combat/grantedActionOffers.js';
import {
	grantedAttackGroups,
	grantedAttackTargets,
	makeGrantedAttack,
} from '#utils/combat/grantedAttack.js';
import localize from '#utils/localize.js';
import { resolveGrantedOfferTargeting } from '../utils/resolveGrantedOfferTargeting.ts';
import { useTargetChanges } from '../utils/useTargetChanges.svelte.ts';

type OfferRecipientActor = Parameters<typeof grantedAttackGroups>[0] & {
	id?: string | null;
	name?: string;
	isOwner?: boolean;
};

type ChoiceGroups = ReturnType<typeof grantedAttackGroups>;

function getRecipientActor(offer: GrantedActionOffer): OfferRecipientActor | null {
	return (fromUuidSync(offer.targetActorUuid as Parameters<typeof fromUuidSync>[0]) ??
		null) as OfferRecipientActor | null;
}

function canUseOffer(offer: GrantedActionOffer): boolean {
	if (game.user?.isGM) return true;
	const actor = getRecipientActor(offer);
	return !!actor?.isOwner;
}

function getOfferHeading(offer: GrantedActionOffer): string {
	if (offer.weaponKind === 'unarmed') return localize('NIMBLE.ui.heroicActions.unarmedStrike');
	return localize(`NIMBLE.chat.grantedActionOffers.${offer.activationType}`);
}

function getOfferLabel(offer: GrantedActionOffer): string {
	const heading = getOfferHeading(offer);
	const name = getRecipientActor(offer)?.name ?? '';
	return offer.label
		? localize('NIMBLE.chat.grantedActionOffers.offerLabel', {
				name,
				heading,
				source: offer.label,
			})
		: localize('NIMBLE.chat.grantedActionOffers.offerLabelNoSource', { name, heading });
}

function getOfferTooltip(offer: GrantedActionOffer): string | null {
	if (!offer.sourceItemUuid) return null;
	const item = fromUuidSync(offer.sourceItemUuid as Parameters<typeof fromUuidSync>[0]) as {
		name?: string;
	} | null;
	return item?.name ?? null;
}

function getUsedAttribution(offer: GrantedActionOffer): string {
	const actorName = getRecipientActor(offer)?.name ?? '';
	return offer.label
		? localize('NIMBLE.chat.grantedActionOffers.usedByVia', {
				name: actorName,
				label: offer.label,
			})
		: localize('NIMBLE.chat.grantedActionOffers.usedBy', { name: actorName });
}

function getChoiceGroups(offer: GrantedActionOffer): ChoiceGroups {
	const actor = getRecipientActor(offer);
	return actor ? grantedAttackGroups(actor, offer) : [];
}

/** The line's extra targets as one sentence, or null when the attack has one target. */
function getSharedTargetsNote(offer: GrantedActionOffer): string | null {
	const actor = getRecipientActor(offer);
	if (!actor) return null;
	const { count, extras } = grantedAttackTargets(actor, offer);
	if (count < 2) return null;
	const parts = extras.map((extra) =>
		extra.reach > 0
			? localize('NIMBLE.chat.grantedActionOffers.extraTarget', {
					count: String(extra.count),
					reach: String(extra.reach),
					source: extra.source,
				})
			: localize('NIMBLE.chat.grantedActionOffers.extraTargetAnyReach', {
					count: String(extra.count),
					source: extra.source,
				}),
	);
	return localize('NIMBLE.chat.grantedActionOffers.sharedTargets', {
		count: String(count),
		extras: parts.join(', '),
	});
}

/**
 * One warning for each rule whose lines went to more targeted creatures than it reaches.
 * The lines all stay usable: who takes the attack is the table's call.
 */
function getTargetWarnings(offers: GrantedActionOffer[]): string[] {
	const warnings = new Map<string, string>();
	for (const offer of offers) {
		const key = `${offer.sourceItemUuid}:${offer.ruleId}`;
		if (warnings.has(key) || !(offer.targetCount > 0)) continue;
		if (!(offer.targetedCount > offer.targetCount)) continue;
		const wording = offer.targetCount === 1 ? 'targetCountOne' : 'targetCountMany';
		warnings.set(
			key,
			localize(`NIMBLE.chat.grantedActionOffers.${wording}`, {
				source: offer.label,
				count: String(offer.targetCount),
				targeted: String(offer.targetedCount),
			}),
		);
	}
	return [...warnings.values()];
}

/** The attack lines of a chat card: the pending lines the user can use, and the used ones. */
export function createGrantedActionOffersState(getMessage: () => NimbleChatMessage) {
	const targetChanges = useTargetChanges();
	let busy = $state(false);
	const chosenByOffer = $state<Record<string, string>>({});

	const offers = $derived(
		(getMessage()?.reactive?.system as { grantedActionOffers?: GrantedActionOffer[] })
			?.grantedActionOffers ?? [],
	);
	const pendingOffers = $derived(offers.filter((offer) => !offer.used && canUseOffer(offer)));
	const usedOffers = $derived(offers.filter((offer) => offer.used));
	const targetWarnings = $derived(getTargetWarnings(offers));

	function getChosen(offer: GrantedActionOffer, groups: ChoiceGroups): string {
		return chosenByOffer[offer.id] ?? groups[0]?.choices[0]?.value ?? '';
	}

	function choose(offer: GrantedActionOffer, choice: string): void {
		chosenByOffer[offer.id] = choice;
	}

	/**
	 * What the line is currently pointed at. Reading the target changes re-runs this the
	 * moment the user retargets, so the display never sits on a stale answer.
	 */
	function getOfferTargeting(offer: GrantedActionOffer) {
		void targetChanges.version;

		const recipientActorId = getRecipientActor(offer)?.id ?? '';
		// Read the target set directly so the names stay in the order the user
		// targeted them. Partitioning it here instead would hoist one group.
		const targetedTokens = Array.from(game.user?.targets ?? []);

		return resolveGrantedOfferTargeting({ recipientActorId, targetedTokens });
	}

	/**
	 * Make the attack of the line, then mark the line used. A cancelled attack
	 * leaves the line available.
	 */
	async function attackWith(offer: GrantedActionOffer, choice: string) {
		if (busy || !choice) return;
		busy = true;

		try {
			const actor = getRecipientActor(offer);
			if (!actor || !(await makeGrantedAttack(actor, offer, choice))) return;

			await requestGrantedActionOfferUse({
				messageId: getMessage().id ?? '',
				offerId: offer.id,
			});
		} finally {
			busy = false;
		}
	}

	return {
		get busy() {
			return busy;
		},
		get pendingOffers() {
			return pendingOffers;
		},
		get usedOffers() {
			return usedOffers;
		},
		get targetWarnings() {
			return targetWarnings;
		},
		getChoiceGroups,
		getChosen,
		choose,
		getOfferTargeting,
		getOfferLabel,
		getOfferTooltip,
		getSharedTargetsNote,
		getUsedAttribution,
		attackWith,
	};
}
