<script>
    import localize from "../../utils/localize.js";

    function isCurrentTab() {
        if (!currentTab?.name) return index === 0;
        if (tab.name === currentTab.name) return true;

        return false;
    }

    let { currentTab = $bindable(), index, tab } = $props();
</script>

<li class="nimble-secondary-navigation-list__item">
    <button
        class="nimble-secondary-navigation-list__button"
        class:nimble-secondary-navigation-list__button--active={isCurrentTab()}
        type="button"
        data-tooltip={localize(tab.tooltip)}
        data-tooltip-direction="UP"
        aria-label={localize(tab.tooltip)}
        onclick={() => (currentTab = tab)}
    >
        <i class={tab.icon}></i>
        {localize(tab.label ?? "")}
    </button>
</li>
