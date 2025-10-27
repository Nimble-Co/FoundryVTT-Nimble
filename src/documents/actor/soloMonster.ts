import type { NimbleSoloMonsterData } from '../../models/actor/SoloMonsterDataModel.js';
import CharacterMovementConfigDialog from '../../view/dialogs/CharacterMovementConfigDialog.svelte';
import NPCMetaConfigDialog from '../../view/dialogs/NPCMetaConfigDialog.svelte';
import { NimbleBaseActor } from './base.svelte.js';

export class NimbleSoloMonster extends NimbleBaseActor {
	declare system: NimbleSoloMonsterData;

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

		this.tags.add('solo-monster');
	}

	override prepareDerivedData() {
		super.prepareDerivedData();
	}

	async activateBloodiedFeature(options = {}) {
		const chatData = {
			author: game.user?.id,
			flavor: `${this?.name}: Bloodied`,
			speaker: ChatMessage.getSpeaker({ actor: this }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [],
			rollMode: options.visibilityMode ?? 'gmroll',
			system: {
				actorName: this.name,
				description: this.system.bloodiedEffect.description,
				image: 'icons/svg/blood.svg',
				name: 'Bloodied',
				permissions: this.permission,
			},
			type: 'feature',
		};

		ChatMessage.applyRollMode(
			chatData,
			options.visibilityMode ?? game.settings.get('core', 'rollMode'),
		);

		const chatCard = await ChatMessage.create(chatData);
		return chatCard ?? null;
	}

	async activateLastStandFeature(options = {}) {
		const chatData = {
			author: game.user?.id,
			flavor: `${this?.name}: Last Stand`,
			speaker: ChatMessage.getSpeaker({ actor: this }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [],
			rollMode: options.visibilityMode ?? 'gmroll',
			system: {
				actorName: this.name,
				description: this.system.lastStandEffect.description,
				image: 'icons/svg/skull.svg',
				name: 'Last Stand',
				permissions: this.permission,
			},
			type: 'feature',
		};

		ChatMessage.applyRollMode(chatData, options.visibilityMode ?? 'gmroll');

		const chatCard = await ChatMessage.create(chatData);
		return chatCard ?? null;
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
