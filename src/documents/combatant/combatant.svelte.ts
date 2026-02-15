import { createSubscriber } from 'svelte/reactivity';

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

	override toObject(source = true) {
		const data = super.toObject(source);

		data.img = this.img;
		data.name = this.name;

		return data;
	}
}
