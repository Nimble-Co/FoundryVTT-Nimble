import type { NimbleMinionData } from '../../models/actor/MinionDataModel.js';
import CharacterMovementConfigDialog from '../../view/dialogs/CharacterMovementConfigDialog.svelte';
import NPCMetaConfigDialog from '../../view/dialogs/NPCMetaConfigDialog.svelte';
import { NimbleBaseActor } from './base.svelte.js';

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
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

		this.#dialogs.metaConfig ??= new GenericDialog(
			`${this.name}: Configuration`,
			NPCMetaConfigDialog,
			{ actor: this },
		);

		this.#dialogs.metaConfig.render(true);
	}

	async configureMovement() {
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

		this.#dialogs.configureMovement ??= new GenericDialog(
			`${this.name}: Configure Movement Speeds`,
			CharacterMovementConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-person-running', width: 600 },
		);

		await this.#dialogs.configureMovement.render(true);
	}
}
