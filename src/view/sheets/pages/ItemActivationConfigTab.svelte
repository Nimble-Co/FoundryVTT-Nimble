<script>
    import { getContext, onDestroy, setContext } from "svelte";

    import ItemActivationCoreConfigTab from "./ItemActivationCoreConfigTab.svelte";
    import ItemActivationEffectsConfigTab from "./ItemActivationEffectsConfigTab.svelte";
    import ItemActivationTargetConfigTab from "./ItemActivationTargetConfigTab.svelte";
    import SecondaryNavigation from "../../components/SecondaryNavigation.svelte";

    const subNavigation = [
        {
            component: ItemActivationCoreConfigTab,
            label: "Core",
            name: "coreConfig",
        },
        {
            component: ItemActivationTargetConfigTab,
            label: "Targets",
            name: "targetConfig",
        },
        {
            component: ItemActivationEffectsConfigTab,
            label: "Effects",
            name: "effectsConfig",
        },
    ];

    let application = getContext("application");
    let currentTab = $state(subNavigation[0]);

    $effect(() => {
        if (currentTab.label === "Effects") {
            application.setPosition({ width: 464 });
        } else {
            application.setPosition({ width: 288 });
        }
    });

    onDestroy(() => {
        application.setPosition({ width: 288 });
    });
</script>

<SecondaryNavigation bind:currentTab {subNavigation} />

<section class="nimble-sheet__body nimble-sheet__body--item">
    {@render currentTab?.component?.()}
</section>
