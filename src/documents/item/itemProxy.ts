import { NimbleBaseItem } from './base.svelte';

export default new Proxy(NimbleBaseItem, {
	construct(_target, args) {
		const ItemCls = CONFIG.NIMBLE.Item.documentClasses[args[0]?.type] ?? NimbleBaseItem;
		return new ItemCls(...args);
	},
});
