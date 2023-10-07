import {Plugin, parseYaml, WorkspaceLeaf, setIcon} from "obsidian";
import {ObsidianDmnPluginSettings, ObsidianDmnPluginSettingsTab} from "./settings";
import Viewer from "dmn-js/lib/NavigatedViewer";
import {DmnModelerView, VIEW_TYPE_DMN} from "./dmnModeler";

interface DmnNodeParameters {
    url: string;
    decisionid: string;
    opendiagram: boolean;
    showzoom: boolean;
    height: number;
    zoom: number;
    x: number;
    y: number;
    forcewhitebackground: boolean;
}

export default class ObsidianDmnPlugin extends Plugin {
    settings: ObsidianDmnPluginSettings;

    async onload() {
        console.log("DMN loading...");

        // Add settings
        this.settings = Object.assign(new ObsidianDmnPluginSettings(), await this.loadData());
        this.addSettingTab(new ObsidianDmnPluginSettingsTab(this.app, this));

        // Add modeler
        this.registerView(
            VIEW_TYPE_DMN,
            (leaf: WorkspaceLeaf) => new DmnModelerView(leaf)
        );
        this.registerExtensions(["dmn"], VIEW_TYPE_DMN);

        this.registerMarkdownCodeBlockProcessor("dmn", async (src, el, ctx) => {
            // Get Parameters
            let parameters: DmnNodeParameters | null = null;
            try {
                parameters = this.readParameters(src);
            } catch (e) {
                el.createEl("h3", {text: "DMN parameters invalid: \n" + e.message});
                return;
            }

            console.log("Try to render a DMN")
            try {
                if (parameters.url.startsWith("./")) {
                    const filePath = ctx.sourcePath;
                    const folderPath = filePath.substring(0, filePath.lastIndexOf("/"));
                    parameters.url = folderPath + "/" + parameters.url.substring(2, parameters.url.length);
                }

                const rootDiv = el.createEl("div");

                if (parameters.opendiagram) {
                    const href = rootDiv.createEl("a", {text: "Open DMN"});
                    href.href = parameters.url;
                    href.className = "internal-link";
                    setIcon(href, "file-edit");
                }
                const dmnDiv = rootDiv.createEl("div", {cls: "dmn-view"});
                if (parameters.forcewhitebackground) {
                    dmnDiv.addClass("dmn-view-white-background");
                } else {
                    // @ts-ignore
                    const theme = app.getTheme();
                    if (theme === 'obsidian') {
                        dmnDiv.addClass("dmn-view-obsidian-theme");
                    } else if (theme === 'moonstone') {
                        dmnDiv.addClass("dmn-view-moonstone-theme");
                    }
                }
                const xml = await this.app.vault.adapter.read(parameters.url);
                dmnDiv.setAttribute("style", "height: " + parameters.height + "px;");
                const dmnViewer =
                    new Viewer({
                        container: dmnDiv,
                        keyboard: {
                            bindTo: dmnDiv.win
                        }
                    });
                const p_zoom = parameters.zoom;
                const p_x = parameters.x;
                const p_y = parameters.y;
                const decisionId = parameters.decisionid;
                dmnViewer.importXML(xml).then(function (result: { warnings: any; }) {
                    // If requested, open directly a decision
                    if (decisionId !== undefined) {
                        dmnViewer.getViews().forEach(function (view: any) {
                            if (view.element.id === parameters?.decisionid) {
                                dmnViewer.open(view);
                            }
                        });
                    }

                    const activeView = dmnViewer.getActiveView();
                    // apply initial logic in DRD view
                    if (activeView.type === 'drd') {
                        // fetch currently active view
                        const activeEditor = dmnViewer.getActiveViewer();
                        // access a#ctive editor components
                        const canvas = activeEditor.get('canvas');
                        // zoom to fit full viewport
                        if (p_zoom === undefined) {
                            canvas.zoom('fit-viewport');
                        } else {
                            canvas.zoom(p_zoom, {x: p_x, y: p_y});
                        }
                    }
                }).catch(function (err: { warnings: any; message: any; }) {
                    const {warnings, message} = err;
                    console.log('something went wrong:', warnings, message);
                    dmnViewer.destroy();
                    rootDiv.createEl("h3", {text: warnings + " " + message});
                });
                if (parameters.showzoom) {
                    const zoomDiv = rootDiv.createEl("div");
                    const zoomInBtn = zoomDiv.createEl("button", {"text": "+"});
                    zoomInBtn.addEventListener("click",
                        (e: Event) => {
                            // only drd (not table view), see https://github.com/camunda/camunda-modeler/issues/117
                            if (dmnViewer.getActiveView().type === 'drd') {
                                dmnViewer.getActiveViewer().get("zoomScroll").stepZoom(0.5);
                            }
                        });
                    const zoomOutBtn = zoomDiv.createEl("button", {"text": "-"});
                    zoomOutBtn.addEventListener("click",
                        (e: Event) => {
                            // only drd (not table view), see https://github.com/camunda/camunda-modeler/issues/117
                            if (dmnViewer.getActiveView().type === 'drd') {
                                dmnViewer.getActiveViewer().get("zoomScroll").stepZoom(-0.5);
                            }
                        });
                    setIcon(zoomInBtn, "zoom-in");
                    setIcon(zoomOutBtn, "zoom-out");
                }
            } catch (error) {
                el.createEl("h3", {text: error});
            }
        });
    }

    private readParameters(jsonString: string) {
        if (jsonString.contains("[[") && !jsonString.contains('"[[')) {
            jsonString = jsonString.replace("[[", '"[[');
            jsonString = jsonString.replace("]]", ']]"');
        }

        const parameters: DmnNodeParameters = parseYaml(jsonString);

        //Transform internal Link to external
        if (parameters.url.startsWith("[[")) {
            parameters.url = parameters.url.substring(2, parameters.url.length - 2);
            // @ts-ignore
            parameters.url = this.app.metadataCache.getFirstLinkpathDest(
                parameters.url,
                ""
            ).path;
        }

        if (parameters.showzoom === undefined) {
            parameters.showzoom = this.settings.showzoom_by_default;
        }

        if (parameters.opendiagram === undefined) {
            parameters.opendiagram = this.settings.opendiagram_by_default;
        }

        if (parameters.height === undefined) {
            parameters.height = this.settings.height_by_default;
        }

        if (parameters.x === undefined) {
            parameters.x = 0;
        }
        parameters.x *= 10

        if (parameters.y === undefined) {
            parameters.y = 0;
        }
        parameters.y *= 10

        if (parameters.forcewhitebackground === undefined) {
            parameters.forcewhitebackground = this.settings.force_white_background_by_default;
        }

        return parameters;
    }

    onunload() {
        console.log("Unloading DMN plugin...");
    }
}
