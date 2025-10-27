import type { NimbleNPCData } from '../../models/actor/NPCDataModel.js';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';
import NPCMetaConfigDialog from '../../view/dialogs/NPCMetaConfigDialog.svelte';
import { NimbleBaseActor } from './base.svelte.js';

export class NimbleNPC extends NimbleBaseActor {
	declare system: NimbleNPCData;

	#dialogs: Record<string, any>;

	constructor(data, context) {
		super(data, context);

		this.#dialogs = {};
	}

	/** ------------------------------------------------------ */
	/**                 Data Prep Functions                    */
	/** ------------------------------------------------------ */
	override prepareBaseData() {
		super.prepareBaseData();
	}

	override prepareDerivedData() {
		super.prepareDerivedData();
	}

	async editMetadata() {
		this.#dialogs.metaConfig ??= new GenericDialog(
			`${this.name}: Configuration`,
			NPCMetaConfigDialog,
			{ actor: this },
		);

		this.#dialogs.metaConfig.render(true);
	}
}
