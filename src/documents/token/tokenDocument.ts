export class NimbleTokenDocument extends TokenDocument {
	static getCombatantType(token): string {}

	static override async createCombatants(tokens, { combat }: { combat?: any } = {}) {
		// Identify the target Combat encounter
		combat ??= game.combats.viewed;

		if (!combat) {
			if (game.user.isGM) {
				const cls = getDocumentClass('Combat');
				combat = await cls.create({ scene: canvas.scene.id, active: true }, { render: false });
			} else throw new Error(game.i18n.localize('COMBAT.NoneActive'));
		}

		// Add tokens to the Combat encounter
		const createData = new Set(tokens).reduce((arr, token) => {
			if (token.inCombat) return arr;

			let combatantType: string;

			switch (token?.actor?.type) {
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
				tokenId: token.id,
				sceneId: token.parent.id,
				actorId: token.actorId,
				hidden: token.hidden,
			});

			return arr;
		}, []);

		return combat.createEmbeddedDocuments('Combatant', createData);
	}

	override getBarAttribute(barName: string, options) {
		const attribute = super.getBarAttribute(barName, options);
		if (!attribute) return null;

		const isMana = attribute.attribute === 'resources.mana';
		if (isMana) {
			attribute.editable = true;
		}

		return attribute;
	}
}
