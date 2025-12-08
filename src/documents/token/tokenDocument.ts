interface CombatantCreateData {
	type: string;
	tokenId: string;
	sceneId: string;
	actorId: string;
	hidden: boolean;
}

export class NimbleTokenDocument extends TokenDocument {
	static getCombatantType(_token: TokenDocument): string {
		return 'npc';
	}

	static override async createCombatants(
		tokens: TokenDocument[],
		{ combat }: { combat?: Combat | null } = {},
	): Promise<Combatant[]> {
		// Identify the target Combat encounter
		let targetCombat: Combat | undefined = combat ?? game.combats.viewed ?? undefined;

		if (!targetCombat) {
			if (game.user.isGM) {
				const cls = getDocumentClass('Combat');
				const sceneId = canvas.scene?.id;
				if (!sceneId) throw new Error('No active scene');
				targetCombat = await cls.create({ scene: sceneId, active: true }, { render: false });
			} else throw new Error(game.i18n.localize('COMBAT.NoneActive'));
		}

		if (!targetCombat) throw new Error('Could not create combat');

		// Add tokens to the Combat encounter
		const createData = new Set(tokens).reduce<CombatantCreateData[]>((arr, token) => {
			if (token.inCombat) return arr;

			let combatantType: string;

			switch (token.actor?.type) {
				case 'character':
					combatantType = 'character';
					break;
				case 'soloMonster':
					combatantType = 'soloMonster';
					break;
				default:
					combatantType = 'npc';
					break;
			}

			arr.push({
				type: combatantType,
				tokenId: token.id ?? '',
				sceneId: token.parent?.id ?? '',
				actorId: token.actorId ?? '',
				hidden: token.hidden ?? false,
			});

			return arr;
		}, []);

		const created = await targetCombat.createEmbeddedDocuments(
			'Combatant',
			createData as Combatant.CreateData[],
		);
		return created ?? [];
	}

	override getBarAttribute(
		barName: string,
		options?: { alternative?: string },
	): ReturnType<TokenDocument['getBarAttribute']> {
		const attribute = super.getBarAttribute(barName, options);
		if (!attribute) return null;

		const isMana = attribute.attribute === 'resources.mana';
		if (isMana) {
			attribute.editable = true;
		}

		return attribute;
	}
}
