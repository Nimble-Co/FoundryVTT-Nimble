import * as svelte from "svelte";

interface SvelteApplicationRenderContext {
  /** State data tracked by the root component: objects herein must be plain object. */
  state: object;
  /** This application instance */
  foundryApp: SvelteApplication;
}

function SvelteApplicationMixin(Base) {
  abstract class SvelteApplication extends Base {
    #customHTMLTags = Object.values(foundry.applications.elements).reduce(
      (acc, E) => {
        const { tagName } = E;
        if (!tagName) return acc;
        acc.push(tagName.toUpperCase());
        return acc;
      },
      [] as string[],
    );

    static override DEFAULT_OPTIONS = {
      classes: ["a5e"],
    };

    protected abstract root: svelte.Component<any>;

    protected $state = $state({});

    #mount: object = {};

    protected override async _renderHTML(context: any) {
      return context;
    }

    protected override _replaceHTML(
      result: SvelteApplicationRenderContext,
      content: HTMLElement,
      options: any,
    ) {
      Object.assign(this.$state, result.state);
      if (options.isFirstRender) {
        this.#mount = svelte.mount(this.root, {
          target: content,
          props: { ...result, state: this.$state },
        });
      }
    }

    protected override _onClose(options: any) {
      super._onClose(options);
      svelte.unmount(this.#mount, { outro: true });
    }

    override _onChangeForm(
      formConfig: foundry.applications.api.ApplicationV2.FormConfiguration,
      event: Event | SubmitEvent,
    ) {
      super._onChangeForm(formConfig, event);

      if (event.type !== "change") return;
      if (!this.document) return;

      const { target } = event;
      if (!target) return;

      // @ts-expect-error
      if (!this.#customHTMLTags.includes(target.tagName)) return;

      // @ts-expect-error
      const value = target._getValue();

      // @ts-expect-error
      this.document.update({ [target.name]: value });
    }
  }

  return SvelteApplication;
}

type SvelteApplication = InstanceType<
  ReturnType<typeof SvelteApplicationMixin>
>;

export { SvelteApplicationMixin, type SvelteApplicationRenderContext };
