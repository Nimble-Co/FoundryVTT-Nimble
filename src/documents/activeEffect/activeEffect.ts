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
class NimbleActiveEffect extends ActiveEffect {
	override prepareBaseData() {
		super.prepareBaseData();

		if (this.showIcon === CONST.ACTIVE_EFFECT_SHOW_ICON.CONDITIONAL) {
			this.showIcon = CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS;
		}
	}
}

export { NimbleActiveEffect };
