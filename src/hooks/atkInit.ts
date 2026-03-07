const ATK_VERSION = 6;

interface AtkAction {
	id: string;
	name: string;
	raw: string;
	formula: string;
	rangeMin: number;
	rangeMax: number;
	isRanged: boolean;
	tag: string;
}

type RollResult = { rolls: number[]; rollObjs: Roll[] };

interface NimbleAtkWindow {
	_nimbleATKVersion?: number;
	_nimbleATKBtnHandler?: EventListener;
	_nimbleATKApplyHandler?: EventListener;
	_nimbleRollExploding?: (sides: number) => Promise<RollResult>;
	_nimbleShowCard?: (
		actorToken: Token,
		targetToken: Token | null,
		dist: number | null,
		armorType: string,
		actions: AtkAction[],
		title: string,
	) => void;
}

export default function registerAtkInitHook(): void {
	Hooks.on('ready', () => {
		const win = window as Window & NimbleAtkWindow;
		if (win._nimbleATKVersion === ATK_VERSION) return;

		if (win._nimbleATKBtnHandler) {
			document.removeEventListener('click', win._nimbleATKBtnHandler, { capture: true });
		}
		if (win._nimbleATKApplyHandler) {
			document.removeEventListener('click', win._nimbleATKApplyHandler, { capture: true });
		}

		win._nimbleATKVersion = ATK_VERSION;

		// ── Exploding dice helper ──────────────────────────────────────────────
		win._nimbleRollExploding = async (sides: number): Promise<RollResult> => {
			const rolls: number[] = [];
			const rollObjs: Roll[] = [];
			let face: number;
			do {
				const r = await new Roll(`1d${sides}`).evaluate();
				face = r.total as number;
				rolls.push(face);
				rollObjs.push(r);
			} while (face === sides);
			return { rolls, rollObjs };
		};

		// ── Floating card above token ──────────────────────────────────────────
		win._nimbleShowCard = (
			actorToken: Token,
			targetToken: Token | null,
			dist: number | null,
			armorType: string,
			actions: AtkAction[],
			title: string,
		): void => {
			document.getElementById('nimble-atk-card')?.remove();

			const sh = '\u{1F6E1}';
			const armorBadge =
				armorType === 'heavy'
					? ` <span style="color:#f80;font-size:0.8em">${sh}${sh} Heavy (half dmg, no mod)</span>`
					: armorType === 'medium'
						? ` <span style="color:#fc0;font-size:0.8em">${sh} Medium (no mod)</span>`
						: '';
			const targetLabel = targetToken
				? `Target: <strong>${targetToken.name}</strong> (${Math.round(dist!)} sq)${armorBadge}`
				: '<span style="color:#999"><em>No target found</em></span>';

			const btnsHtml = actions
				.map((a) => {
					const inRange = dist === null || (dist >= a.rangeMin && dist <= a.rangeMax);
					const icon = dist === null ? '' : inRange ? '\u2713 ' : '\u2717 ';
					const iconColor = dist !== null && !inRange ? 'color:#c55' : 'color:#7c7';
					return (
						`<button class="nimble-atk-btn"` +
						` data-formula="${a.formula}"` +
						` data-raw="${a.raw.replace(/"/g, '&quot;')}"` +
						` data-name="${a.name.replace(/"/g, '&quot;')}"` +
						` data-actor-id="${actorToken.id}"` +
						` data-target-id="${targetToken ? targetToken.id : ''}"` +
						` data-armor="${armorType}"` +
						` style="display:block;width:100%;margin:3px 0;padding:6px 8px;background:rgba(55,45,30,0.85);border:1px solid #554433;border-radius:4px;color:#ddd;cursor:pointer;text-align:left;">` +
						`<span style="${iconColor}">${icon}</span>` +
						`<strong>${a.name}</strong>` +
						` <span style="color:#998;font-size:0.88em">${a.formula} ${a.tag}</span>` +
						`</button>`
					);
				})
				.join('');

			const card = document.createElement('div');
			card.id = 'nimble-atk-card';
			card.style.cssText =
				'position:fixed;z-index:10000;background:rgba(16,13,10,0.97);border:1px solid #6a5a3a;border-radius:7px;padding:9px 11px;min-width:190px;max-width:300px;color:#ddd;box-shadow:0 5px 28px rgba(0,0,0,0.9);pointer-events:all;font-family:var(--font-primary,"Signika",serif);';
			card.innerHTML =
				`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #3a2f1e">` +
				`<span style="font-weight:bold;color:#c8a97e;font-size:0.9em">${title}</span>` +
				`<button class="nimble-atk-close-btn" style="background:none;border:none;color:#666;cursor:pointer;font-size:14px;padding:0 0 0 10px;line-height:1">\u2715</button>` +
				`</div>` +
				`<p style="margin:0 0 7px;font-size:0.85em">${targetLabel}</p>` +
				btnsHtml;

			document.body.appendChild(card);

			const t = (canvas.app as PIXI.Application).stage.worldTransform;
			const cx = actorToken.center.x;
			const cy = actorToken.center.y;
			const sx = cx * t.a + cy * t.c + t.tx;
			const sy = cx * t.b + cy * t.d + t.ty;
			const vr = (
				(canvas.app as PIXI.Application).view as HTMLCanvasElement
			).getBoundingClientRect();
			const screenX = vr.left + sx;
			const screenY = vr.top + sy;

			card.style.left = `${screenX}px`;
			card.style.top = `${screenY - 300}px`;

			requestAnimationFrame(() => {
				const r = card.getBoundingClientRect();
				const x = Math.max(8, Math.min(screenX - r.width / 2, window.innerWidth - r.width - 8));
				const y = Math.max(8, screenY - r.height - 28);
				card.style.left = `${x}px`;
				card.style.top = `${y}px`;
			});

			card.querySelector('.nimble-atk-close-btn')!.addEventListener('click', (e) => {
				e.stopPropagation();
				card.remove();
			});
			function onKey(e: KeyboardEvent) {
				if (e.key === 'Escape') {
					card.remove();
					document.removeEventListener('keydown', onKey);
				}
			}
			document.addEventListener('keydown', onKey);
		};

		// ── Action button click handler ────────────────────────────────────────
		const atkBtnHandler = async (e: Event): Promise<void> => {
			const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.nimble-atk-btn');
			if (!btn || btn.disabled) return;
			btn.disabled = true;
			btn.style.opacity = '0.5';
			document.getElementById('nimble-atk-card')?.remove();

			const actionName = btn.dataset.name!;
			const formula = btn.dataset.formula!;
			const rawFormula = btn.dataset.raw!;
			const actorTokId = btn.dataset.actorId!;
			const targTokId = btn.dataset.targetId!;
			const armorType = btn.dataset.armor ?? 'none';

			const actorToken = canvas.tokens?.get(actorTokId) ?? null;
			const targetToken = targTokId ? (canvas.tokens?.get(targTokId) ?? null) : null;
			if (!actorToken) {
				ui.notifications?.warn('Actor token no longer on scene.');
				return;
			}

			const diceMatch = formula.match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/);
			if (!diceMatch) {
				ui.notifications?.warn(`Cannot parse formula: ${formula}`);
				return;
			}

			const numDice = parseInt(diceMatch[1]);
			const sides = parseInt(diceMatch[2]);
			const modStr = (diceMatch[3] ?? '+0').replace(/\s/g, '');
			const mod = parseInt(modStr) || 0;
			const modDisplay = mod > 0 ? `+${mod}` : mod < 0 ? String(mod) : '';

			const allRolls: number[][] = [];
			const allRollObjs: Roll[] = [];
			for (let d = 0; d < numDice; d++) {
				const { rolls, rollObjs } = await win._nimbleRollExploding!(sides);
				allRolls.push(rolls);
				allRollObjs.push(...rollObjs);
			}

			const isMiss = numDice === 1 && allRolls[0][0] === 1 && allRolls[0].length === 1;
			const isExploded = allRolls.some((r) => r.length > 1);
			const rawTotal = allRolls.reduce((s, r) => s + r.reduce((a, v) => a + v, 0), 0);
			const rollDisplay = allRolls.map((r) => r.join(' \u2192 ')).join(', ');

			let total: number;
			let armorNote = '';
			if (isMiss) {
				total = 0;
			} else if (isExploded) {
				total = rawTotal + mod;
			} else if (armorType === 'heavy') {
				total = Math.floor(rawTotal / 2);
				armorNote = ` <span style="color:#aaa;font-size:0.85em">[\u{1F6E1}\u{1F6E1} Heavy: ${rawTotal}\u00F72\u202F=\u202F${total}]</span>`;
			} else if (armorType === 'medium') {
				total = rawTotal;
				armorNote = ` <span style="color:#aaa;font-size:0.85em">[\u{1F6E1} Medium: mod ignored]</span>`;
			} else {
				total = rawTotal + mod;
			}

			const showMod = armorType === 'none' || isExploded;
			const critNote = isExploded
				? ` <span style="color:#f80;font-size:0.85em">[CRIT \u2014 armor ignored]</span>`
				: armorNote;
			const flavor =
				`${actorToken.name} \u2014 ${actionName} (${rawFormula}): ` +
				(isMiss
					? 'MISS'
					: `${isExploded ? 'CRIT! ' : ''}${rollDisplay}${showMod ? modDisplay : ''} = ${total}`);

			await ChatMessage.create({
				rolls: allRollObjs,
				flavor,
				sound: CONFIG.sounds.dice,
				speaker: ChatMessage.getSpeaker({ token: actorToken.document as TokenDocument }),
			});

			if (!isMiss && targetToken) {
				await ChatMessage.create({
					content:
						`<button class="nimble-atk-apply" data-dmg="${total}" data-tid="${targTokId}" style="margin-top:2px">` +
						`&#9876;&#65039; Apply ${total} dmg to ${targetToken.name}</button>${critNote}`,
					whisper: [game.user.id as string],
					speaker: ChatMessage.getSpeaker({ token: actorToken.document as TokenDocument }),
				});
			}
		};
		win._nimbleATKBtnHandler = atkBtnHandler as EventListener;
		document.addEventListener('click', win._nimbleATKBtnHandler, { capture: true });

		// ── Apply damage button handler ────────────────────────────────────────
		const atkApplyHandler = async (e: Event): Promise<void> => {
			const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.nimble-atk-apply');
			if (!btn || btn.disabled) return;
			btn.disabled = true;
			btn.textContent = 'Applying\u2026';
			const total = parseInt(btn.dataset.dmg!);
			const tTok = canvas.tokens?.get(btn.dataset.tid!) ?? null;
			if (!tTok) {
				btn.textContent = 'Token not found';
				return;
			}
			const hp = (
				(tTok.actor as Actor).system as unknown as { attributes: { hp: { value: number } } }
			).attributes.hp;
			const newHp = Math.max(0, hp.value - total);
			await (tTok.actor as Actor).update({ 'system.attributes.hp.value': newHp } as Record<
				string,
				unknown
			>);
			btn.textContent = `\u2713 ${hp.value} \u2192 ${newHp} HP`;
		};
		win._nimbleATKApplyHandler = atkApplyHandler as EventListener;
		document.addEventListener('click', win._nimbleATKApplyHandler, { capture: true });
	});
}
