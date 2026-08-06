import { getTargetName } from '#utils/targeting.ts';

interface GrantedOfferTargetingParams {
	/** Actor the offer belongs to, i.e. the one about to activate an item. */
	recipientActorId: string;
	/** Every token the accepting user currently has targeted. */
	targetedTokens: (Token | null | undefined)[];
}

interface GrantedOfferTargeting {
	/**
	 * Whether one of the current targets is the recipient themself. Offers are
	 * created by targeting the recipient, so this is what a user sees when they
	 * accept without retargeting. It is reported, never prevented.
	 */
	targetsRecipient: boolean;
	/** Display names of the current targets, in the order given. */
	targetNames: string[];
	/**
	 * The subset of `targetNames` belonging to the recipient, and the subset that
	 * does not. Split because the two read differently: only the recipient is the
	 * one taking the action, so a sentence saying so must name them alone.
	 */
	recipientTargetNames: string[];
	otherTargetNames: string[];
}

/**
 * Describe what a granted-activation offer is currently pointed at.
 *
 * An activation reads its targets from the accepting user's live target set, so
 * an offer taken straight after it is granted fires at whoever was targeted to
 * create it. That is easy to miss, so the accept UI names the current targets
 * and calls out the case where they include the recipient.
 *
 * This only describes the situation. Who is a legal target is a table decision,
 * not something to enforce here: attacking yourself or an ally is allowed, and
 * having no target at all is a normal activation.
 */
export function resolveGrantedOfferTargeting({
	recipientActorId,
	targetedTokens,
}: GrantedOfferTargetingParams): GrantedOfferTargeting {
	const tokens = targetedTokens.filter((token): token is Token => !!token);

	const recipientTargetNames: string[] = [];
	const otherTargetNames: string[] = [];
	const targetNames: string[] = [];

	for (const token of tokens) {
		const name = getTargetName(token);
		targetNames.push(name);

		const isRecipient = !!recipientActorId && token.actor?.id === recipientActorId;
		if (isRecipient) recipientTargetNames.push(name);
		else otherTargetNames.push(name);
	}

	return {
		targetsRecipient: recipientTargetNames.length > 0,
		targetNames,
		recipientTargetNames,
		otherTargetNames,
	};
}

export type { GrantedOfferTargeting };
