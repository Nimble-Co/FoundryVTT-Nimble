import type { AnyObject, DeepPartial } from 'fvtt-types/utils';
import * as svelte from 'svelte';

interface SvelteApplicationRenderContext {
	/** State data tracked by the root component: objects herein must be plain object. */
	state: object;
	/** This application instance */
	foundryApp: SvelteApplication;
}

/**
 * Augment an Application class with Svelte template rendering behavior.
 * Note: TypeScript requires mixin classes to have constructors with `...args: any[]`
 * per TS2545. This follows the same pattern used by fvtt-types' HandlebarsApplicationMixin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SvelteApplicationMixin<
	T extends abstract new (
		...args: any[]
	) => foundry.applications.api.ApplicationV2,
>(Base: T) {
	abstract class SvelteApplication extends Base {
		#customHTMLTags = Object.values(foundry.applications.elements).reduce((acc, E) => {
			const element = E as { tagName?: string };
			const { tagName } = element;
			if (!tagName) return acc;
			acc.push(tagName.toUpperCase());
			return acc;
		}, [] as string[]);

		static DEFAULT_OPTIONS = {
			classes: ['a5e'],
		};

		protected abstract root: svelte.Component<Record<string, never>>;

		protected $state = $state({});

		#mount: object = {};

		protected override async _renderHTML(context: AnyObject) {
			return context;
		}

		protected override _replaceHTML(
			result: SvelteApplicationRenderContext,
			content: HTMLElement,
			options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions>,
		) {
			Object.assign(this.$state, result.state);
			// Mount on first render OR if content was cleared (Firefox edge case)
			if (options.isFirstRender || content.childElementCount === 0) {
				// Unmount existing component if present to prevent memory leaks
				if (this.#mount && Object.keys(this.#mount).length > 0) {
					try {
						svelte.unmount(this.#mount);
					} catch {
						// Ignore unmount errors if component was already destroyed
					}
				}
				this.#mount = svelte.mount(this.root, {
					target: content,
					props: { ...result, state: this.$state } as object as Record<string, never>,
				});
			}
		}

		protected override _onClose(
			options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions>,
		) {
			super._onClose(options);
			svelte.unmount(this.#mount, { outro: true });
		}

		protected override _onChangeForm(
			formConfig: foundry.applications.api.ApplicationV2.FormConfiguration,
			event: Event | SubmitEvent,
		) {
			super._onChangeForm(formConfig, event);

			if (event.type !== 'change') return;
			if (!(this as object as { document?: { update(data: object): void } }).document) return;

			const { target } = event;
			if (!target) return;

			const htmlTarget = target as HTMLElement & {
				tagName: string;
				name: string;
				_getValue(): unknown;
			};
			if (!this.#customHTMLTags.includes(htmlTarget.tagName)) return;

			const value = htmlTarget._getValue();

			(this as object as { document: { update(data: object): void } }).document.update({
				[htmlTarget.name]: value,
			});
		}

		override close(
			options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
		): Promise<this> {
			return super.close(options);
		}
	}

	return SvelteApplication;
}

type SvelteApplication = InstanceType<ReturnType<typeof SvelteApplicationMixin>>;

export { SvelteApplicationMixin, type SvelteApplicationRenderContext, type SvelteApplication };
