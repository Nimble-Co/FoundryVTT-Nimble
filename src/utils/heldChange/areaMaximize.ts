import type { HeldChange } from '#types/heldChange.d.ts';

interface Packet {
	value: number;
	options: { outcome?: string; damageMultiplier?: number; roll?: object | null };
}

interface RolledDie {
	faces?: number;
	results?: { result: number; active?: boolean; discarded?: boolean }[];
}

/**
 * The highest total of an evaluated roll: each die it kept at its highest face. The dice it
 * dropped (damage advantage) stay dropped.
 */
export function maxTotalOf(roll: object | null | undefined): number | null {
	if (!roll) return null;
	try {
		const rolled = Roll.fromData(roll as never) as unknown as {
			total?: number;
			dice?: RolledDie[];
		};
		let total = Number(rolled.total);
		if (!Number.isFinite(total)) return null;
		for (const die of rolled.dice ?? []) {
			const faces = Number(die.faces);
			if (!Number.isFinite(faces)) continue;
			for (const result of die.results ?? []) {
				if (result.active !== false && !result.discarded) total += faces - result.result;
			}
		}
		return total;
	} catch {
		return null;
	}
}

/** The packets of an area attack for the one target it maximizes. The others keep the rolled total. */
export function maximizedPackets<P extends Packet>(packets: readonly P[]): P[] {
	return packets.map((packet) => {
		const max = maxTotalOf(packet.options.roll);
		if (max === null) return packet;
		const half = packet.options.outcome === 'halfDamage' ? 0.5 : 1;
		const value = Math.ceil(max * half * (packet.options.damageMultiplier ?? 1));
		return { ...packet, value: Math.max(packet.value, value) };
	});
}

export type AreaMaximizeFor = (actor: object) => HeldChange | null;
