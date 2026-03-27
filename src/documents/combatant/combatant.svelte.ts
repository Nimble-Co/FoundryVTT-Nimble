import { createSubscriber } from 'svelte/reactivity';
import { initiativeRollLock } from '../../utils/initiativeRollLock.js';

function getRequestedInitiativeRollLockData(
	changes: Record<string, unknown>,
): ReturnType<typeof initiativeRollLock.get> | null | undefined {
	const nextLock =
		changes[initiativeRollLock.path] ?? foundry.utils.getProperty(changes, initiativeRollLock.path);
	if (nextLock === undefined) return undefined;
	if (nextLock === null) return null;

	return initiativeRollLock.get({
		flags: {
			nimble: {
				initiativeRollLock: nextLock,
			},
		},
	});
}

export class NimbleCombatant extends Combatant {
	#subscribe: any;

	constructor(data, context) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateCombatantHook = Hooks.on('updateCombatant', (triggeringDocument, _, { diff }) => {
				if (diff === false) return;

				if (triggeringDocument._id === this.id) update();
			});

			return () => {
				Hooks.off('updateCombatant', updateCombatantHook);
			};
		});
	}

	get reactive() {
		this.#subscribe();

		return this;
	}

	override async _preCreate(data, _options, _userId) {
		if (data.type === 'character') return;

		this.updateSource({ initiative: 0 });
	}

	override getInitiativeRoll(
		formula: string | undefined,
		rollOptions: Record<string, string | number | boolean> = {},
	) {
		const { actor } = this;

		const initiativeFormula =
			formula ??
			(
				actor as object as {
					_getInitiativeFormula?(opts: Record<string, string | number | boolean>): string;
				}
			)?._getInitiativeFormula?.(rollOptions) ??
			'0';

		const rollData = actor?.getRollData() || {};
		return Roll.create(initiativeFormula, rollData);
	}

	override async rollInitiative(
		formula: undefined | string,
		rollOptions: Record<string, any> = {},
	): Promise<this | undefined> {
		const roll = this.getInitiativeRoll(formula, rollOptions);
		await roll.evaluate();

		return this.update({ initiative: roll.total ?? 0 });
	}

	override async _preUpdate(changes, options, user) {
		const changesAsRecord = changes as Record<string, unknown>;
		const currentLock = initiativeRollLock.get(this);
		const requestedLock = getRequestedInitiativeRollLockData(changesAsRecord);

		if (
			currentLock &&
			!initiativeRollLock.isStale(currentLock) &&
			requestedLock !== undefined &&
			requestedLock !== null &&
			requestedLock?.requestId !== currentLock.requestId
		) {
			return false;
		}

		const parentPrototype = Object.getPrototypeOf(NimbleCombatant.prototype) as {
			_preUpdate?: (
				changes: Combatant.UpdateData,
				options: Combatant.Database.PreUpdateOptions,
				user: User.Implementation,
			) => Promise<boolean | undefined> | boolean | undefined;
		};
		const parentPreUpdate = parentPrototype._preUpdate;
		if (typeof parentPreUpdate !== 'function') return true;
		return parentPreUpdate.call(this, changes, options, user);
	}

	override toObject(source = true) {
		const data = super.toObject(source);

		data.img = this.img;
		data.name = this.name;

		return data;
	}
}
