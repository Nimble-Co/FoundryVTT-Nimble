import { describe, expect, it } from 'vitest';
import { checkState, copyGroups, toggleCopies } from '../copyList.js';
import type { PlannedCopy } from '../planMigration.js';

const TITLES = new Map([
	[87, { title: 'Held changes become Held Roll rules', kind: 'structure' as const }],
	[89, { title: 'Timed effects content', kind: 'content' as const }],
]);

function copy(overrides: Partial<PlannedCopy>): PlannedCopy {
	return {
		uuid: 'Actor.wren.Item.mark',
		rootUuid: 'Actor.wren',
		documentName: 'Item',
		name: "Hunter's Mark",
		img: 'mark.webp',
		type: 'spell',
		sourceId: 'Compendium.nimble.nimble-spells.Item.mark',
		matchedByName: false,
		versions: [89],
		excludable: true,
		holder: { kind: 'actor', actorName: 'Wren', actorUuid: 'Actor.wren' },
		...overrides,
	};
}

const wrenMark = copy({});
const bramMark = copy({
	uuid: 'Actor.bram.Item.mark',
	rootUuid: 'Actor.bram',
	holder: { kind: 'actor', actorName: 'Bram', actorUuid: 'Actor.bram' },
});
const sidebarMark = copy({ uuid: 'Item.mark', rootUuid: 'Item.mark', holder: { kind: 'sidebar' } });
const tokenConstrict = (token: string) =>
	copy({
		uuid: `Scene.temple.Token.${token}.Actor.cobra.Item.constrict`,
		rootUuid: `Scene.temple.Token.${token}.Actor.cobra`,
		name: 'Constrict',
		img: 'constrict.webp',
		type: 'monsterFeature',
		sourceId: 'Compendium.nimble.nimble-monsters.Actor.cobra.Item.constrict',
		versions: [87, 89],
		holder: { kind: 'token', actorName: 'Cobra Captain', sceneName: 'Sunken Temple' },
	});
const copies = [wrenMark, bramMark, sidebarMark, tokenConstrict('t1'), tokenConstrict('t2')];

describe('copyGroups', () => {
	it('groups the copies of one compendium item, and merges the tokens of one actor in one scene', () => {
		const groups = copyGroups(copies, 'item', TITLES);

		expect(groups.map((group) => [group.name, group.count, group.rows.length])).toEqual([
			['Constrict', 2, 1],
			["Hunter's Mark", 3, 3],
		]);
		expect(groups[0].rows[0]).toEqual(
			expect.objectContaining({
				uuids: [
					'Scene.temple.Token.t1.Actor.cobra.Item.constrict',
					'Scene.temple.Token.t2.Actor.cobra.Item.constrict',
				],
				holder: expect.objectContaining({ kind: 'token', sceneName: 'Sunken Temple' }),
				titles: [
					{ title: 'Held changes become Held Roll rules', always: true },
					{ title: 'Timed effects content', always: false },
				],
			}),
		);
	});

	it('groups by actor, with the tokens, the sidebar and the compendiums after the actors', () => {
		const groups = copyGroups(copies, 'actor', TITLES);

		expect(groups.map((group) => [group.kind, group.name, group.count])).toEqual([
			['actor', 'Bram', 1],
			['actor', 'Wren', 1],
			['token', 'Cobra Captain', 2],
			['sidebar', '', 1],
		]);
		expect(groups[2]).toEqual(expect.objectContaining({ sceneName: 'Sunken Temple', tokens: 2 }));
	});
});

describe('tick boxes', () => {
	it('shares one box per copy between the two sorts', () => {
		const excluded = toggleCopies(new Set(), copyGroups(copies, 'item', TITLES)[1].rows[0].uuids);
		const byActor = copyGroups(copies, 'actor', TITLES);
		const wren = byActor.find((group) => group.name === 'Wren')!;

		expect(checkState(wren.rows[0], excluded)).toBe('off');
		expect(checkState(byActor.find((group) => group.name === 'Bram')!, excluded)).toBe('on');
	});

	it('shows a group as mixed when some of its copies are kept out', () => {
		const mark = copyGroups(copies, 'item', TITLES)[1];
		const excluded = toggleCopies(new Set(), mark.rows[0].uuids);

		expect(checkState(mark, excluded)).toBe('mixed');
		expect(checkState(mark, toggleCopies(excluded, mark.uuids))).toBe('off');
		expect(checkState(mark, toggleCopies(toggleCopies(excluded, mark.uuids), mark.uuids))).toBe(
			'on',
		);
	});

	it('gives no box to a copy that only structure migrations change', () => {
		const structureOnly = copy({ versions: [87], excludable: false });
		const [group] = copyGroups([structureOnly], 'item', TITLES);

		expect(checkState(group.rows[0], new Set())).toBe('none');
		expect(checkState(group, new Set())).toBe('none');
	});
});
