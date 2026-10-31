import { fireEvent, render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RuleCard from '../RuleCard.svelte';
import { FIXED_FIELDS } from '../RuleCardState.svelte.js';

vi.stubGlobal('fromUuidSync', () => null);

const proseMirrorMock = foundry.applications.elements.HTMLProseMirrorElement
	.create as unknown as ReturnType<typeof vi.fn>;
proseMirrorMock.mockImplementation(() => document.createElement('div'));

type RuleClassLike = {
	defineSchema: () => Record<string, foundry.data.fields.DataField.Any>;
	formLayout?: unknown;
};

const updateRule = vi.fn().mockResolvedValue(undefined);
const manager = { updateRule };

function initialRule(type: string, overrides: Record<string, unknown> = {}) {
	const RuleClass = CONFIG.NIMBLE.ruleDataModels[type] as unknown as RuleClassLike;
	const rule: Record<string, unknown> = { id: `test-${type}`, type };
	for (const [name, field] of Object.entries(RuleClass.defineSchema())) {
		if (name in rule) continue;
		const initial = (field as { initial?: unknown }).initial;
		rule[name] = typeof initial === 'function' ? initial() : initial;
	}
	return { ...rule, ...overrides };
}

function bodyOf(container: HTMLElement) {
	return container.querySelector('.nimble-rule-card__body') as HTMLElement;
}

function shownFields(container: HTMLElement): string[] {
	return [...bodyOf(container).querySelectorAll<HTMLElement>('[data-field]')].map(
		(el) => el.dataset.field ?? '',
	);
}

describe('RuleCard with a form layout (reroll)', () => {
	beforeEach(() => updateRule.mockClear());

	it('shows the fields in the layout order, the optional groups last', () => {
		const { container } = render(RuleCard, { rule: initialRule('reroll'), manager });
		expect(shownFields(container)).toEqual([
			'rolls',
			'usedBy',
			'die',
			'keep',
			'outcome',
			'attackDelivery',
			'predicate',
			'otherCreature',
			'chargePoolIdentifier',
			'manaCost',
			'woundCost',
			'heroicReaction',
			'actionCost',
			'oncePerAttack',
			'rollModeChange',
			'primaryDieBonus',
			'extraDamage',
			'automatic',
			'discardedCritTriggers',
			'cardHint',
		]);
	});

	it('shows the group questions in order', () => {
		const { container } = render(RuleCard, { rule: initialRule('reroll'), manager });
		const questions = [...container.querySelectorAll('.nimble-rule-form__question')].map((el) =>
			el.textContent?.trim(),
		);
		expect(questions).toEqual([
			'Which roll can it reroll?',
			'Who can use it?',
			'Which dice does it reroll?',
			'When?',
			'Only while',
			'Only when the other creature is',
			'Cost (optional)',
			'Changes to the new roll (optional)',
			'Note on the card',
		]);
	});

	it('moves the condition editor out of Advanced', () => {
		const { container } = render(RuleCard, { rule: initialRule('reroll'), manager });
		expect(bodyOf(container).querySelector('.nimble-predicate-builder')).toBeTruthy();
		const advanced = container.querySelector('.nimble-rule-card__advanced') as HTMLElement;
		expect(advanced.querySelector('.nimble-predicate-builder')).toBeFalsy();
		expect(advanced.textContent).toContain('Suppress activation card');
	});

	it.each(['miss', 'nonCriticalHit'])(
		'hides the discarded crit option for outcome %s',
		(outcome) => {
			const { container } = render(RuleCard, {
				rule: initialRule('reroll', { outcome }),
				manager,
			});
			expect(shownFields(container)).not.toContain('discardedCritTriggers');
			expect(container.textContent).not.toContain('The discarded crit still triggers');
		},
	);

	it.each(['always', 'hit', 'criticalHit'])(
		'shows the discarded crit option for outcome %s',
		(outcome) => {
			const { container } = render(RuleCard, {
				rule: initialRule('reroll', { outcome }),
				manager,
			});
			expect(shownFields(container)).toContain('discardedCritTriggers');
		},
	);

	it('shows charges per use only when a charge pool is set', () => {
		const withPool = render(RuleCard, {
			rule: initialRule('reroll', { chargePoolIdentifier: 'brutality' }),
			manager,
		});
		const fields = shownFields(withPool.container);
		expect(fields.indexOf('chargeCost')).toBe(fields.indexOf('chargePoolIdentifier') + 1);
	});

	it('asks who can use it with chips', async () => {
		const { container } = render(RuleCard, { rule: initialRule('reroll'), manager });
		const field = container.querySelector('[data-field="usedBy"]') as HTMLElement;
		const chips = [...field.querySelectorAll('button')];
		expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
			'The one who rolled',
			'The target',
			'An ally',
		]);
		await fireEvent.click(chips[1] as HTMLButtonElement);
		expect(updateRule).toHaveBeenCalledWith(
			'test-reroll',
			expect.objectContaining({ usedBy: 'target' }),
		);
	});

	it('asks for a Reach for an ally, and hides Rerolls by itself', () => {
		const { container } = render(RuleCard, {
			rule: initialRule('reroll', { usedBy: 'ally' }),
			manager,
		});
		const fields = shownFields(container);
		expect(fields.slice(0, 5)).toEqual(['rolls', 'usedBy', 'reach', 'die', 'keep']);
		expect(fields).not.toContain('automatic');
	});

	it('shows the roll changes only for a reroll of the whole roll', () => {
		const changes = ['rollModeChange', 'primaryDieBonus', 'extraDamage'];
		const whole = shownFields(
			render(RuleCard, { rule: initialRule('reroll', { rolls: ['attack'] }), manager }).container,
		);
		expect(whole).toEqual(expect.arrayContaining(changes));

		const oneDie = shownFields(
			render(RuleCard, {
				rule: initialRule('reroll', { rolls: ['attack'], die: 'primaryDie' }),
				manager,
			}).container,
		);
		for (const field of changes) expect(oneDie).not.toContain(field);
	});

	it('shows the roll chip with its name, not its key', () => {
		const { container } = render(RuleCard, { rule: initialRule('reroll'), manager });
		const field = container.querySelector('[data-field="rolls"]') as HTMLElement;
		const chips = [...field.querySelectorAll('button')].map((chip) => chip.textContent?.trim());
		expect(chips).toEqual(['Attack', 'Save', 'Skill Check', 'Ability Check']);
	});

	it('adds a roll to the rolls it can reroll', async () => {
		const { container } = render(RuleCard, { rule: initialRule('reroll'), manager });
		const field = container.querySelector('[data-field="rolls"]') as HTMLElement;
		const save = [...field.querySelectorAll('button')].find(
			(chip) => chip.textContent?.trim() === 'Save',
		);
		await fireEvent.click(save as HTMLButtonElement);
		expect(updateRule).toHaveBeenCalledWith(
			'test-reroll',
			expect.objectContaining({ rolls: ['attack', 'save'] }),
		);
	});

	it('asks which saves, skills and abilities under the roll question', () => {
		const rolls = ['attack', 'save', 'skillCheck', 'abilityCheck'];
		const { container } = render(RuleCard, { rule: initialRule('reroll', { rolls }), manager });
		const group = container
			.querySelector('[data-field="rolls"]')
			?.closest('section') as HTMLElement;
		expect(
			[...group.querySelectorAll<HTMLElement>('[data-field]')].map((el) => el.dataset.field),
		).toEqual(['rolls', 'saves', 'skills', 'abilities']);
		expect(group.querySelector('.nimble-rule-form__question')?.textContent?.trim()).toBe(
			'Which roll can it reroll?',
		);
		const labels = [...group.querySelectorAll('.nimble-rule-form__label')].map((el) =>
			el.textContent?.trim(),
		);
		expect(labels).toEqual(['Which saves?', 'Which skills?', 'Which abilities?']);
		expect(group.textContent).toContain('None picked means any.');
	});

	it('shows only the fields that apply to a rule with no attack', () => {
		const { container } = render(RuleCard, {
			rule: initialRule('reroll', { rolls: ['save'] }),
			manager,
		});
		expect(shownFields(container)).toEqual([
			'rolls',
			'saves',
			'usedBy',
			'die',
			'keep',
			'predicate',
			'chargePoolIdentifier',
			'manaCost',
			'woundCost',
			'heroicReaction',
			'actionCost',
			'rollModeChange',
			'automatic',
			'cardHint',
		]);
		const questions = [...container.querySelectorAll('.nimble-rule-form__question')].map((el) =>
			el.textContent?.trim(),
		);
		expect(questions).not.toContain('When?');
	});

	it('lists the saves by name', () => {
		const { container } = render(RuleCard, {
			rule: initialRule('reroll', { rolls: ['save'] }),
			manager,
		});
		const field = container.querySelector('[data-field="saves"]') as HTMLElement;
		expect([...field.querySelectorAll('button')].map((chip) => chip.textContent?.trim())).toEqual([
			'Strength',
			'Dexterity',
			'Intelligence',
			'Will',
		]);
	});

	it('picks advantage or disadvantage from a list and stores a number', async () => {
		const { container } = render(RuleCard, { rule: initialRule('reroll'), manager });
		const select = container.querySelector(
			'[data-field="rollModeChange"] select',
		) as HTMLSelectElement;
		expect([...select.options].map((option) => option.textContent?.trim())).toEqual([
			'None',
			'One more advantage',
			'One more disadvantage',
		]);
		select.value = '-1';
		await fireEvent.change(select);
		expect(updateRule).toHaveBeenCalledWith(
			'test-reroll',
			expect.objectContaining({ rollModeChange: -1 }),
		);
	});

	it('lets the charge pool be left empty', () => {
		const { container } = render(RuleCard, { rule: initialRule('reroll'), manager });
		const field = container.querySelector('[data-field="chargePoolIdentifier"]') as HTMLElement;
		expect(field.querySelector('input, select')).toBeTruthy();
	});
});

describe('RuleCard with a form layout (changeDie)', () => {
	it('asks which roll, who, which die and how, then when and the cost', () => {
		const { container } = render(RuleCard, { rule: initialRule('changeDie'), manager });
		expect(shownFields(container)).toEqual([
			'rolls',
			'usedBy',
			'die',
			'change',
			'addsBonusOnSet',
			'outcome',
			'attackDelivery',
			'predicate',
			'otherCreature',
			'chargePoolIdentifier',
			'manaCost',
			'woundCost',
			'heroicReaction',
			'actionCost',
			'oncePerAttack',
			'cardHint',
		]);
	});

	it('asks when to show the note only once the rule has a note', () => {
		const { container } = render(RuleCard, {
			rule: initialRule('changeDie', { cardHint: 'With a blade' }),
			manager,
		});
		const fields = shownFields(container);
		expect(fields.indexOf('cardHintWhen')).toBe(fields.indexOf('cardHint') + 1);
	});

	it('asks for the number to add only for an add', () => {
		const { container } = render(RuleCard, {
			rule: initialRule('changeDie', { change: 'add' }),
			manager,
		});
		const fields = shownFields(container);
		expect(fields.indexOf('amount')).toBe(fields.indexOf('change') + 1);
		expect(fields).not.toContain('addsBonusOnSet');
	});
});

describe('RuleCard with a form layout (primaryDieBonus)', () => {
	it('asks for the number, the attack type, then the optional conditions', () => {
		const { container } = render(RuleCard, { rule: initialRule('primaryDieBonus'), manager });
		expect(shownFields(container)).toEqual([
			'value',
			'attackDelivery',
			'predicate',
			'otherCreature',
		]);
	});
});

describe('RuleCard with a form layout (attackOutcome)', () => {
	it('asks which attacks, what changes, the attack type, then the optional conditions', () => {
		const { container } = render(RuleCard, { rule: initialRule('attackOutcome'), manager });
		expect(shownFields(container)).toEqual([
			'side',
			'cannotMiss',
			'critRange',
			'forceCrit',
			'anyDieCrits',
			'attackDelivery',
			'thisItemOnly',
			'predicate',
			'otherCreature',
			'chargePoolIdentifier',
		]);
	});

	it('hides the item and charge pool fields for attacks against you', () => {
		const { container } = render(RuleCard, {
			rule: initialRule('attackOutcome', { side: 'attacksAgainstYou' }),
			manager,
		});
		expect(shownFields(container)).not.toContain('thisItemOnly');
		expect(shownFields(container)).not.toContain('chargePoolIdentifier');
	});
});

describe('RuleCard with a form layout (makeCrit)', () => {
	it('asks who, when and the cost, with no roll question', () => {
		const { container } = render(RuleCard, { rule: initialRule('makeCrit'), manager });
		expect(shownFields(container)).toEqual([
			'usedBy',
			'outcome',
			'attackDelivery',
			'predicate',
			'otherCreature',
			'chargePoolIdentifier',
			'manaCost',
			'woundCost',
			'heroicReaction',
			'actionCost',
			'cardHint',
		]);
	});
});

describe('RuleCard for a toggle', () => {
	it('names the turn-off choices in plain words, and selects only the stored one', () => {
		const { container } = render(RuleCard, {
			rule: initialRule('toggleEffect', { turnOff: ['onRoundEnd'] }),
			manager,
		});
		const chips = [...container.querySelectorAll('.nimble-tag-group__option-button')];
		expect(chips.map((chip) => chip.textContent?.trim())).toContain('When the round ends');
		expect(chips.map((chip) => chip.textContent?.trim())).not.toContain('onRoundEnd');
		const selected = chips.filter((chip) =>
			chip.classList.contains('nimble-tag-group__option-button--selected'),
		);
		expect(selected.map((chip) => chip.textContent?.trim())).toEqual(['When the round ends']);
	});
});

describe('RuleCard without a form layout', () => {
	const others = Object.entries(CONFIG.NIMBLE.ruleDataModels).filter(
		([, RuleClass]) => !(RuleClass as unknown as RuleClassLike).formLayout,
	);

	const withLayout = [
		'reroll',
		'modifyReroll',
		'primaryDieBonus',
		'changeDie',
		'attackOutcome',
		'makeCrit',
	];

	it('covers every rule but the ones with a layout', () => {
		const types = others.map(([type]) => type);
		for (const type of withLayout) expect(types).not.toContain(type);
		expect(others.length).toBe(
			Object.keys(CONFIG.NIMBLE.ruleDataModels).length - withLayout.length,
		);
	});

	it.each(others)('%s keeps the flat field list and the condition in Advanced', (type) => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const RuleClass = CONFIG.NIMBLE.ruleDataModels[type] as unknown as RuleClassLike;
		const editable = Object.keys(RuleClass.defineSchema()).filter(
			(name) => !FIXED_FIELDS.has(name),
		);

		const { container } = render(RuleCard, { rule: initialRule(type), manager });
		const body = bodyOf(container);

		expect(body.querySelector('.nimble-rule-form')).toBeFalsy();
		expect(body.querySelectorAll(':scope > .nimble-field-row')).toHaveLength(editable.length);
		const advanced = container.querySelector('.nimble-rule-card__advanced') as HTMLElement;
		expect(advanced.querySelector('.nimble-predicate-builder')).toBeTruthy();
		warnSpy.mockRestore();
	});
});
