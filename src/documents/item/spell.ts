import { SYSTEM_ID } from '#system';
import type { CostReceipt } from '#types/costReceipt.d.ts';
import type { ResolvedSpellCost, SpellCostFailure } from '#types/spellCost.d.ts';
import { CHAOS_INVOKED_FLAG, CHAOS_TICKED_FLAG, invokeChaos } from '#utils/chaos/invokeChaos.js';
import type { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import type { NimbleSpellData } from '../../models/item/SpellDataModel.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { receiptOf } from '../../utils/cost/costLedger.js';
import enrichDocumentHTML from '../../utils/documents/enrichDocumentHTML.js';
import localize from '../../utils/localize.js';
import confirmSpellOverdraft from '../../utils/spell/confirmSpellOverdraft.js';
import { paySpellCost } from '../../utils/spell/paySpellCost.js';
import { previewOverdraftDamage } from '../../utils/spell/spellCost.js';
import { NimbleBaseItem } from './base.svelte.js';

/** The Chaos Table rolls now: the cast invokes chaos and Feature Effects are on. */
function chaosRollsNow(manager: ItemActivationManager): boolean {
	return manager.invokesChaos && isRuleAutomationEnabled();
}

export class NimbleSpellItem extends NimbleBaseItem<'spell'> {
	declare system: NimbleSpellData;

	override _populateBaseTags() {
		super._populateBaseTags();

		if (this.system.school) this.tags.add(`school:${this.system.school}`);
		this.system.properties.selected?.forEach((p) => {
			this.tags.add(`property:${p}`);
		});

		if (!this.tags.has('property:utility')) this.tags.add(`tier:${this.system.tier}`);
	}

	override _populateDerivedTags() {
		super._populateDerivedTags();
	}

	protected override _useContext(manager: ItemActivationManager): Record<string, unknown> {
		return { upcast: manager.upcastResult };
	}

	/**
	 * The manager resolved what this cast costs (cantrips are free), against the
	 * tier actually cast. The seam decides whether the cost is mana or a
	 * class-declared pool, and honours the resource spending automation setting.
	 */
	protected override async _payForUse(manager: ItemActivationManager): Promise<CostReceipt | null> {
		if (this.system.tier <= 0 || !this.actor) return receiptOf();
		const spellCost: ResolvedSpellCost = manager.spellCost ?? { type: 'none' };
		const payment = await paySpellCost(this.actor, spellCost, {
			confirmOverdraft: (available) =>
				confirmSpellOverdraft({
					spellName: this.name,
					cost: spellCost,
					available,
					damage: previewOverdraftDamage(this.actor!, spellCost),
				}),
		});
		if (payment.paid) return payment.receipt ?? receiptOf();
		if (payment.failure) {
			const messageKeys: Record<SpellCostFailure['code'], string> = {
				poolMissing: 'NIMBLE.charges.notifications.poolMissing',
				insufficientCharges: 'NIMBLE.charges.notifications.insufficient',
				insufficientMana: CONFIG.NIMBLE.spellNotifications.insufficientMana,
			};
			ui.notifications?.error(
				localize(messageKeys[payment.failure.code], {
					item: this.name,
					pool: payment.failure.poolLabel,
					required: String(payment.failure.required),
					available: String(payment.failure.available),
				}),
			);
		}
		return null;
	}

	/** A healing spell with no target picked heals no one: the caster picks the target. */
	protected override _healsSelfWithNoTarget(): boolean {
		return false;
	}

	protected override async _afterUse(
		card: ChatMessage | null,
		manager: ItemActivationManager,
	): Promise<void> {
		if (card && chaosRollsNow(manager) && this.actor) {
			await invokeChaos(this.actor as never, card.id);
		}
	}

	override async prepareChatCardData(
		_options: ItemActivationManager.ActivationOptions = {},
		manager?: ItemActivationManager,
	) {
		const showDescription = this.system.activation.showDescription;
		const baseEffect = await enrichDocumentHTML(this.system.description.baseEffect, this);

		const higherLevelEffect = await enrichDocumentHTML(
			this.system.description.higherLevelEffect,
			this,
		);

		const upcastEffect = await enrichDocumentHTML(this.system.description.upcastEffect, this);

		return {
			...(manager?.invokesChaos
				? {
						flags: {
							[SYSTEM_ID]: {
								[chaosRollsNow(manager) ? CHAOS_INVOKED_FLAG : CHAOS_TICKED_FLAG]: true,
							},
						},
					}
				: {}),
			system: {
				actorName: this.actor?.name ?? game?.user?.name ?? '',
				description: {
					baseEffect: showDescription ? baseEffect : '',
					higherLevelEffect: showDescription ? higherLevelEffect : '',
					upcastEffect: showDescription ? upcastEffect : '',
				},
				img: this.img ?? 'icons/svg/explosion.svg',
				tier: this.system.tier,
				school: this.system.school,
				spellName: this.name,
				upcast: manager?.upcastResult,
			},
			type: 'spell',
		};
	}
}
