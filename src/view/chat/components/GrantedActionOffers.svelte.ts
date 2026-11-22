import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { OfferCard } from '#types/movement.js';
import { afterMoveLineShown, afterMoveWarning } from '#utils/combat/afterMoveLine.js';
import {
	type GrantedActionOffer,
	type GrantedActionOfferUsedWith,
	requestGrantedActionOfferUse,
} from '#utils/combat/grantedActionOffers.js';
import {
	grantedAttackGroups,
	grantedAttackTargets,
	makeGrantedAttack,
} from '#utils/combat/grantedAttack.js';
import { type GrantedAttackKind, grantedAttackKind } from '#utils/combat/grantedAttackKind.js';
import { attackOriginName } from '#utils/damage/attackOrigin.js';
import { UNARMED_STRIKE } from '#utils/damage/weaponAttack.js';
import { type DocLink, docLink, type LinkedPart, linkedParts } from '#utils/documents/docLink.ts';
import localize from '#utils/localize.js';
import { speakerTokenUuid } from '#utils/movement/movementOffers.js';
import { isMovementOffersAutomationEnabled } from '../../../settings/automationSettings.js';

type OfferRecipientActor = Parameters<typeof grantedAttackGroups>[0] & {
	id?: string | null;
	name?: string;
	isOwner?: boolean;
};

type ChoiceGroups = ReturnType<typeof grantedAttackGroups>;

/** The lines of one kind on a card: one heading, one warning at most, a block per creature. */
export interface GrantedAttackSection {
	kind: GrantedAttackKind;
	heading: string;
	warning: LinkedPart[] | null;
	offers: GrantedActionOffer[];
}

const TEXT = 'NIMBLE.chat.grantedActionOffers';

function getRecipientActor(offer: GrantedActionOffer): OfferRecipientActor | null {
	return (fromUuidSync(offer.targetActorUuid as Parameters<typeof fromUuidSync>[0]) ??
		null) as OfferRecipientActor | null;
}

function recipientName(offer: GrantedActionOffer): string {
	return getRecipientActor(offer)?.name ?? '';
}

function canUseOffer(offer: GrantedActionOffer): boolean {
	if (game.user?.isGM) return true;
	return !!getRecipientActor(offer)?.isOwner;
}

/** The granting feature: its real name when it resolves, else the rule's label. */
function sourceOf(offer: GrantedActionOffer): DocLink {
	return docLink(attackOriginName(offer.sourceItemUuid) || offer.label, offer.sourceItemUuid);
}

/** The creature that used the feature gets a line only when the rule includes it; it is not a target. */
function isActivator(offer: GrantedActionOffer): boolean {
	return (
		!!offer.sourceItemUuid && offer.sourceItemUuid.startsWith(`${offer.targetActorUuid}.Item.`)
	);
}

function listOf(names: string[]): string {
	return new Intl.ListFormat(game.i18n?.lang ?? 'en', {
		style: 'long',
		type: 'conjunction',
	}).format(names);
}

/** A rule whose lines went to more targeted creatures than it reaches. The lines all stay usable. */
function overCountWarning(offers: GrantedActionOffer[]): LinkedPart[] | null {
	const over = offers.find(
		(offer) => offer.targetCount > 0 && offer.targetedCount > offer.targetCount,
	);
	if (!over) return null;
	const names = offers
		.filter(
			(offer) =>
				offer.sourceItemUuid === over.sourceItemUuid &&
				offer.ruleId === over.ruleId &&
				!isActivator(offer),
		)
		.map(recipientName)
		.filter(Boolean);
	return linkedParts(`${TEXT}.${over.targetCount === 1 ? 'targetCountOne' : 'targetCountMany'}`, {
		source: sourceOf(over),
		count: String(over.targetCount),
		names: listOf(names),
	});
}

/** The lines grouped by what they spend, in the order the card has them. */
function sectionsOf(
	offers: GrantedActionOffer[],
	shown: (offer: GrantedActionOffer) => boolean,
	lineWarning: (offer: GrantedActionOffer) => string | null = () => null,
): GrantedAttackSection[] {
	const sections = new Map<GrantedAttackKind, GrantedAttackSection>();
	for (const offer of offers) {
		if (!shown(offer)) continue;
		const kind = grantedAttackKind(offer);
		const section = sections.get(kind) ?? {
			kind,
			heading: localize(`${TEXT}.headings.${kind}`),
			warning: null,
			offers: [],
		};
		section.offers.push(offer);
		sections.set(kind, section);
	}
	for (const section of sections.values()) {
		if (!section.offers.some((offer) => !offer.used)) continue;
		const ofKind = offers.filter((offer) => grantedAttackKind(offer) === section.kind);
		const moveWarning = section.offers
			.filter((offer) => !offer.used)
			.map(lineWarning)
			.find((warning) => warning !== null);
		section.warning = overCountWarning(ofKind) ?? (moveWarning ? [moveWarning] : null);
	}
	return [...sections.values()];
}

/** The line's extra targets as one sentence, or null when the attack has one target. */
function sharedTargetsNote(offer: GrantedActionOffer): string | null {
	const actor = getRecipientActor(offer);
	if (!actor) return null;
	const { count, extras } = grantedAttackTargets(actor, offer);
	if (count < 2) return null;
	const parts = extras.map((extra) =>
		extra.reach > 0
			? localize(`${TEXT}.extraTarget`, {
					count: String(extra.count),
					reach: String(extra.reach),
					source: extra.source,
				})
			: localize(`${TEXT}.extraTargetAnyReach`, {
					count: String(extra.count),
					source: extra.source,
				}),
	);
	return localize(`${TEXT}.sharedTargets`, {
		count: String(count),
		extras: parts.join(', '),
	});
}

/** Plain text for the creature's name line: the feature, then what the table checks itself. */
function getOfferTooltip(offer: GrantedActionOffer): string {
	const source = sourceOf(offer).name;
	const details = [offer.condition, sharedTargetsNote(offer)].filter(Boolean).join(' ');
	if (!details) return source;
	return source ? localize(`${TEXT}.tooltip`, { source, details }) : details;
}

/** "<Name> attacked with <weapon>.", or "<Name> attacked." for a card from before the weapon was kept. */
function getUsedLine(offer: GrantedActionOffer): LinkedPart[] {
	const name = recipientName(offer);
	const weapon = offer.usedWith;
	return weapon?.name
		? linkedParts(`${TEXT}.usedWith`, { name, weapon: docLink(weapon.name, weapon.uuid) })
		: linkedParts(`${TEXT}.used`, { name });
}

function getChoiceGroups(offer: GrantedActionOffer): ChoiceGroups {
	const actor = getRecipientActor(offer);
	return actor ? grantedAttackGroups(actor, offer) : [];
}

/** The weapon, Unarmed Strike or cantrip of a choice, as the card keeps it. */
function usedWithOf(groups: ChoiceGroups, choice: string): GrantedActionOfferUsedWith | null {
	const found = groups.flatMap((group) => group.choices).find((each) => each.value === choice);
	if (!found) return null;
	return { name: found.name, uuid: choice === UNARMED_STRIKE ? '' : choice };
}

/** The attack lines of a chat card: per section the lines the user can use, and the used ones. */
export function createGrantedActionOffersState(getMessage: () => NimbleChatMessage) {
	let busy = $state(false);
	const chosenByOffer = $state<Record<string, string>>({});
	let tokenVersion = $state(0);

	$effect(() => {
		const hookId = Hooks.on('updateToken', (document: TokenDocument) => {
			tokenVersion += 1;
			document.object?.movementAnimationPromise?.finally(() => {
				tokenVersion += 1;
			});
		});
		return () => {
			Hooks.off('updateToken', hookId);
		};
	});

	const offers = $derived(
		(getMessage()?.reactive?.system as { grantedActionOffers?: GrantedActionOffer[] })
			?.grantedActionOffers ?? [],
	);
	const moveEnded = $derived(
		afterMoveLineShown(
			{
				speaker: (getMessage() as unknown as OfferCard)?.speaker,
				system: getMessage()?.reactive?.system as OfferCard['system'],
			},
			isMovementOffersAutomationEnabled(),
		),
	);
	const sections = $derived(
		sectionsOf(
			offers,
			(offer) => offer.used || (canUseOffer(offer) && (!offer.afterMove || moveEnded)),
			getAfterMoveWarning,
		),
	);

	/** The warning of a line whose check failed where its user stopped, or null. */
	function getAfterMoveWarning(offer: GrantedActionOffer): string | null {
		if (!offer.afterMove) return null;
		void tokenVersion;
		const uuid = speakerTokenUuid(getMessage() as unknown as OfferCard);
		const mover = uuid
			? fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false })
			: null;
		return afterMoveWarning(
			offer,
			(mover ?? null) as Parameters<typeof afterMoveWarning>[1],
			getRecipientActor(offer)?.name ?? '',
		);
	}

	function getChosen(offer: GrantedActionOffer, groups: ChoiceGroups): string {
		return chosenByOffer[offer.id] ?? groups[0]?.choices[0]?.value ?? '';
	}

	function choose(offer: GrantedActionOffer, choice: string): void {
		chosenByOffer[offer.id] = choice;
	}

	/**
	 * Make the attack of the line, then mark the line used with what it attacked with. A cancelled
	 * attack leaves the line available.
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
				usedWith: usedWithOf(getChoiceGroups(offer), choice),
			});
		} finally {
			busy = false;
		}
	}

	return {
		get busy() {
			return busy;
		},
		get sections() {
			return sections;
		},
		recipientName,
		getChoiceGroups,
		getChosen,
		choose,
		getOfferTooltip,
		getUsedLine,
		attackWith,
	};
}
