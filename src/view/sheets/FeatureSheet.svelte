<script>
    import { setContext } from "svelte";
    import localize from "../../utils/localize.js";
    import updateDocumentImage from "../handlers/updateDocumentImage.js";

    import Editor from "./components/Editor.svelte";
    import ItemActivationConfigTab from "./pages/ItemActivationConfigTab.svelte";
    import ItemHeader from "./components/ItemHeader.svelte";
    import ItemMacroTab from "./pages/ItemMacroTab.svelte";
    import ItemRulesTab from "./pages/ItemRulesTab.svelte";
    import PrimaryNavigation from "../components/PrimaryNavigation.svelte";
    import TagGroup from "../components/TagGroup.svelte";
    import { ItemActivationManager } from "../../managers/ItemActivationManager.js";

    function getFeatureTypeOptions() {
        return Object.entries(featureTypes).map(([key, featureType]) => ({
            label: featureType,
            value: key,
        }));
    }

    function updateFeatureType(newSelection) {
        item.update({
            "system.featureType": newSelection,
        });
    }

    const { featureTypes } = CONFIG.NIMBLE;

    let { item, sheet } = $props();

    const navigation = [
        {
            component: descriptionTab,
            icon: "fa-solid fa-file-lines",
            tooltip: "Description",
            name: "description",
        },
        {
            component: configTab,
            icon: "fa-solid fa-gears",
            tooltip: "Config",
            name: "config",
        },
        {
            component: activationConfigTab,
            icon: "fa-solid fa-play",
            tooltip: "Activation",
            name: "activationConfig",
        },
        {
            component: rulesTab,
            icon: "fa-solid fa-bolt",
            tooltip: "Rules",
            name: "rules",
        },
        {
            component: macroTab,
            icon: "fa-solid fa-terminal",
            tooltip: "Macro",
            name: "macro",
        },
    ];

    let currentTab = $state(navigation[0]);

    setContext("document", item);
    setContext("application", sheet);
</script>

{#snippet activationConfigTab()}
    <ItemActivationConfigTab></ItemActivationConfigTab>
{/snippet}

{#snippet configTab()}
    <section class="nimble-sheet__body nimble-sheet__body--item">
        <div>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Identifier
                </h3>
            </header>

            <input
                type="text"
                value={item.reactive.identifier || ""}
                onchange={({ target }) =>
                    item.update({ "system.identifier": target.value })}
            />
        </div>

        <div>
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Feature Type
                </h3>
            </header>

            <TagGroup
                options={getFeatureTypeOptions()}
                selectedOptions={[item.reactive.system.featureType]}
                toggleOption={updateFeatureType}
            />
        </div>

        {#if item.reactive.system.featureType === "class"}
            <div>
                <header class="nimble-section-header">
                    <h3 class="nimble-heading">Class Identifier</h3>
                </header>

                <input
                    type="text"
                    value={item.reactive.system.class || ""}
                    onchange={({ target }) =>
                        item.update({ "system.class": target.value })}
                />
            </div>
        {/if}
    </section>
{/snippet}

{#snippet descriptionTab()}
    {#key item.reactive.system.description}
        <section class="nimble-sheet__body nimble-sheet__body--item">
            <header class="nimble-section-header">
                <h3 class="nimble-heading" data-heading-variant="section">
                    Description
                </h3>
            </header>

            <Editor
                field="system.description"
                content={item.reactive.system.description}
                document={item}
            />
        </section>
    {/key}
{/snippet}

{#snippet macroTab()}
    <ItemMacroTab></ItemMacroTab>
{/snippet}

{#snippet rulesTab()}
    <ItemRulesTab></ItemRulesTab>
{/snippet}

<header class="nimble-sheet__header nimble-sheet__header--item">
    <section class="nimble-icon">
        <button
            class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small"
            type="button"
            aria-label={localize("NIMBLE.prompts.changeFeatureImage")}
            data-tooltip="NIMBLE.prompts.changeFeatureImage"
            onclick={(event) =>
                updateDocumentImage(item, { shiftKey: event.shiftKey })}
        >
            <img
                class="nimble-icon__image"
                src={item.reactive?.img}
                alt={item.reactive.name}
            />
        </button>
    </section>

    <ItemHeader {item} placeholder="Feature Name" />
</header>

<PrimaryNavigation bind:currentTab {navigation} />

{@render currentTab.component()}
