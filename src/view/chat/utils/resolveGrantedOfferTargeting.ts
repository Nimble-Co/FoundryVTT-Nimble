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
	/** Display names of the current targets, in target order. */
	targetNames: string[];
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

	return {
		targetsRecipient:
			!!recipientActorId && tokens.some((token) => token.actor?.id === recipientActorId),
		targetNames: tokens.map((token) => getTargetName(token)),
	};
}

export type { GrantedOfferTargeting };
