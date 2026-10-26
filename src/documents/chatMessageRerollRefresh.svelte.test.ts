import { flushSync } from 'svelte';
import { NimbleChatMessage } from './chatMessage.js';

/** A card with a waiting reroll follows the pools and Wounds of the actor who can use it. */

type Listener = (document: unknown, change: unknown, options: unknown) => void;

const ROLLER = 'Actor.roller';

function rerollEntry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'entry-1',
		kind: 'reroll',
		source: 'rule',
		actorUuid: ROLLER,
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller',
		label: 'Clear Head',
		ruleId: 'reroll-1',
		itemUuid: 'Item.head',
		used: false,
		...overrides,
	};
}

function createSaveCard(entries: Record<string, unknown>[]) {
	return new NimbleChatMessage({
		type: 'savingThrow',
		system: { saveKey: 'will', rollMode: 0, actorUuid: ROLLER, incomingReactions: entries },
	} as unknown as ChatMessage.CreateData);
}

/** Read the message in an effect, and count how often the effect runs. */
function watch(message: NimbleChatMessage) {
	const runs = { count: 0 };
	const stop = $effect.root(() => {
		$effect(() => {
			void message.reactive;
			runs.count += 1;
		});
	});
	flushSync();
	return { runs, stop };
}

function listener(hook: string): Listener {
	const calls = (Hooks.on as unknown as { mock: { calls: [string, Listener][] } }).mock.calls;
	const found = calls.findLast(([name]) => name === hook);
	if (!found) throw new Error(`No ${hook} listener`);
	return found[1];
}

describe('a card with a waiting reroll', () => {
	it('renders again when the actor who can use it changes', () => {
		const { runs, stop } = watch(createSaveCard([rerollEntry()]));

		listener('updateActor')({ uuid: ROLLER }, {}, {});
		flushSync();

		expect(runs.count).toBe(2);
		stop();
	});

	it('renders again when an item of that actor changes, as its charge pools live there', () => {
		const { runs, stop } = watch(createSaveCard([rerollEntry()]));

		listener('updateItem')({ parent: { uuid: ROLLER } }, {}, {});
		flushSync();

		expect(runs.count).toBe(2);
		stop();
	});

	it('does not render again for another actor, or once the reroll was used', () => {
		const { runs, stop } = watch(createSaveCard([rerollEntry({ used: true })]));

		listener('updateActor')({ uuid: ROLLER }, {}, {});
		listener('updateActor')({ uuid: 'Actor.other' }, {}, {});
		listener('updateItem')({ parent: { uuid: 'Actor.other' } }, {}, {});
		flushSync();

		expect(runs.count).toBe(1);
		stop();
	});
});
