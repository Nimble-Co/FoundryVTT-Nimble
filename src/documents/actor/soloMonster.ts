import type { NimbleSoloMonsterData } from '../../models/actor/SoloMonsterDataModel.js';
import CharacterMovementConfigDialog from '../../view/dialogs/CharacterMovementConfigDialog.svelte';
import NPCMetaConfigDialog from '../../view/dialogs/NPCMetaConfigDialog.svelte';
import { NimbleBaseActor } from './base.svelte.js';

// Interface for feature activation options
interface FeatureActivationOptions {
	visibilityMode?: string;
}

export class NimbleSoloMonster extends NimbleBaseActor {
	declare system: NimbleSoloMonsterData;

	#dialogs: Record<string, unknown>;

	constructor(
		data?: Actor.CreateData,
		context?: foundry.abstract.Document.ConstructionContext<Actor.Parent>,
	) {
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

	async activateBloodiedFeature(
		options: FeatureActivationOptions = {},
	): Promise<ChatMessage | null> {
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
		} as Record<string, unknown>;

		ChatMessage.applyRollMode(
			chatData as ChatMessage.CreateData,
			(options.visibilityMode ??
				game.settings.get('core', 'rollMode')) as foundry.CONST.DICE_ROLL_MODES,
		);

		const chatCard = await ChatMessage.create(chatData as ChatMessage.CreateData);
		return chatCard ?? null;
	}

	async activateLastStandFeature(
		options: FeatureActivationOptions = {},
	): Promise<ChatMessage | null> {
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
		} as Record<string, unknown>;

		ChatMessage.applyRollMode(
			chatData as ChatMessage.CreateData,
			(options.visibilityMode ?? 'gmroll') as foundry.CONST.DICE_ROLL_MODES,
		);

		const chatCard = await ChatMessage.create(chatData as ChatMessage.CreateData);
		return chatCard ?? null;
	}

	async editMetadata(): Promise<void> {
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

		this.#dialogs.metaConfig ??= new GenericDialog(
			`${this.name}: Configuration`,
			NPCMetaConfigDialog,
			{ actor: this },
		);

		const dialog = this.#dialogs.metaConfig as { render(force?: boolean): void };
		dialog.render(true);
	}

	async configureMovement(): Promise<void> {
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

		this.#dialogs.configureMovement ??= new GenericDialog(
			`${this.name}: Configure Movement Speeds`,
			CharacterMovementConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-person-running', width: 600 },
		);

		const dialog = this.#dialogs.configureMovement as { render(force?: boolean): Promise<void> };
		await dialog.render(true);
	}
}
