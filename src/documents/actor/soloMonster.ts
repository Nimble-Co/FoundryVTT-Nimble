import { addCardEvents, canHost } from '#utils/chat/cardEvents.js';
import type { NimbleSoloMonsterData } from '../../models/actor/SoloMonsterDataModel.js';
import toMessageMode from '../../utils/rolls/toMessageMode.js';
import CharacterMovementConfigDialog from '../../view/dialogs/CharacterMovementConfigDialog.svelte';
import NPCMetaConfigDialog from '../../view/dialogs/NPCMetaConfigDialog.svelte';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';
import { NimbleBaseActor } from './base.svelte.js';
import { buildMonsterPrototypeTokenDefaults } from './monsterPrototypeTokenDefaults.js';

type MonsterFeatureSubtype = 'bloodied' | 'lastStand';

/**
 * The phase as a line on the card whose Apply Damage caused it. The line is for the GMs, so only a
 * card that only GMs read can show it. False: the phase gets its own card.
 */
export async function phaseLineOnCard(
	actor: { uuid?: string | null; name?: string | null },
	subtype: MonsterFeatureSubtype,
	cardId?: string | null,
): Promise<boolean> {
	const card = cardId ? game.messages?.get(cardId) : null;
	if (!card || !canHost(card as never, { gmOnly: true })) return false;
	const at = Date.now();
	return addCardEvents(card as never, [
		{
			id: `healthState.${subtype}.${actor.uuid ?? ''}.${at}`,
			kind: 'healthState',
			icon: subtype === 'bloodied' ? 'fa-solid fa-droplet' : 'fa-solid fa-skull',
			text: { key: `NIMBLE.chat.events.healthState.${subtype}`, data: { name: actor.name ?? '' } },
			at,
		},
	]);
}

export class NimbleSoloMonster extends NimbleBaseActor<'soloMonster'> {
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

	protected override async _preCreate(
		data: Actor.CreateData,
		options: Actor.Database.PreCreateOptions,
		user: User.Stored,
		// biome-ignore lint/suspicious/noConfusingVoidType: Matching parent class signature
	): Promise<boolean | void> {
		// A solo monster is a single boss-tier creature, so its token is linked:
		// it persists as one tracked actor whose HP updates live, unlike the
		// unlinked NPC/minion tokens that each track their own HP.
		const prototypeToken = { ...buildMonsterPrototypeTokenDefaults(), actorLink: true };
		this.updateSource({ prototypeToken } as Record<string, unknown>);

		return super._preCreate(data, options, user);
	}

	override prepareDerivedData() {
		super.prepareDerivedData();

		const actorData = this.system;
		Object.entries(actorData.savingThrows).forEach(([_, save]) => {
			save.mod = save.bonus ?? 0;
		});
	}

	/**
	 * Look up the description prose for a phase by finding the matching monsterFeature
	 * item. This is the canonical storage location — every shipped legendary monster
	 * has a Bloodied and Last Stand item with the prose in its description field.
	 */
	#getPhaseDescription(subtype: MonsterFeatureSubtype): string {
		type MonsterFeatureView = { system?: { subtype?: string; description?: string } };
		const item = this.items.find((candidate) => {
			if (candidate.type !== 'monsterFeature') return false;
			return (candidate as unknown as MonsterFeatureView).system?.subtype === subtype;
		}) as MonsterFeatureView | undefined;
		return item?.system?.description ?? '';
	}

	async activateBloodiedFeature(
		options: { visibilityMode?: string; hostCardId?: string | null } = {},
	) {
		if (await phaseLineOnCard(this, 'bloodied', options.hostCardId)) return null;
		const chatData = {
			author: game.user?.id,
			flavor: `${this?.name}: Bloodied`,
			speaker: ChatMessage.getSpeaker({ actor: this as object as Actor }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [] as Roll[],
			system: {
				actorName: this.name,
				description: this.#getPhaseDescription('bloodied'),
				image: 'icons/svg/blood.svg',
				name: 'Bloodied',
				permissions: this.permission,
			},
			type: 'feature',
		};

		ChatMessage.applyMode(
			chatData as unknown as ChatMessage.CreateData,
			toMessageMode(options.visibilityMode ?? 'gmroll'),
		);

		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return chatCard ?? null;
	}

	async activateLastStandFeature(
		options: { visibilityMode?: string; hostCardId?: string | null } = {},
	) {
		if (await phaseLineOnCard(this, 'lastStand', options.hostCardId)) return null;
		const chatData = {
			author: game.user?.id,
			flavor: `${this?.name}: Last Stand`,
			speaker: ChatMessage.getSpeaker({ actor: this as object as Actor }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			rolls: [] as Roll[],
			whisper: ChatMessage.getWhisperRecipients('GM').map((u) => u.id) as string[],
			system: {
				actorName: this.name,
				description: this.#getPhaseDescription('lastStand'),
				image: 'icons/svg/combat.svg',
				name: 'Last Stand',
				permissions: this.permission,
			},
			type: 'feature',
		};

		ChatMessage.applyMode(
			chatData as unknown as ChatMessage.CreateData,
			toMessageMode(options.visibilityMode ?? 'gmroll'),
		);

		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return chatCard ?? null;
	}

	async editMetadata() {
		this.#dialogs.metaConfig ??= new GenericDialog(
			`${this.name}: Configuration`,
			NPCMetaConfigDialog,
			{ actor: this },
			{ classes: ['nimble-window'] },
		);

		this.#dialogs.metaConfig.setTitle(`${this.name}: Configuration`);
		this.#dialogs.metaConfig.render(true);
	}

	async configureMovement() {
		this.#dialogs.configureMovement ??= new GenericDialog(
			`${this.name}: Configure Movement Speeds`,
			CharacterMovementConfigDialog,
			{ document: this },
			{ classes: ['nimble-window'], icon: 'fa-solid fa-person-running', width: 600 },
		);

		this.#dialogs.configureMovement.setTitle(`${this.name}: Configure Movement Speeds`);
		await this.#dialogs.configureMovement.render(true);
	}
}
