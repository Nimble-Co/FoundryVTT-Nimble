import { getTargetName } from '#utils/targeting.ts';

/**
 * `blocked` means the recipient is standing in their own line of fire: one of
 * the currently targeted tokens belongs to them. That is what happens when the
 * offer is accepted without retargeting, because the target that produced the
 * offer is still selected. `ready` covers everything else, including no target
 * at all, which stays a legal activation.
 */
type GrantedOfferTargetingStatus = 'blocked' | 'ready';

interface GrantedOfferTargetingParams {
	/** Actor the offer belongs to, i.e. the one about to activate an item. */
	recipientActorId: string;
	/** Every token the accepting user currently has targeted. */
	targetedTokens: (Token | null | undefined)[];
}

interface GrantedOfferTargeting {
	status: GrantedOfferTargetingStatus;
	/** Display names of the current targets, in target order. */
	targetNames: string[];
}

/**
 * Decide whether a granted-activation offer can be accepted with the targets the
 * user currently has selected.
 *
 * Activation reads targets from the user's live target set, so an offer accepted
 * straight after it is granted would fire at whoever was targeted to create it.
 * This gate catches the case where that stale target is the recipient themself.
 */
export function resolveGrantedOfferTargeting({
	recipientActorId,
	targetedTokens,
}: GrantedOfferTargetingParams): GrantedOfferTargeting {
	const tokens = targetedTokens.filter((token): token is Token => !!token);
	const targetNames = tokens.map((token) => getTargetName(token));

	const targetsRecipient =
		!!recipientActorId && tokens.some((token) => token.actor?.id === recipientActorId);

	return { status: targetsRecipient ? 'blocked' : 'ready', targetNames };
}

export type { GrantedOfferTargeting, GrantedOfferTargetingStatus };
