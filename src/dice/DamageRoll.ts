import type { InexactPartial } from '#types/utils.js';

import { PrimaryDie } from './terms/PrimaryDie.js';

const Terms = foundry.dice.terms;

declare namespace DamageRoll {
	interface Data extends foundry.dice.Roll.Data {}

	interface Options extends foundry.dice.Roll.Options {
		canCrit: boolean;
		canMiss: boolean;
		criticalThreshold?: number;
		damageType?: string;
		fumbleThreshold?: number;
		rollMode: number;
		primaryDieValue: number;
		primaryDieModifier: number;
	}

	type Evaluated<T extends DamageRoll> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

// @ts-expect-error
class DamageRoll extends foundry.dice.Roll<DamageRoll.Data> {
	declare options: DamageRoll.Options;

	isCritical: undefined | boolean = undefined;

	isMiss: undefined | boolean = undefined;

	originalFormula: string;

	primaryDie: PrimaryDie | undefined = undefined;

	constructor(formula: string, data?: foundry.dice.Roll.Data, options?: DamageRoll.Options) {
		super(formula, data, options);

		// Setup Defaults
		this.options.canCrit ??= true;
		this.options.canMiss ??= true;
		this.options.rollMode ??= 0;
		this.originalFormula = formula;

		if (!this.options.canCrit) this.isCritical = false;
		if (!this.options.canMiss) this.isMiss = false;

		this._preProcessFormula(
			formula,
			this.data ?? ({} as DamageRoll.Data),
			(this.options ?? {}) as DamageRoll.Options,
		);
	}

	/** ------------------------------------------------------ */
	/**                  Data Prep Helpers                     */
	/** ------------------------------------------------------ */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_preProcessFormula(_formula: string, _data: DamageRoll.Data, options: DamageRoll.Options) {
		// Separate out the primary die
		if (options.canCrit) {
			const { rollMode = 0 } = options;
			const firstDieTerm = this.terms.find((t) => t instanceof Terms.Die);

			if (firstDieTerm) {
				const { number = 1, faces } = firstDieTerm;

				let primaryTerm: PrimaryDie;

				if (number > 1) {
					// Reduce number of original term by one
					firstDieTerm.number = number - 1;

					// Add Operator Term before Primary Term
					const operatorTerm = new Terms.OperatorTerm({ operator: '+' });
					this.terms.unshift(operatorTerm);

					// Create Primary Term
					primaryTerm = new PrimaryDie({
						number: 1 + Math.abs(rollMode),
						faces,
						options: { flavor: 'Primary Die' },
					});

					if (rollMode > 0) primaryTerm.modifiers.push('kh');
					else if (rollMode < 0) primaryTerm.modifiers.push('kl');

					// Add Explosion after adv/div has been calculated
					primaryTerm.modifiers.push('x');

					if (options.primaryDieValue) {
						primaryTerm.results = [{ result: options.primaryDieValue, active: true }];
					}

					if (options.primaryDieModifier && faces) {
						const baseResult = Math.ceil(Math.random() * faces);
						const modifiedResult = baseResult + options.primaryDieModifier;
						if (modifiedResult > faces) {
							primaryTerm.results = [{ result: faces, active: true }];
							// Add excess as a separate numeric term
							const excess = modifiedResult - faces;
							const excessTerm = new Terms.NumericTerm({ number: excess });
							const operatorTermExcess = new Terms.OperatorTerm({ operator: '+' });
							this.terms.splice(
								this.terms.indexOf(primaryTerm) + 1,
								0,
								operatorTermExcess,
								excessTerm,
							);
						} else {
							primaryTerm.results = [{ result: modifiedResult, active: true }];
						}
					}

					this.terms.unshift(primaryTerm);
				} else {
					primaryTerm = new PrimaryDie({
						number: 1,
						faces: firstDieTerm.faces,
					});

					// Add rollMode
					primaryTerm.number = number + Math.abs(rollMode);

					if (rollMode > 0) primaryTerm.modifiers.push('kh');
					else if (rollMode < 0) primaryTerm.modifiers.push('kl');

					// Add Explosion for critical after adv/dis
					primaryTerm.modifiers.push('x');

					if (options.primaryDieValue) {
						primaryTerm.results = [{ result: options.primaryDieValue, active: true }];
					}

					if (options.primaryDieModifier && faces) {
						const baseResult = Math.ceil(Math.random() * faces);
						const modifiedResult = baseResult + options.primaryDieModifier;
						if (modifiedResult > faces) {
							primaryTerm.results = [{ result: faces, active: true }];
							// Add excess as a separate numeric term
							const excess = modifiedResult - faces;
							const excessTerm = new Terms.NumericTerm({ number: excess });
							const operatorTermExcess = new Terms.OperatorTerm({ operator: '+' });
							this.terms.splice(
								this.terms.indexOf(primaryTerm) + 1,
								0,
								operatorTermExcess,
								excessTerm,
							);
						} else {
							primaryTerm.results = [{ result: modifiedResult, active: true }];
						}
					}

					// Update term
					const idx = this.terms.findIndex((t) => t instanceof Terms.Die);
					if (idx !== -1) this.terms[idx] = primaryTerm;
				}

				this.primaryDie = primaryTerm;

				// Alter formula
				this.resetFormula();
			}
		}
	}

	/** ------------------------------------------------------ */
	/**                       Helpers                          */
	/** ------------------------------------------------------ */
	updatePrimaryTerm(dieSize: number) {
		if (!this.primaryDie) return;

		const primaryTerm = this.terms.find((t) => t instanceof PrimaryDie);
		if (!primaryTerm) {
			ui.notifications?.error(`No primary die term found in roll ${this.formula}`);
			return;
		}

		primaryTerm.faces = dieSize;
		this.primaryDie = primaryTerm;
		this.resetFormula();
	}

	/** ------------------------------------------------------ */
	/**                       Overrides                        */
	/** ------------------------------------------------------ */
	override async _evaluate(
		options?: InexactPartial<foundry.dice.Roll.Options>,
	): Promise<DamageRoll.Evaluated<this>> {
		await super._evaluate(options);

		const primaryTerm = this.terms.find((t) => t instanceof PrimaryDie);

		if (primaryTerm) {
			if (this.options.canCrit) this.isCritical = primaryTerm.exploded;
			if (this.options.canMiss) this.isMiss = primaryTerm.isMiss;
		}

		return this as DamageRoll.Evaluated<this>;
	}

	override toJSON() {
		return {
			...super.toJSON(),
			data: this.data,
			originalFormula: this.originalFormula,
			isMiss: this.isMiss,
			isCritical: this.isCritical,
		};
	}

	/** ------------------------------------------------------ */
	/**                    Static Methods                      */
	/** ------------------------------------------------------ */
	static fromRoll(roll: any) {
		const newRoll = new DamageRoll(roll.formula, roll.data, roll.options);
		Object.assign(newRoll, roll);
		return newRoll;
	}

	static override fromData(data: Record<string, any>): DamageRoll {
		const roll = DamageRoll.fromData(data) as unknown as DamageRoll;

		roll.originalFormula = data.originalFormula;
		roll._formula = DamageRoll.getFormula(roll.terms);

		// Populate data
		if (data.evaluated ?? true) {
			roll.isCritical = data.options.isCritical;
			roll.isMiss = data.options.isMiss;
		}

		return roll as DamageRoll;
	}
}

export { DamageRoll };
