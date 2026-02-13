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

		const actorData = this.system;
		Object.entries(actorData.savingThrows).forEach(([_, save]) => {
			save.mod = save.bonus ?? 0;
		});
	}

	async activateBloodiedFeature(options: { visibilityMode?: string } = {}) {
		type SoloMonsterSystem = NimbleSoloMonsterData & {
			bloodiedEffect?: { description: string };
		};
		const chatData = {
			author: game.user?.id,
			flavor: `${this?.name}: Bloodied`,
			speaker: ChatMessage.getSpeaker({ actor: this }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [] as Roll[],
			rollMode: options.visibilityMode ?? 'gmroll',
			system: {
				actorName: this.name,
				description: (this.system as SoloMonsterSystem).bloodiedEffect?.description ?? '',
				image: 'icons/svg/blood.svg',
				name: 'Bloodied',
				permissions: this.permission,
			},
			type: 'feature',
		};

		ChatMessage.applyRollMode(
			chatData as unknown as ChatMessage.CreateData,
			(options.visibilityMode ??
				game.settings.get('core', 'rollMode')) as foundry.CONST.DICE_ROLL_MODES,
		);

		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return chatCard ?? null;
	}

	async activateLastStandFeature(options: { visibilityMode?: string } = {}) {
		type SoloMonsterSystem = NimbleSoloMonsterData & {
			lastStandEffect?: { description: string };
		};
		const chatData = {
			author: game.user?.id,
			flavor: `${this?.name}: Last Stand`,
			speaker: ChatMessage.getSpeaker({ actor: this }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [] as Roll[],
			rollMode: options.visibilityMode ?? 'gmroll',
			system: {
				actorName: this.name,
				description: (this.system as SoloMonsterSystem).lastStandEffect?.description ?? '',
				image: 'icons/svg/skull.svg',
				name: 'Last Stand',
				permissions: this.permission,
			},
			type: 'feature',
		};

		ChatMessage.applyRollMode(
			chatData as unknown as ChatMessage.CreateData,
			(options.visibilityMode ?? 'gmroll') as foundry.CONST.DICE_ROLL_MODES,
		);

		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return chatCard ?? null;
	}

	async editMetadata() {
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

		this.#dialogs.metaConfig ??= new GenericDialog(
			`${this.name}: Configuration`,
			NPCMetaConfigDialog,
			{ actor: this },
		);

		this.#dialogs.metaConfig.setTitle(`${this.name}: Configuration`);
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

		this.#dialogs.configureMovement.setTitle(`${this.name}: Configure Movement Speeds`);
		await this.#dialogs.configureMovement.render(true);
	}
}
