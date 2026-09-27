import { movementChipsFor, movementStatus, moveNodeText } from './moveNodeText.ts';

const SPEAKER_TOKEN = 'Scene.s1.Token.hero';
const TRACKING = { tracking: true };

function moveNode(overrides: Record<string, unknown> = {}) {
	return {
		id: 'push1',
		type: 'move',
		kind: 'forced',
		recipient: 'targets',
		distance: '2',
		distanceBySize: {},
		ignoreDifficultTerrain: true,
		direction: 'away',
		parentContext: null,
		parentNode: null,
		...overrides,
	} as never;
}

function offer(overrides: Record<string, unknown> = {}) {
	return {
		id: 'push1.tok1',
		nodeId: 'push1',
		tokenUuid: 'Scene.s1.Token.tok1',
		name: 'Goblin Cutthroat',
		kind: 'forced',
		spaces: 2,
		ignoreDifficultTerrain: true,
		state: 'open',
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		conditional: false,
		...overrides,
	} as never;
}

function card(movementOffers: unknown[], effects: unknown[] = []) {
	return {
		speaker: { scene: 's1', token: 'hero', actor: 'a1' },
		system: { actorName: 'Sir Brannon', movementOffers, activation: { effects } },
	};
}

function summaryOf(node: never, offers: unknown[]) {
	return moveNodeText(card(offers, [node]), node, TRACKING).summary;
}

function chipOf(node: never, entry: never, options = TRACKING) {
	return moveNodeText(card([entry], [node]), node, options).chip(entry);
}

describe('moveNodeText', () => {
	describe('summary line', () => {
		it.each([
			['away', 'Pushed up to 2 spaces away from Sir Brannon.'],
			['toward', 'Pulled up to 2 spaces toward Sir Brannon.'],
			['any', 'Moved up to 2 spaces in any direction.'],
		])('names a %s push with the book verb', (direction, expected) => {
			expect(summaryOf(moveNode({ direction }), [offer()])).toBe(expected);
		});

		it('points to each creature when the distances differ', () => {
			const offers = [
				offer(),
				offer({ id: 'push1.tok2', tokenUuid: 'Scene.s1.Token.tok2', spaces: 3 }),
			];
			expect(summaryOf(moveNode(), offers)).toBe(
				'Pushed away from Sir Brannon. Each creature shows its spaces.',
			);
		});

		it('drops the distance when no creature gets the move', () => {
			expect(summaryOf(moveNode(), [])).toBe('Pushed away from Sir Brannon.');
			expect(summaryOf(moveNode(), [offer({ spaces: 0 })])).toBe('Pushed away from Sir Brannon.');
		});

		it('says a Free Move is for free, with the terrain clause only when it ignores difficult terrain', () => {
			const self = { kind: 'free', recipient: 'self', direction: 'any' };
			const selfOffer = { tokenUuid: SPEAKER_TOKEN, kind: 'free', spaces: 6 };
			expect(summaryOf(moveNode(self), [offer(selfOffer)])).toBe(
				'Can move up to 6 spaces for free, ignoring difficult terrain.',
			);
			expect(
				summaryOf(moveNode({ ...self, ignoreDifficultTerrain: false }), [offer(selfOffer)]),
			).toBe('Can move up to 6 spaces for free.');
		});

		it('gives a Free Move its direction', () => {
			const node = moveNode({ kind: 'free', direction: 'toward', ignoreDifficultTerrain: false });
			expect(summaryOf(node, [offer({ kind: 'free', spaces: 3 })])).toBe(
				'Can move up to 3 spaces toward Sir Brannon for free.',
			);
			const offers = [
				offer({ kind: 'free', spaces: 3 }),
				offer({ id: 'push1.tok2', tokenUuid: 'Scene.s1.Token.tok2', kind: 'free', spaces: 4 }),
			];
			expect(summaryOf(node, offers)).toBe(
				'Can move toward Sir Brannon for free. Each creature shows its spaces.',
			);
		});

		it('hides the direction when the feature user is the only creature that moves', () => {
			expect(
				summaryOf(moveNode({ recipient: 'self' }), [offer({ tokenUuid: SPEAKER_TOKEN })]),
			).toBe('Moved up to 2 spaces.');
			expect(summaryOf(moveNode(), [offer({ tokenUuid: SPEAKER_TOKEN })])).toBe(
				'Moved up to 2 spaces.',
			);
		});

		it('never mentions terrain for a push', () => {
			expect(summaryOf(moveNode(), [offer()])).not.toMatch(/terrain/);
		});
	});

	describe('chip', () => {
		it.each([
			['open', {}, '2', 'Waiting to be pushed up to 2 spaces away from Sir Brannon.'],
			['taken', { state: 'taken', movedSpaces: 2 }, '2/2', 'Pushed the full 2 spaces.'],
			['unused', { state: 'unused' }, 'Not pushed', 'Not pushed. It moved another way instead.'],
			['lapsed', { state: 'lapsed' }, 'Not pushed', 'Not pushed. The turn ended first.'],
		])('tells a %s push in plain words', (status, overrides, label, tooltip) => {
			const chip = chipOf(moveNode(), offer(overrides));
			expect(chip).toMatchObject({ status, label, tooltip });
		});

		it('adds the obstacle reminder to a push that fell short', () => {
			const chip = chipOf(moveNode(), offer({ state: 'taken', spaces: 3, movedSpaces: 1 }));
			expect(chip.status).toBe('short');
			expect(chip.label).toBe('1/3');
			expect(chip.tooltip).toBe(
				'Pushed 1 of 3 spaces. If an obstacle stopped Goblin Cutthroat, it takes 2d6 bludgeoning damage. If it hit another creature, both creatures split the damage.',
			);
		});

		it.each([
			['toward', 'Waiting to be pulled up to 2 spaces toward Sir Brannon.', 'Not pulled'],
			['any', 'Waiting to be moved up to 2 spaces in any direction.', 'Not moved'],
		])('uses the %s verb', (direction, openTooltip, notMovedLabel) => {
			const node = moveNode({ direction });
			expect(chipOf(node, offer()).tooltip).toBe(openTooltip);
			expect(chipOf(node, offer({ state: 'unused' })).label).toBe(notMovedLabel);
		});

		it.each([
			['open', {}, '3', 'Can move up to 3 spaces toward Sir Brannon for free.'],
			['taken', { state: 'taken', movedSpaces: 3 }, '3/3', 'Moved the full 3 spaces for free.'],
			['partial', { state: 'taken', movedSpaces: 2 }, '2/3', 'Moved 2 of 3 spaces for free.'],
			[
				'short',
				{ state: 'taken', movedSpaces: 2, stopped: true },
				'2/3',
				'Moved 2 of 3 spaces for free before something blocked the path.',
			],
			[
				'unused',
				{ state: 'unused' },
				'Not used',
				'Did not use the Free Move. It moved another way instead.',
			],
			[
				'lapsed',
				{ state: 'lapsed' },
				'Not used',
				'Did not use the Free Move. The turn ended first.',
			],
		])('tells a %s Free Move in plain words', (status, overrides, label, tooltip) => {
			const node = moveNode({ kind: 'free', direction: 'toward', ignoreDifficultTerrain: false });
			const chip = chipOf(node, offer({ kind: 'free', spaces: 3, ...overrides }));
			expect(chip).toMatchObject({ status, label, tooltip });
		});

		it('uses the singular for one space', () => {
			expect(chipOf(moveNode(), offer({ spaces: 1 })).tooltip).toBe(
				'Waiting to be pushed up to 1 space away from Sir Brannon.',
			);
			expect(chipOf(moveNode(), offer({ spaces: 1, state: 'taken', movedSpaces: 1 })).tooltip).toBe(
				'Pushed the full 1 space.',
			);
		});

		it('states an open push instead of waiting for it when nothing records the drag', () => {
			expect(chipOf(moveNode(), offer(), { tracking: false })).toMatchObject({
				status: 'untracked',
				label: '2',
				tooltip: 'Pushed up to 2 spaces away from Sir Brannon.',
			});
		});

		it('states a move that a toggle change untracked, with tracking back on', () => {
			expect(chipOf(moveNode(), offer({ state: 'untracked' }))).toMatchObject({
				status: 'untracked',
				label: '2',
				tooltip: 'Pushed up to 2 spaces away from Sir Brannon.',
			});
			const free = moveNode({ kind: 'free', direction: 'toward', ignoreDifficultTerrain: false });
			expect(chipOf(free, offer({ kind: 'free', spaces: 3, state: 'untracked' })).tooltip).toBe(
				'Can move up to 3 spaces toward Sir Brannon for free.',
			);
		});

		it('never shows a code word', () => {
			const states = [
				{},
				{ state: 'taken', movedSpaces: 2 },
				{ state: 'taken', movedSpaces: 1 },
				{ state: 'unused' },
				{ state: 'lapsed' },
				{ state: 'untracked' },
				{ conditional: true },
			];
			for (const kind of ['forced', 'free']) {
				for (const overrides of states) {
					const chip = chipOf(moveNode({ kind }), offer({ kind, ...overrides }));
					expect(`${chip.label} ${chip.tooltip}`).not.toMatch(/offer|taken|unused|lapse|untrack/i);
				}
			}
		});
	});

	describe('a move a save decides', () => {
		function saveCard(context: string, entry: never) {
			const push = moveNode();
			const effects = [
				{
					id: 'save1',
					type: 'savingThrow',
					parentContext: null,
					parentNode: null,
					on: { [context]: [push] },
				},
			];
			return { push, text: moveNodeText(card([entry], effects), push, TRACKING) };
		}

		it.each([
			['failedSave', 'Pushed up to 2 spaces away from Sir Brannon if it fails the save.'],
			['passedSave', 'Pushed up to 2 spaces away from Sir Brannon if it passes the save.'],
			['failedSaveBy5', 'Pushed up to 2 spaces away from Sir Brannon, depending on the save.'],
		])('names the %s outcome', (context, tooltip) => {
			const entry = offer({ conditional: true });
			const { text } = saveCard(context, entry);
			expect(text.chip(entry)).toMatchObject({ status: 'conditional', label: '2', tooltip });
		});

		it('finds the save outcome above a nested node', () => {
			const push = moveNode();
			const entry = offer({ conditional: true });
			const effects = [
				{
					id: 'save1',
					type: 'savingThrow',
					parentContext: null,
					parentNode: null,
					on: {
						failedSave: [
							{
								id: 'damage1',
								type: 'damage',
								parentContext: null,
								parentNode: null,
								on: { hit: [push] },
							},
						],
					},
				},
			];
			expect(moveNodeText(card([entry], effects), push, TRACKING).chip(entry).tooltip).toBe(
				'Pushed up to 2 spaces away from Sir Brannon if it fails the save.',
			);
		});
	});

	describe('obstacle reminder', () => {
		const text = (entry: never, node = moveNode()) =>
			moveNodeText(card([entry], [node]), node, TRACKING).obstacleDamage(entry);

		it('is there only for a push that fell short', () => {
			expect(text(offer({ state: 'taken', spaces: 3, movedSpaces: 1 }))).toMatch(
				/^If an obstacle stopped Goblin Cutthroat, it takes 2d6 bludgeoning damage\./,
			);
			expect(text(offer({ state: 'taken', movedSpaces: 2 }))).toBeNull();
			expect(text(offer())).toBeNull();
			expect(
				text(
					offer({ kind: 'free', state: 'taken', spaces: 3, movedSpaces: 1, stopped: true }),
					moveNode({ kind: 'free' }),
				),
			).toBeNull();
		});
	});

	it('lists only the offers of its own node that have a distance', () => {
		const node = moveNode();
		const offers = [
			offer(),
			offer({ id: 'push1.tok2', tokenUuid: 'Scene.s1.Token.tok2', spaces: 0 }),
			offer({ id: 'push2.tok1', nodeId: 'push2' }),
		];
		expect(moveNodeText(card(offers, [node]), node, TRACKING).offers).toHaveLength(1);
	});
});

describe('movementStatus', () => {
	it('reads a conditional offer as conditional whatever its state', () => {
		expect(movementStatus(offer({ conditional: true }), true)).toBe('conditional');
	});
});

describe('movementChipsFor', () => {
	it('gives one creature a chip for each move node that moves it, in tree order', () => {
		const push = moveNode();
		const pull = moveNode({ id: 'pull1', direction: 'toward' });
		const effects = [
			push,
			{
				id: 'save1',
				type: 'savingThrow',
				parentContext: null,
				parentNode: null,
				on: { failedSave: [pull] },
			},
		];
		const offers = [
			offer(),
			offer({ id: 'pull1.tok1', nodeId: 'pull1', conditional: true }),
			offer({ id: 'push1.tok2', tokenUuid: 'Scene.s1.Token.tok2' }),
		];
		const chips = movementChipsFor(card(offers, effects), 'Scene.s1.Token.tok1', TRACKING);
		expect(chips.map((chip) => chip.key)).toEqual(['push1.tok1', 'pull1.tok1']);
		expect(chips[1].tooltip).toBe('Pulled up to 2 spaces toward Sir Brannon if it fails the save.');
	});

	it('gives no chip for an offer of zero spaces', () => {
		const push = moveNode();
		expect(
			movementChipsFor(card([offer({ spaces: 0 })], [push]), 'Scene.s1.Token.tok1', TRACKING),
		).toEqual([]);
	});
});
