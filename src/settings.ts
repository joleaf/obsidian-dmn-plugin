import {App, Plugin, PluginSettingTab, Setting} from 'obsidian';

declare class ObsidianDmnPlugin extends Plugin {
    settings: ObsidianDmnPluginSettings;
}

export class ObsidianDmnPluginSettings {
    readonly_by_default: boolean = true;
    opendiagram_by_default: boolean = true;
    showzoom_by_default: boolean = true;
    height_by_default: number = 400;
    force_white_background_by_default: boolean = true;
}

export class ObsidianDmnPluginSettingsTab extends PluginSettingTab {
    plugin: ObsidianDmnPlugin;

    constructor(app: App, plugin: ObsidianDmnPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Default height")
            .setDesc("Set the default height of the rendered DMN. Adjust this inline with e.g., `\"height\":600`")
            .addSlider(slider => slider.setValue(this.plugin.settings.height_by_default)
                .onChange((value) => {
                    this.plugin.settings.height_by_default = value;
                    this.plugin.saveData(this.plugin.settings);
                }).setLimits(300, 1000, 20)
                .setDynamicTooltip()
            );

        new Setting(containerEl)
            .setName("Default show open diagram")
            .setDesc("Set the default for showing the 'Open diagram' link")
            .addToggle(toggle => toggle.setValue(this.plugin.settings.opendiagram_by_default)
                .onChange((value) => {
                    this.plugin.settings.opendiagram_by_default = value;
                    this.plugin.saveData(this.plugin.settings);
                }));

        new Setting(containerEl)
            .setName("Default show zoom buttons")
            .setDesc("Set the default for showing the zoom buttons (for DRD)")
            .addToggle(toggle => toggle.setValue(this.plugin.settings.showzoom_by_default)
                .onChange((value) => {
                    this.plugin.settings.showzoom_by_default = value;
                    this.plugin.saveData(this.plugin.settings);
                }));

        new Setting(containerEl)
            .setName("Default force white background")
            .setDesc("Set the default for forcing a white background")
            .addToggle(toggle => toggle.setValue(this.plugin.settings.force_white_background_by_default)
                .onChange((value) => {
                    this.plugin.settings.force_white_background_by_default = value;
                    this.plugin.saveData(this.plugin.settings);
                }));

    }
}