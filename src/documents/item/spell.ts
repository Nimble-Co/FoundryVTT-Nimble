import { SYSTEM_ID } from '#system';
import type { UseSpend } from '#types/costReceipt.d.ts';
import type { ResolvedSpellCost, SpellCostFailure } from '#types/spellCost.d.ts';
import { CHAOS_INVOKED_FLAG, CHAOS_TICKED_FLAG, invokeChaos } from '#utils/chaos/invokeChaos.js';
import type { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import type { NimbleSpellData } from '../../models/item/SpellDataModel.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import confirmUsingBeyond from '../../utils/cost/confirmUsingBeyond.js';
import enrichDocumentHTML from '../../utils/documents/enrichDocumentHTML.js';
import localize from '../../utils/localize.js';
import confirmSpellOverdraft from '../../utils/spell/confirmSpellOverdraft.js';
import { previewOverdraftDamage } from '../../utils/spell/spellCost.js';
import { spendCastCosts } from '../../utils/spell/spendCastCosts.js';
import { NimbleBaseItem } from './base.svelte.js';

interface Caster {
	activateItem(id: string, options: ItemActivationManager.ActivationOptions): Promise<unknown>;
}

/** Cast the spell again at the same tier, free of mana, as an option asked. */
async function castFreeCopy(spell: NimbleSpellItem, manager: ItemActivationManager): Promise<void> {
	const { id } = spell;
	const actor = spell.actor as Caster | null;
	if (!id || !actor) return;
	const upcast = manager.upcastResult;
	await actor.activateItem(id, {
		fastForward: true,
		free: {
			of: ['mana'],
			reason: {
				key: 'NIMBLE.rules.useItemFree.cardLine',
				data: {
					trigger: { key: 'NIMBLE.useOptions.copyReason' },
					feature: manager.chosenOptions.freeCopy,
				},
			},
		},
		...(upcast
			? { upcast: { manaToSpend: upcast.manaSpent, choiceIndex: upcast.choiceIndex } }
			: {}),
	});
}

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

	/** `manaSpent`: the mana the cast spends on the spell. An option's mana is not in it. */
	protected override _useContext(manager: ItemActivationManager): Record<string, unknown> {
		return { upcast: manager.upcastResult, manaSpent: manager.castManaSpent };
	}

	/**
	 * The manager resolved what this cast costs (cantrips are free), against the
	 * tier actually cast. The seam decides whether the cost is mana or a
	 * class-declared pool, and honours the resource spending automation setting.
	 * The Spend or Sacrifice costs and the options turned on are checked and spent
	 * in the same step.
	 */
	protected override async _spendForUse(manager: ItemActivationManager): Promise<UseSpend | null> {
		if (!this.actor) return { receipts: [], taken: [], beyond: [] };
		const actor = this.actor;
		const spellCost: ResolvedSpellCost =
			this.system.tier > 0 ? (manager.spellCost ?? { type: 'none' }) : { type: 'none' };
		const payment = await spendCastCosts(actor, spellCost, {
			confirmOverdraft: (available) =>
				confirmSpellOverdraft({
					spellName: this.name,
					cost: spellCost,
					available,
					damage: previewOverdraftDamage(actor, spellCost),
				}),
			costs: [...manager.resourceCosts, ...manager.chosenOptions.costs],
			pools: manager.chosenOptions.pools,
			confirmBeyond: (costs) => confirmUsingBeyond(actor, costs),
		});
		if (payment.paid) {
			return {
				receipts: [...(payment.receipt ? [payment.receipt] : []), ...(payment.receipts ?? [])],
				taken: payment.taken ?? [],
				beyond: payment.beyond ?? [],
			};
		}
		if (payment.notice) ui.notifications?.error(payment.notice);
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
		if (manager.chosenOptions.freeCopy) await castFreeCopy(this, manager);
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
				castManaSpent: manager?.castManaSpent ?? 0,
				optionNotes: manager?.chosenOptions.notes ?? [],
			},
			type: 'spell',
		};
	}
}
