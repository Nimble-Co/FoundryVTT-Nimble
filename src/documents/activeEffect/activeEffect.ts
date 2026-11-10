import { RulesManager } from '#managers/RulesManager.js';
import {
	type EffectSource,
	isUnclaimedBaseEffect,
} from '../../models/activeEffect/isUnclaimedBaseEffect.js';
import {
	LEGACY_CONDITION_EFFECT_TYPE,
	NIMBLE_EFFECT_TYPE,
} from '../../models/activeEffect/nimbleEffectChoices.js';

class NimbleActiveEffect extends ActiveEffect {
	declare rules: RulesManager;

	/** New effects are Nimble effects: the legacy type stays loadable, and `base` would become Nimble on create anyway. */
	static override async createDialog<
		Options extends ActiveEffect.CreateDialogOptions | undefined = undefined,
	>(
		data: ActiveEffect.CreateDialogData | undefined,
		createOptions: ActiveEffect.Database.CreateDocumentsOperation,
		options?: Options,
		renderOptions?: Parameters<typeof ActiveEffect.createDialog>[3],
	): Promise<ActiveEffect.CreateDialogReturn<Options>> {
		const types = (options?.types ?? NimbleActiveEffect.TYPES).filter(
			(type) => type !== LEGACY_CONDITION_EFFECT_TYPE && type !== CONST.BASE_DOCUMENT_TYPE,
		);
		return ActiveEffect.createDialog(
			data,
			createOptions,
			{ ...options, types } as Options,
			renderOptions,
		);
	}

	/**
	 * Every enabled Active Effect renders on the token, not only the
	 * duration/status-bearing ones core considers temporary. Hidden effects
	 * are a trap: the player and GM must always be able to see that an
	 * effect (a toggle, a banked reduction, a granted buff) is present.
	 *
	 * V14 tokens draw status icons from `Actor#appliedEffects` filtered by the
	 * AE V2 `showIcon` field, whose default (CONDITIONAL) shows an icon only
	 * while the effect has a temporary duration. Promoting CONDITIONAL to
	 * ALWAYS during data preparation, rather than stamping it at creation,
	 * covers the effects a creation-time hook cannot reach: those stored
	 * before the V14 upgrade, whose source carries no `showIcon` at all and so
	 * initializes to the schema default, and those created inside a parent
	 * document's data, which never run their own `_preCreate`.
	 *
	 * An explicit NEVER is left alone, so deliberately hiding an icon in the
	 * effect config still works.
	 */
	override prepareBaseData() {
		super.prepareBaseData();

		if (this.showIcon === CONST.ACTIVE_EFFECT_SHOW_ICON.CONDITIONAL) {
			this.showIcon = CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS;
		}

		this.rules = new RulesManager(this);
	}

	/**
	 * Core's type field always starts as `base`, so an effect created without a
	 * type (from a core sheet, a status entry another package added, or a
	 * macro) becomes a Nimble effect here. Core requires a forced replacement
	 * of `system` to change the type; the changes carry over.
	 */
	protected override async _preCreate(
		data: ActiveEffect.CreateData,
		options: ActiveEffect.Database.PreCreateOptions,
		user: User.Stored,
		// biome-ignore lint/suspicious/noConfusingVoidType: Matching parent class signature
	): Promise<boolean | void> {
		const allowed = await super._preCreate(data, options, user);
		if (allowed === false) return false;

		const source = this._source as EffectSource;
		if (!isUnclaimedBaseEffect(source)) return allowed;

		this.updateSource({
			type: NIMBLE_EFFECT_TYPE,
			system: foundry.data.operators.ForcedReplacement.create({
				changes: source.system?.changes ?? [],
			}),
		} as unknown as ActiveEffect.UpdateData);
		return allowed;
	}
}

export { NimbleActiveEffect };
