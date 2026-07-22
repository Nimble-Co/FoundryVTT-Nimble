import type { NimbleNPCData } from '../../models/actor/NPCDataModel.js';
import CharacterMovementConfigDialog from '../../view/dialogs/CharacterMovementConfigDialog.svelte';
import NPCMetaConfigDialog from '../../view/dialogs/NPCMetaConfigDialog.svelte';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';
import { NimbleBaseActor } from './base.svelte.js';
import { buildMonsterPrototypeTokenDefaults } from './monsterPrototypeTokenDefaults.js';

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

	protected override async _preCreate(
		data: Actor.CreateData,
		options: Actor.Database.PreCreateOptions,
		user: User.Implementation,
		// biome-ignore lint/suspicious/noConfusingVoidType: Matching parent class signature
	): Promise<boolean | void> {
		this.updateSource({ prototypeToken: buildMonsterPrototypeTokenDefaults() } as Record<
			string,
			unknown
		>);

		return super._preCreate(data, options, user);
	}

	override prepareDerivedData() {
		super.prepareDerivedData();

		const actorData = this.system;
		Object.entries(actorData.savingThrows).forEach(([_, save]) => {
			save.mod = save.bonus ?? 0;
		});
	}

	async editMetadata() {
		this.#dialogs.metaConfig ??= new GenericDialog(
			`${this.name}: Configuration`,
			NPCMetaConfigDialog,
			{ actor: this },
		);

		this.#dialogs.metaConfig.setTitle(`${this.name}: Configuration`);
		this.#dialogs.metaConfig.render(true);
	}

	async configureMovement() {
		this.#dialogs.configureMovement ??= new GenericDialog(
			`${this.name}: Configure Movement Speeds`,
			CharacterMovementConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-person-running', width: 600 },
		);

		this.#dialogs.configureMovement.setTitle(`${this.name}: Configure Movement Speeds`);
		await this.#dialogs.configureMovement.render(true);
	}
}
