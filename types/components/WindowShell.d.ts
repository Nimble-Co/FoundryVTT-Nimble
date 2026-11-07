import type { Component } from 'svelte';

export interface WindowShellDialog {
	/** the window title, kept in step with `setTitle` */
	headTitle: string;
	options: { window?: { icon?: string | false } };
	content: Component<Record<string, unknown>>;
}

export type WindowShellProps = { dialog: WindowShellDialog } & Record<string, unknown>;
