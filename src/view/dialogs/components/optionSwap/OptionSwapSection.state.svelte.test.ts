import { render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';

import type { OptionSwapChange, ResolvedOptionSwapOffer } from '#types/optionSwap.d.ts';
import {
	createDiePool,
	createMagePool,
	createOffer,
	createPool,
	createSpanningPool,
	createSwapSource,
} from '../../../../../tests/fixtures/optionSwap.ts';
import OptionSwapSectionStateHarness from '../../../../../tests/harnesses/OptionSwapSectionStateHarness.svelte';
import type {
	OptionSwapSectionState,
	OptionSwapSkillData,
} from './OptionSwapSection.state.svelte.ts';

const DEFAULT_SKILLS: Record<string, OptionSwapSkillData> = {
	arcana: { points: 2, mod: 4 },
	stealth: { points: 0, mod: 1 },
};

function setup(
	offer: ResolvedOptionSwapOffer | null,
	skills: Record<string, OptionSwapSkillData> = DEFAULT_SKILLS,
) {
	let section!: OptionSwapSectionState;
	const latest = {
		selections: new Map<string, string[]>(),
		skillPoints: new Map<string, number>(),
	};

	const props = {
		offer,
		skills,
		onChange: (change: OptionSwapChange) => {
			latest.selections = change.selections;
			latest.skillPoints = change.skillPoints;
		},
	};

	const { getByTestId } = render(OptionSwapSectionStateHarness, {
		props: {
			props,
			onready: (ready: OptionSwapSectionState) => {
				section = ready;
			},
		},
	});

	const read = () => JSON.parse(getByTestId('snapshot').textContent ?? '{}');
	const pool = (poolKey: string) =>
		read()
			.cards.flatMap((card: { pools: { poolKey: string }[] }) => card.pools)
			.find((view: { poolKey: string }) => view.poolKey === poolKey);

	const act = (change: () => void) => {
		change();
		flushSync();
	};

	return { act, latest, pool, read, section: section as OptionSwapSectionState };
}

describe('the option swap section state', () => {
	describe('grouping the offer by the feature that makes it', () => {
		it('puts a pool under the source whose rule names its group', () => {
			const { read } = setup(
				createOffer({
					pools: [createPool(), createDiePool()],
					sources: [
						createSwapSource({
							name: 'Wrath & Ruin',
							uuid: 'Actor.hero.Item.wrath',
							coversAllGroups: false,
							groups: ['savage-arsenal'],
						}),
						createSwapSource({
							name: 'Fit for Any Battlefield',
							uuid: 'Actor.hero.Item.fit',
							coversAllGroups: false,
							groups: ['combat-tactics'],
						}),
					],
				}),
			);

			const cards = read().cards;
			expect(cards.map((card: { name: string }) => card.name)).toEqual([
				'Wrath & Ruin',
				'Fit for Any Battlefield',
			]);
			expect(cards[0].pools.map((view: { poolKey: string }) => view.poolKey)).toEqual([
				'savage-arsenal',
			]);
			expect(cards[1].pools.map((view: { poolKey: string }) => view.poolKey)).toEqual([
				'combat-tactics',
			]);
		});

		it('gives a pool no rule names to the source that covers every group', () => {
			const { read } = setup(
				createOffer({
					pools: [createDiePool()],
					sources: [
						createSwapSource({
							name: 'Narrow',
							uuid: 'Actor.hero.Item.narrow',
							coversAllGroups: false,
							groups: ['orders'],
						}),
						createSwapSource({ name: 'Wrath & Ruin', uuid: 'Actor.hero.Item.wrath' }),
					],
				}),
			);

			// A source that ends up with nothing to show is left off the screen.
			expect(read().cards.map((card: { name: string }) => card.name)).toEqual(['Wrath & Ruin']);
		});

		it('gives a pool no source claims to the first source that offers a swap', () => {
			const { read } = setup(
				createOffer({
					pools: [createPool()],
					sources: [
						createSwapSource({
							name: 'Narrow',
							uuid: 'Actor.hero.Item.narrow',
							coversAllGroups: false,
							groups: ['orders'],
						}),
					],
				}),
			);

			const cards = read().cards;
			expect(cards).toHaveLength(1);
			expect(cards[0].pools.map((view: { poolKey: string }) => view.poolKey)).toEqual([
				'savage-arsenal',
			]);
		});

		it('names what each card offers', () => {
			const { read } = setup(
				createOffer({
					skillPoints: 1,
					pools: [createPool()],
					sources: [
						createSwapSource({ name: 'Wrath & Ruin', uuid: 'Actor.hero.Item.wrath' }),
						createSwapSource({
							name: 'Jack of All Trades',
							uuid: 'Actor.hero.Item.jack',
							coversAllGroups: false,
							skillPoints: 1,
						}),
					],
				}),
			);

			const cards = read().cards;
			expect(cards[0].subtitle).toBe('Swap class options');
			expect(cards[0].offersSkillMove).toBe(false);
			expect(cards[1].subtitle).toBe('Move a skill point');
			expect(cards[1].offersSkillMove).toBe(true);
		});

		it('names both when one feature offers a swap and a move', () => {
			const { read } = setup(
				createOffer({
					skillPoints: 1,
					pools: [createPool()],
					sources: [createSwapSource({ skillPoints: 1 })],
				}),
			);

			expect(read().cards[0].subtitle).toBe('Swap class options, move a skill point');
		});
	});

	describe('the places of a pool', () => {
		it('opens on the picks the sheet holds, then one empty place per ungranted pick', () => {
			const { pool } = setup(
				createOffer({ pools: [createPool({ heldCount: 1, grantedCount: 3 })] }),
			);

			expect(pool('savage-arsenal').places).toEqual(['Cleave', null, null]);
			expect(pool('savage-arsenal').countText).toBe('1 / 3');
			expect(pool('savage-arsenal').hasEmptyPlace).toBe(true);
		});

		it('gives a pick held twice a place each', () => {
			const { pool } = setup(createOffer({ pools: [createDiePool()] }));

			expect(pool('combat-tactics').places).toEqual([
				'Heavy Strike',
				'+1 Max Combat Die',
				'+1 Max Combat Die',
			]);
			expect(pool('combat-tactics').hasEmptyPlace).toBe(false);
		});

		it('empties the place a pick is given up from and leaves it where it was', () => {
			const { act, pool, section } = setup(createOffer({ pools: [createDiePool()] }));

			act(() => section.giveUpPlace('combat-tactics', 0));

			expect(pool('combat-tactics').places).toEqual([
				null,
				'+1 Max Combat Die',
				'+1 Max Combat Die',
			]);
			// The pick lands among the choices, so the pool unfolds to show it.
			expect(pool('combat-tactics').showsChoices).toBe(true);
		});

		it('fills the first empty place', () => {
			const { act, latest, pool, section } = setup(createOffer({ pools: [createDiePool()] }));
			const sweepingStrike = createDiePool().candidates[1];

			act(() => section.giveUpPlace('combat-tactics', 0));
			act(() => section.fillPlace('combat-tactics', sweepingStrike));

			expect(pool('combat-tactics').places).toEqual([
				'Sweeping Strike',
				'+1 Max Combat Die',
				'+1 Max Combat Die',
			]);
			expect(latest.selections.get('combat-tactics')).toEqual([
				'Item.sweeping-strike',
				'Item.max-die',
				'Item.max-die',
			]);
		});

		it('takes no pick while every place is full', () => {
			const { act, pool, section } = setup(createOffer({ pools: [createDiePool()] }));
			const sweepingStrike = createDiePool().candidates[1];

			act(() => section.fillPlace('combat-tactics', sweepingStrike));

			expect(pool('combat-tactics').places).toEqual([
				'Heavy Strike',
				'+1 Max Combat Die',
				'+1 Max Combat Die',
			]);
		});

		it('opens a pool the sheet holds nothing of on its choices', () => {
			const { pool } = setup(
				createOffer({
					pools: [createPool({ heldCount: 0, grantedCount: 2, heldIdsByUuid: new Map() })],
				}),
			);

			expect(pool('savage-arsenal').places).toEqual([null, null]);
			expect(pool('savage-arsenal').showsChoices).toBe(true);
		});
	});

	describe('the choices under a pool', () => {
		it('offers the members with no pick, by name', () => {
			const { pool } = setup(createOffer());

			expect(pool('savage-arsenal').choices).toEqual(['Rampage', 'Savage Leap']);
			expect(pool('savage-arsenal').choicesToggleLabel).toBe('Show 2 other options');
		});

		it('keeps offering a member the grant allows more than once', () => {
			const { pool } = setup(createOffer({ pools: [createDiePool()] }));

			expect(pool('combat-tactics').choices).toEqual(['+1 Max Combat Die', 'Sweeping Strike']);
		});

		it('names the fold for a single choice', () => {
			const { pool } = setup(
				createOffer({
					pools: [
						createPool({
							heldCount: 2,
							heldIdsByUuid: new Map([
								['Item.cleave', ['abc123']],
								['Item.rampage', ['def456']],
							]),
						}),
					],
				}),
			);

			expect(pool('savage-arsenal').choicesToggleLabel).toBe('Show 1 other option');
		});
	});

	describe('the lists inside a pool', () => {
		const listsOf = (view: { lists: { key: string; heading: string }[] }) => view.lists;

		it('splits a pool that spans two groups, in the order the pool names them', () => {
			const { pool } = setup(createOffer({ pools: [createSpanningPool()] }));

			expect(listsOf(pool('field-command')).map((list) => [list.key, list.heading])).toMatchObject([
				['field-signals', 'Field Signals'],
				['field-maneuvers', 'Field Maneuvers'],
				['Item.extra-die', '+1 Extra Die'],
			]);
		});

		it('puts each member under the list it comes from', () => {
			const { pool } = setup(createOffer({ pools: [createSpanningPool()] }));

			expect(listsOf(pool('field-command'))).toMatchObject([
				{ places: ['Rally'], choices: ['Regroup'] },
				{ places: ['Feint'], choices: ['Flank'] },
				{ places: ['+1 Extra Die'], choices: ['+1 Extra Die'] },
			]);
		});

		it('gives a pool drawing on one group a single list', () => {
			const { pool } = setup(createOffer());

			expect(listsOf(pool('savage-arsenal'))).toMatchObject([
				{ key: 'savage-arsenal', places: ['Cleave'], choices: ['Rampage', 'Savage Leap'] },
			]);
		});

		it('gives an option granted outright a list of its own, headed by its name', () => {
			const { pool } = setup(
				createOffer({
					pools: [
						createSpanningPool({
							poolGroups: ['field-signals'],
							heldCount: 2,
							grantedCount: 2,
							heldIdsByUuid: new Map([
								['Item.rally', ['s2']],
								['Item.extra-die', ['x6']],
							]),
						}),
					],
				}),
			);

			// The two maneuvers are outside the groups the pool names, so each stands alone.
			expect(listsOf(pool('field-command')).map((list) => list.heading)).toEqual([
				'Field Signals',
				'+1 Extra Die',
				'Feint',
				'Flank',
			]);
		});

		it('keeps an emptied place under its old list, and moves it when it is filled again', () => {
			const { act, pool, section } = setup(createOffer({ pools: [createSpanningPool()] }));
			const flank = createSpanningPool().candidates[3];

			act(() => section.giveUpPlace('field-command', 0));

			expect(listsOf(pool('field-command'))).toMatchObject([
				{ key: 'field-signals', places: [null] },
				{ key: 'field-maneuvers', places: ['Feint'] },
				{ key: 'Item.extra-die', places: ['+1 Extra Die'] },
			]);

			act(() => section.fillPlace('field-command', flank));

			expect(listsOf(pool('field-command'))).toMatchObject([
				{ key: 'field-signals', places: [] },
				{ key: 'field-maneuvers', places: ['Flank', 'Feint'] },
				{ key: 'Item.extra-die', places: ['+1 Extra Die'] },
			]);
		});

		it('puts a place the sheet never held under the first list', () => {
			const { pool } = setup(
				createOffer({
					pools: [
						createSpanningPool({
							heldCount: 1,
							grantedCount: 3,
							heldIdsByUuid: new Map([['Item.feint', ['m4']]]),
						}),
					],
				}),
			);

			expect(listsOf(pool('field-command'))).toMatchObject([
				{ key: 'field-signals', places: [null, null] },
				{ key: 'field-maneuvers', places: ['Feint'] },
				{ key: 'Item.extra-die', places: [] },
			]);
		});
	});

	describe('the holdings sentence', () => {
		it('says nothing while the sheet holds what the levels grant', () => {
			const { pool } = setup(createOffer());

			expect(pool('savage-arsenal').holdingsText).toBe('');
		});

		it('says what is missing when the sheet holds fewer', () => {
			const { pool } = setup(
				createOffer({ pools: [createPool({ heldCount: 1, grantedCount: 3 })] }),
			);

			expect(pool('savage-arsenal').holdingsText).toBe(
				'Your level gives you 3 options. You have 1. Choose 2 more.',
			);
		});

		it('says so when the sheet holds more', () => {
			const { pool } = setup(
				createOffer({
					pools: [
						createDiePool({
							heldCount: 4,
							grantedCount: 3,
							heldIdsByUuid: new Map([
								['Item.heavy-strike', ['t4']],
								['Item.sweeping-strike', ['s1']],
								['Item.max-die', ['d6', 'd8']],
							]),
						}),
					],
				}),
			);

			expect(pool('combat-tactics').holdingsText).toBe(
				'Your level gives you 3 options. You have 4.',
			);
		});

		it('counts one option as one', () => {
			const { pool } = setup(
				createOffer({
					pools: [createPool({ heldCount: 0, grantedCount: 1, heldIdsByUuid: new Map() })],
				}),
			);

			expect(pool('savage-arsenal').holdingsText).toBe(
				'Your level gives you 1 option. You have 0. Choose 1 more.',
			);
		});
	});

	describe('the status line', () => {
		it('says nothing while the selection matches the holdings', () => {
			const { pool } = setup(createOffer());

			expect(pool('savage-arsenal').status.changed).toBe(false);
			expect(pool('savage-arsenal').status.text).toBe('');
		});

		it('names what is given up and what is taken', () => {
			const { act, pool, section } = setup(createOffer());
			const rampage = createPool().candidates[1];

			act(() => section.giveUpPlace('savage-arsenal', 0));
			act(() => section.fillPlace('savage-arsenal', rampage));

			expect(pool('savage-arsenal').status).toMatchObject({
				changed: true,
				isReady: true,
				text: 'You give up Cleave and take Rampage.',
			});
		});

		it('names only what is taken when a shortfall is filled', () => {
			const { act, pool, section } = setup(
				createOffer({ pools: [createPool({ heldCount: 1, grantedCount: 2 })] }),
			);
			const rampage = createPool().candidates[1];

			act(() => section.fillPlace('savage-arsenal', rampage));

			expect(pool('savage-arsenal').status).toMatchObject({
				isReady: true,
				text: 'You take Rampage.',
			});
		});

		it('counts the copies of a pick given up', () => {
			const dice = createDiePool({
				heldCount: 2,
				heldIdsByUuid: new Map([['Item.max-die', ['d6', 'd8']]]),
			});
			const { act, pool, section } = setup(createOffer({ pools: [dice] }));
			const [heavyStrike, sweepingStrike] = dice.candidates;

			act(() => section.giveUpPlace('combat-tactics', 0));
			act(() => section.giveUpPlace('combat-tactics', 1));
			act(() => section.fillPlace('combat-tactics', heavyStrike));
			act(() => section.fillPlace('combat-tactics', sweepingStrike));

			expect(pool('combat-tactics').status.text).toBe(
				'You give up +1 Max Combat Die x2 and take Heavy Strike, Sweeping Strike.',
			);
		});

		it('says what is missing while the selection is incomplete', () => {
			const { act, pool, section } = setup(createOffer());

			act(() => section.giveUpPlace('savage-arsenal', 0));

			expect(pool('savage-arsenal').status).toMatchObject({
				changed: true,
				isReady: false,
				text: 'Choose 1 more option to complete the swap.',
			});
		});

		it('counts more than one missing pick', () => {
			const { act, pool, section } = setup(createOffer({ pools: [createDiePool()] }));

			act(() => section.giveUpPlace('combat-tactics', 0));
			act(() => section.giveUpPlace('combat-tactics', 1));

			expect(pool('combat-tactics').status.text).toBe(
				'Choose 2 more options to complete the swap.',
			);
		});
	});

	describe('the pending flag', () => {
		it('is off while nothing would change', () => {
			const { read } = setup(createOffer());

			expect(read().isPending).toBe(false);
		});

		it('is off while the selection is incomplete, and on once it is ready', () => {
			const { act, read, section } = setup(createOffer());
			const rampage = createPool().candidates[1];

			act(() => section.giveUpPlace('savage-arsenal', 0));
			expect(read().isPending).toBe(false);

			act(() => section.fillPlace('savage-arsenal', rampage));
			expect(read().isPending).toBe(true);
		});

		it('is on once a skill move is balanced', () => {
			const { act, read, section } = setup(createOffer({ pools: [], skillPoints: 1 }));

			act(() => section.setSkillFrom('arcana'));
			expect(read().isPending).toBe(false);
			expect(read().hasUnplacedPoint).toBe(true);

			act(() => section.setSkillTo('stealth'));
			expect(read().isPending).toBe(true);
		});
	});

	describe('the skill move', () => {
		it('offers a point only from a skill that holds one whose bonus stays at +0', () => {
			const { section } = setup(createOffer({ pools: [], skillPoints: 1 }), {
				arcana: { points: 2, mod: 4 },
				// A negative ability holds the bonus under the points, so the point cannot leave.
				might: { points: 1, mod: 0 },
				stealth: { points: 0, mod: 1 },
			});

			expect(section.skillRows.map((row) => [row.name, row.canGive, row.canTake])).toEqual([
				['Arcana', true, true],
				['Might', false, true],
				['Stealth', false, true],
			]);
		});

		it('refuses to push a skill past the highest bonus', () => {
			const { section } = setup(createOffer({ pools: [], skillPoints: 1 }), {
				arcana: { points: 2, mod: 4 },
				stealth: { points: 4, mod: 12 },
			});

			expect(section.skillRows.find((row) => row.key === 'stealth')?.canTake).toBe(false);
		});

		it('moves one point and says what it does', () => {
			const { act, latest, read, section } = setup(createOffer({ pools: [], skillPoints: 1 }));

			act(() => section.setSkillFrom('arcana'));
			expect(latest.skillPoints.size).toBe(0);

			act(() => section.setSkillTo('stealth'));

			expect(Object.fromEntries(latest.skillPoints)).toEqual({ arcana: 1, stealth: 1 });
			expect(read().skillMoveSummary).toBe('Arcana 4 → 3, Stealth 1 → 2');
		});

		it('drops a target the giver was moved onto', () => {
			const { act, latest, section } = setup(createOffer({ pools: [], skillPoints: 1 }));

			act(() => section.setSkillFrom('arcana'));
			act(() => section.setSkillTo('stealth'));
			act(() => section.setSkillFrom('stealth'));

			expect(latest.skillPoints.size).toBe(0);
		});
	});

	describe('a card whose own feature is given up', () => {
		const givenUpOffer = (heldId: string, skillPoints = 0) =>
			createOffer({
				skillPoints,
				pools: [createMagePool(heldId)],
				sources: [
					createSwapSource({
						name: 'Focus',
						uuid: 'Actor.hero.Item.i-focus',
						skillPoints,
					}),
				],
			});

		it('switches the card off when the selection lets its item go', () => {
			const { act, read, section } = setup(givenUpOffer('i-focus'));

			expect(read().cards[0].isGivenUp).toBe(false);

			act(() => section.giveUpPlace('mage-options', 0));

			expect(read().cards[0].isGivenUp).toBe(true);
			expect(read().cards[0].givenUpText).toBe(
				'You are giving up Focus. What it lets you do is not offered on this rest.',
			);
		});

		it('matches the item the rule sits on, not a pick of the same name', () => {
			const { act, read, section } = setup(givenUpOffer('another-focus'));

			act(() => section.giveUpPlace('mage-options', 0));

			expect(read().cards[0].isGivenUp).toBe(false);
		});

		it('puts a point it moved back where it was', () => {
			const { act, latest, read, section } = setup(givenUpOffer('i-focus', 1));

			act(() => section.setSkillFrom('arcana'));
			act(() => section.setSkillTo('stealth'));
			expect(Object.fromEntries(latest.skillPoints)).toEqual({ arcana: 1, stealth: 1 });

			act(() => section.giveUpPlace('mage-options', 0));

			expect(read().skillMoveSummary).toBe('');
			expect(latest.skillPoints.size).toBe(0);
		});
	});
});
