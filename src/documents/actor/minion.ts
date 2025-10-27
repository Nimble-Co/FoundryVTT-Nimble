import type { NimbleMinionData } from '../../models/actor/MinionDataModel.js';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';
import { NimbleBaseActor } from './base.svelte.js';
import NPCMetaConfigDialog from '../../view/dialogs/NPCMetaConfigDialog.svelte';

export class NimbleMinion extends NimbleBaseActor {
	declare system: NimbleMinionData;

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

		this.tags.add('minion');
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
