import { describe, expect, it } from 'vitest';
import { SYSTEM_ID } from '#system';
import { newMoment } from '#utils/lastsUntil/momentForm.js';
import { subjectsFor } from '../EffectLastsUntilTabState.svelte.ts';

const heldDies = { ...newMoment('event'), who: 'held' as const, event: 'die' as const };

describe('subjectsFor', () => {
	it('omits the creature they hold until the effect can name one', () => {
		expect(subjectsFor({})).not.toContain('held');
		expect(subjectsFor({ statuses: new Set(['prone']) })).not.toContain('held');
	});

	it('offers them when the effect already names the creature', () => {
		expect(subjectsFor({ flags: { [SYSTEM_ID]: { heldActorUuid: 'Actor.hero' } } })).toContain(
			'held',
		);
	});

	it('offers them when a moment already uses them, so the row keeps its word', () => {
		expect(subjectsFor({ system: { lastsUntil: [heldDies] } })).toContain('held');
	});

	it('offers them when a condition on the effect ends when they die', () => {
		expect(subjectsFor({ statuses: new Set(['latched']) })).toContain('held');
	});
});
