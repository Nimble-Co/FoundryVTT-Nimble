import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	LEGACY_CONDITION_EFFECT_TYPE,
	NIMBLE_EFFECT_TYPE,
} from '../../../models/activeEffect/nimbleEffectChoices.js';
import { NimbleActiveEffect } from '../activeEffect.js';

const SHOW_ICON = CONST.ACTIVE_EFFECT_SHOW_ICON;

function effectWithShowIcon(showIcon: number | undefined): NimbleActiveEffect {
	return new (NimbleActiveEffect as unknown as new (data: object) => NimbleActiveEffect)({
		showIcon,
	});
}

describe('NimbleActiveEffect.prepareBaseData', () => {
	it('promotes the CONDITIONAL default to ALWAYS so non-temporary effects keep their icon', () => {
		const effect = effectWithShowIcon(SHOW_ICON.CONDITIONAL);

		effect.prepareBaseData();

		expect(effect.showIcon).toBe(SHOW_ICON.ALWAYS);
	});

	it('leaves an explicit NEVER alone so hiding an icon stays possible', () => {
		const effect = effectWithShowIcon(SHOW_ICON.NEVER);

		effect.prepareBaseData();

		expect(effect.showIcon).toBe(SHOW_ICON.NEVER);
	});

	it('leaves ALWAYS alone', () => {
		const effect = effectWithShowIcon(SHOW_ICON.ALWAYS);

		effect.prepareBaseData();

		expect(effect.showIcon).toBe(SHOW_ICON.ALWAYS);
	});

	// Effects stored before the V14 upgrade have no showIcon in their source, so
	// the schema initializes them to CONDITIONAL — the case that would otherwise
	// make an existing toggle or banked reduction go invisible on the token.
	it('builds a rules manager over the rules in its system data', () => {
		const effect = effectWithShowIcon(SHOW_ICON.ALWAYS);
		Object.assign(effect, { system: { rules: [] } });

		effect.prepareBaseData();

		expect(effect.rules).toBeInstanceOf(Map);
		expect(effect.rules.size).toBe(0);
	});

	it('promotes an effect that initialized to the schema default', () => {
		const effect = effectWithShowIcon(undefined);
		(effect as { showIcon: number }).showIcon = SHOW_ICON.CONDITIONAL;

		effect.prepareBaseData();

		expect(effect.showIcon).toBe(SHOW_ICON.ALWAYS);
	});
});

type PreCreate = (data: object, options: object, user: object) => Promise<boolean | undefined>;

interface PendingEffect {
	_source: Record<string, unknown>;
	updateSource: ReturnType<typeof vi.fn>;
	_preCreate: PreCreate;
}

describe('NimbleActiveEffect._preCreate', () => {
	const coreProto = Object.getPrototypeOf(NimbleActiveEffect.prototype) as {
		_preCreate?: PreCreate;
	};
	const operators = foundry.data.operators as unknown as Record<string, unknown>;
	const constants = CONST as unknown as Record<string, unknown>;
	let corePreCreate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		corePreCreate = vi.fn(async () => undefined);
		coreProto._preCreate = corePreCreate as unknown as PreCreate;
		operators.ForcedReplacement = { create: (value: unknown) => ({ replaced: value }) };
		constants.BASE_DOCUMENT_TYPE = 'base';
	});

	afterEach(() => {
		delete coreProto._preCreate;
		delete operators.ForcedReplacement;
		delete constants.BASE_DOCUMENT_TYPE;
	});

	function pendingEffect(source: Record<string, unknown>): PendingEffect {
		const effect = new (NimbleActiveEffect as unknown as new () => PendingEffect)();
		effect._source = source;
		effect.updateSource = vi.fn();
		return effect;
	}

	it('makes an effect created without a type a Nimble effect and keeps its changes', async () => {
		const changes = [{ key: 'system.attributes.speed', type: 'add', value: 1 }];
		const effect = pendingEffect({ type: 'base', system: { changes } });

		await effect._preCreate({}, {}, {});

		expect(effect.updateSource).toHaveBeenCalledWith({
			type: NIMBLE_EFFECT_TYPE,
			system: { replaced: { changes } },
		});
	});

	it('converts an effect that carries only core and system flags', async () => {
		const effect = pendingEffect({
			type: 'base',
			flags: { core: { overlay: true }, [SYSTEM_ID]: { anything: 1 } },
		});

		await effect._preCreate({}, {}, {});

		expect(effect.updateSource).toHaveBeenCalledWith(
			expect.objectContaining({ type: NIMBLE_EFFECT_TYPE }),
		);
	});

	it('leaves an effect that another package flagged as it is', async () => {
		const effect = pendingEffect({ type: 'base', flags: { 'some-module': { owned: true } } });

		await effect._preCreate({}, {}, {});

		expect(effect.updateSource).not.toHaveBeenCalled();
	});

	it('leaves an effect of another type as it is', async () => {
		const effect = pendingEffect({ type: 'some-module.aura' });

		await effect._preCreate({}, {}, {});

		expect(effect.updateSource).not.toHaveBeenCalled();
	});

	it('does nothing when core refuses the creation', async () => {
		corePreCreate.mockResolvedValue(false);
		const effect = pendingEffect({ type: 'base' });

		const allowed = await effect._preCreate({}, {}, {});

		expect(allowed).toBe(false);
		expect(effect.updateSource).not.toHaveBeenCalled();
	});
});

describe('NimbleActiveEffect.createDialog', () => {
	type CreateDialog = (...args: unknown[]) => Promise<unknown>;
	const coreClass = Object.getPrototypeOf(NimbleActiveEffect) as {
		createDialog?: CreateDialog;
		TYPES?: string[];
	};
	let coreCreateDialog: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		coreCreateDialog = vi.fn(async () => null);
		coreClass.createDialog = coreCreateDialog as unknown as CreateDialog;
		coreClass.TYPES = ['base', LEGACY_CONDITION_EFFECT_TYPE, NIMBLE_EFFECT_TYPE];
		(CONST as unknown as Record<string, unknown>).BASE_DOCUMENT_TYPE = 'base';
	});

	afterEach(() => {
		delete coreClass.createDialog;
		delete coreClass.TYPES;
		delete (CONST as unknown as Record<string, unknown>).BASE_DOCUMENT_TYPE;
	});

	const createDialog = (...args: unknown[]) =>
		(NimbleActiveEffect as unknown as { createDialog: CreateDialog }).createDialog(...args);

	it('offers only the Nimble type', async () => {
		const renderOptions = { renderContext: 'test' };

		await createDialog({}, {}, undefined, renderOptions);

		expect(coreCreateDialog).toHaveBeenCalledWith(
			{},
			{},
			{ types: [NIMBLE_EFFECT_TYPE] },
			renderOptions,
		);
	});

	it('keeps the caller restriction and other options, and still drops the legacy and base types', async () => {
		await createDialog(
			{},
			{},
			{ types: [LEGACY_CONDITION_EFFECT_TYPE, NIMBLE_EFFECT_TYPE], width: 400 },
		);

		expect(coreCreateDialog).toHaveBeenCalledWith(
			{},
			{},
			{ types: [NIMBLE_EFFECT_TYPE], width: 400 },
			undefined,
		);
	});

	it('passes an empty restriction on when the caller allows only removed types', async () => {
		await createDialog({}, {}, { types: [LEGACY_CONDITION_EFFECT_TYPE] });

		expect(coreCreateDialog).toHaveBeenCalledWith({}, {}, { types: [] }, undefined);
	});
});

describe('NimbleActiveEffect.isMinor', () => {
	const make = (fields: object) =>
		new (NimbleActiveEffect as unknown as new (data: object) => NimbleActiveEffect)({
			statuses: new Set<string>(),
			system: {},
			...fields,
		});

	it('is a Minor Status when its data says so', () => {
		expect(make({ system: { minor: true } }).isMinor).toBe(true);
	});

	it('is a Minor Status when it carries a minor condition', () => {
		expect(make({ statuses: new Set(['smoldering']) }).isMinor).toBe(true);
	});

	it('is not a Minor Status for another condition', () => {
		expect(make({ statuses: new Set(['blinded']) }).isMinor).toBe(false);
	});
});
