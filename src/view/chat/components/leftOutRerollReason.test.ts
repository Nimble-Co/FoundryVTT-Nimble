import { describe, expect, it } from 'vitest';
import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';
import { leftOutRerollReason } from './leftOutRerollReason.ts';

const { FRIENDLY, NEUTRAL } = { FRIENDLY: 1, NEUTRAL: 0 };

function entry(leftOut: IncomingReactionEntry['leftOut']): IncomingReactionEntry {
	return {
		id: 'pip',
		kind: 'reroll',
		source: 'rule',
		actorUuid: 'Actor.pip',
		tokenUuid: 'Scene.s.Token.pip',
		targetTokenUuid: null,
		side: 'ally',
		label: '',
		ruleId: 'r',
		itemUuid: 'Item.optimistic',
		used: false,
		leftOut,
	};
}

describe('leftOutRerollReason', () => {
	it('names both dispositions for an ally left out by disposition', () => {
		const reason = leftOutRerollReason(entry({ reason: 'disposition' }), {
			allyName: 'Pip',
			allyDisposition: NEUTRAL,
			rollerDisposition: FRIENDLY,
		});
		expect(reason).toBe("Pip's token is TOKEN.DISPOSITION.NEUTRAL, not TOKEN.DISPOSITION.FRIENDLY");
	});

	it('says only that the token is not an ally when a token is gone', () => {
		const reason = leftOutRerollReason(entry({ reason: 'disposition' }), {
			allyName: 'Pip',
			allyDisposition: NEUTRAL,
			rollerDisposition: null,
		});
		expect(reason).toBe("Pip's token is not marked as an ally");
	});

	it('gives the spaces and the Reach for an ally out of Reach', () => {
		const reason = leftOutRerollReason(entry({ reason: 'reach', spaces: 7, reach: 6 }), {
			allyName: 'Pip',
			allyDisposition: FRIENDLY,
			rollerDisposition: FRIENDLY,
		});
		expect(reason).toBe('7 spaces away, Reach 6');
	});
});
