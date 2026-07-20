/**
 * Every enabled Active Effect renders on the token, not only the
 * duration/status-bearing ones core considers temporary. Hidden effects
 * are a trap: the player and GM must always be able to see that an
 * effect (a toggle, a banked reduction, a granted buff) is present.
 *
 * V14 tokens draw status icons from `Actor#appliedEffects` filtered by the
 * AE V2 `showIcon` field, whose core default (CONDITIONAL) hides any effect
 * without a temporary duration. Defaulting new effects to ALWAYS restores
 * visibility for every system- and user-created effect while still letting
 * an explicit showIcon choice (e.g. NEVER in the effect config) stand.
 */
class NimbleActiveEffect extends ActiveEffect {
	override async _preCreate(
		data: ActiveEffect.CreateData,
		options: ActiveEffect.Database.PreCreateOptions,
		user: User.Stored,
	) {
		if (data.showIcon === undefined) {
			this.updateSource({ showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS });
		}

		return super._preCreate(data, options, user);
	}
}

export { NimbleActiveEffect };
