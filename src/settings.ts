import {App, Component, MarkdownRenderer, Modal, Plugin, PluginSettingTab} from 'obsidian';
import type {SettingDefinitionItem} from 'obsidian';
import {DMN_BLOCK_PARAMETERS} from "./parameters";

declare class ObsidianDmnPlugin extends Plugin {
    settings: ObsidianDmnPluginSettings;
}

export class ObsidianDmnPluginSettings {
    opendiagram_by_default: boolean = true;
    showzoom_by_default: boolean = true;
    enablepanzoom_by_default: boolean = true;
    height_by_default: number = 400;
    force_white_background_by_default: boolean = true;
    enable_minimap: boolean = true;
    enable_grid: boolean = true;
    enable_properties_panel: boolean = false;
}

export class DMNParameterInfoModal extends Modal {
    // Owns the rendered markdown; unloaded when the modal closes.
    private renderedComponent: Component;

    constructor(app: App) {
        super(app);
        this.renderedComponent = new Component();
    }

    onOpen() {
        let {contentEl} = this;
        contentEl.createEl("h1", {text: "DMN code block parameter"});
        let table = contentEl.createDiv()

        const markdown = [
            "| Parameter | Description | Values |",
            "|---|---|---|",
            ...DMN_BLOCK_PARAMETERS.map((p) => `| ${p.name} | ${p.description} | ${p.values} |`),
        ].join("\n");
        void MarkdownRenderer.render(this.app, markdown, table, ".", this.renderedComponent);
    }

    onClose() {
        this.renderedComponent.unload();
        let {contentEl} = this;
        contentEl.empty();
    }
}

export class ObsidianDmnPluginSettingsTab extends PluginSettingTab {
    plugin: ObsidianDmnPlugin;

    constructor(app: App, plugin: ObsidianDmnPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: "group",
                heading: "Defaults",
                items: [
                    {
                        name: "Default force white background",
                        desc: "Set the default for forcing a white background",
                        control: {type: "toggle", key: "force_white_background_by_default"},
                    },
                ],
            },
            {
                type: "group",
                heading: "Code block",
                items: [
                    {
                        name: "Default height",
                        desc: "Set the default height of the rendered DMN.",
                        control: {
                            type: "slider",
                            key: "height_by_default",
                            min: 200,
                            max: 1000,
                            step: 20,
                            // 1.13.1+; ignored by older builds.
                            displayFormat: (value) => String(value),
                        },
                    },
                    {
                        name: "Default show open diagram",
                        desc: "Set the default for showing the 'Open diagram' link",
                        control: {type: "toggle", key: "opendiagram_by_default"},
                    },
                    {
                        name: "Default show zoom buttons",
                        desc: "Set the default for showing the zoom buttons (for DRD)",
                        control: {type: "toggle", key: "showzoom_by_default"},
                    },
                    {
                        name: "Default enable pan zoom",
                        desc: "Set the default for enable pan & zoom",
                        control: {type: "toggle", key: "enablepanzoom_by_default"},
                    },
                    {
                        name: "DMN block parameters",
                        action: () => {
                            new DMNParameterInfoModal(this.app).open();
                        },
                    },
                ],
            },
            {
                type: "group",
                heading: "Modeler",
                items: [
                    {
                        name: "Enable minimap",
                        desc: "Add a minimap to the DRD view of the DMN modeler.",
                        control: {type: "toggle", key: "enable_minimap"},
                    },
                    {
                        name: "Enable grid",
                        desc: "Add a grid to the DRD view of the DMN modeler",
                        control: {type: "toggle", key: "enable_grid"},
                    },
                    {
                        name: "Enable properties panel",
                        desc: "Show a properties panel next to the DRD canvas to edit the selected element's standard DMN properties (name, id, type, description).",
                        control: {type: "toggle", key: "enable_properties_panel"},
                    },
                ],
            },
        ];
    }
}
