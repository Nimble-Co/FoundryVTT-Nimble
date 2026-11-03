import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import ChaosButtonTestHarness from './ChaosButton.testHarness.svelte';

let automation = false;
let heroRules: object[] = [];

const force = { type: 'tableRoll', table: 'chaos', when: 'lessManaOrCrit', invokesChaos: true };

function card({ isCritical = false, flags = {} as Record<string, unknown> } = {}) {
	const message = {
		id: 'card',
		isAuthor: true,
		speaker: {},
		system: { isCritical },
		flags: { [SYSTEM_ID]: flags },
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

const button = () => screen.queryByRole('button');

beforeEach(() => {
	automation = false;
	heroRules = [];
	vi.stubGlobal('ChatMessage', { getSpeakerActor: () => ({ isOwner: true, rules: heroRules }) });
	(game as unknown as { settings: unknown }).settings = {
		get: (_scope: string, key: string) =>
			key === 'automation.applyRuleEffects' ? automation : undefined,
	};
});

afterEach(() => vi.unstubAllGlobals());

describe('the Chaos button', () => {
	it('shows on the card of an item that invokes Chaos when it is used', () => {
		render(ChaosButtonTestHarness, {
			props: { messageDocument: card({ flags: { chaosTicked: true } }) },
		});

		expect(button()).not.toBeNull();
	});

	it('shows on a crit of a hero who can invoke Chaos', () => {
		heroRules = [force];

		render(ChaosButtonTestHarness, { props: { messageDocument: card({ isCritical: true }) } });

		expect(button()).not.toBeNull();
	});

	it('does not show on a crit of a hero who cannot', () => {
		render(ChaosButtonTestHarness, { props: { messageDocument: card({ isCritical: true }) } });

		expect(button()).toBeNull();
	});

	it('does not show after the roll', () => {
		render(ChaosButtonTestHarness, {
			props: { messageDocument: card({ flags: { chaosTicked: true, chaosInvoked: true } }) },
		});
		expect(button()).toBeNull();
	});

	it('does not show with Feature Effects on', () => {
		automation = true;

		render(ChaosButtonTestHarness, {
			props: { messageDocument: card({ flags: { chaosTicked: true } }) },
		});

		expect(button()).toBeNull();
	});
});
