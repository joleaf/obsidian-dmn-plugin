import {Plugin, WorkspaceLeaf, parseYaml, setIcon, MarkdownPostProcessorContext, TFile, MarkdownView, Notice } from "obsidian";
import {autocompletion, type Completion, type CompletionContext, type CompletionResult} from "@codemirror/autocomplete";
import {EditorState, type Text} from "@codemirror/state";
import {DMN_BLOCK_PARAMETERS} from "./parameters";
import {DmnBlockInsertModal} from "./dmnBlockModal";
import {ObsidianDmnPluginSettings, ObsidianDmnPluginSettingsTab} from "./settings";
import NavigatedViewer from "dmn-js/lib/NavigatedViewer";
import Viewer from "dmn-js/lib/Viewer";
import {DmnModelerView, VIEW_TYPE_DMN} from "./dmnModeler"

interface DmnNodeParameters {
    url: string;
    decisionid: string;
    opendiagram: boolean;
    showzoom: boolean;
    enablepanzoom: boolean;
    height: number;
    zoom: number;
    x: number;
    y: number;
    forcewhitebackground: boolean;
}

const emptyDmn = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/MODEL/diagram-interchange/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="sample_diagram" name="sample-diagram" namespace="https://www.omg.org/spec/DMN/20191111/MODEL/">\n' +
    '  <decision id="Decision_1" name="My Decision">\n' +
    '    <decisionTable id="DecisionTable_1">\n' +
    '      <input id="Input_1" name="Input 1">\n' +
    '        <inputExpression id="InputExpression_1" typeRef="string">\n' +
    '          <text></text>\n' +
    '        </inputExpression>\n' +
    '      </input>\n' +
    '      <output id="Output_1" name="Output 1" typeRef="string"/>\n' +
    '      <rule id="Rule_1">\n' +
    '        <inputEntry id="Cell_1">\n' +
    '          <text></text>\n' +
    '        </inputEntry>\n' +
    '        <outputEntry id="Cell_2">\n' +
    '          <text></text>\n' +
    '        </outputEntry>\n' +
    '      </rule>\n' +
    '    </decisionTable>\n' +
    '  </decision>\n' +
    '  <dmndi:DMNDI>\n' +
    '    <dmndi:DMNShape dmnElement="Decision_1">\n' +
    '      <dc:Bounds height="80.0" width="180.0" x="136.0" y="112.0"/>\n' +
    '    </dmndi:DMNShape>\n' +
    '  </dmndi:DMNDI>\n' +
    '</definitions>'

// Autocompletion for the code block's parameters, active only while the
// cursor is inside a ```dmn fenced code block. It is registered through
// the editor's language data (the default source mechanism of the
// autocompletion extension) so it coexists with any other completions.
function isInsideDmnFence(doc: Text, pos: number): boolean {
    const line = doc.lineAt(pos);
    for (let i = line.number - 1; i >= 1; i--) {
        const text = doc.line(i).text;
        if (!text.trimStart().startsWith("```")) continue;
        const info = text.trim().slice(3).split(/\s+/)[0]?.toLowerCase() ?? "";
        if (info !== "dmn") return false;
        // the opening fence must still be open at the cursor line
        for (let j = i + 1; j < line.number; j++) {
            if (doc.line(j).text.trimStart().startsWith("```")) return false;
        }
        return true;
    }
    return false;
}

function dmnParameterOptions(context: CompletionContext): CompletionResult | null {
    const line = context.state.doc.lineAt(context.pos);
    // only complete bare parameter keys, i.e. the "key" part before ": value"
    const match = line.text.match(/^\s*([a-z]*)$/i);
    if (!match) return null;
    const prefix = match[1];
    const options = DMN_BLOCK_PARAMETERS
        .filter((p) => p.name.startsWith(prefix))
        .map((p): Completion => ({
            label: p.name,
            type: "property",
            info: p.description,
            detail: p.values,
            apply(view, completion, from, to) {
                view.dispatch(view.state.update({changes: {from, to, insert: completion.label + ": "}}));
            },
        }));
    if (options.length === 0) return null;
    return {from: line.from + (match[0].length - prefix.length), options};
}

function dmnParameterActivate(context: CompletionContext): boolean {
    return isInsideDmnFence(context.state.doc, context.pos);
}

// Carries both the new (function) and legacy (object) CompletionSource
// shapes, so the source works regardless of the bundled CM6 version.
const dmnParameterSource = Object.assign(dmnParameterOptions, {
    activate: dmnParameterActivate,
    options: dmnParameterOptions,
});

const dmnBlockAutocompletion = [
    autocompletion(),
    EditorState.languageData.of((state: EditorState, pos: number) => {
        if (!isInsideDmnFence(state.doc, pos)) return [];
        return [{autocomplete: dmnParameterSource}];
    }),
];

export default class ObsidianDmnPlugin extends Plugin {
    settings: ObsidianDmnPluginSettings;

    async onload() {
        // Add settings
        this.settings = Object.assign(
            new ObsidianDmnPluginSettings(),
            (await this.loadData()) as Partial<ObsidianDmnPluginSettings>
        );
        this.addSettingTab(new ObsidianDmnPluginSettingsTab(this.app, this));

        // Autocomplete the code block's parameters inside ```dmn fences
        this.registerEditorExtension(dmnBlockAutocompletion);

        // Add modeler
        this.registerView(
            VIEW_TYPE_DMN,
            (leaf: WorkspaceLeaf) => new DmnModelerView(leaf, this.settings)
        );
        // Register dmn extension
        this.registerExtensions(["dmn"], VIEW_TYPE_DMN);
        // Add code block extension
        this.registerMarkdownCodeBlockProcessor("dmn", async (src, el, ctx) => {
            // Get Parameters
            let parameters: DmnNodeParameters | null = null;
            try {
                parameters = this.readParameters(src);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                el.createEl("h3", {text: "DMN parameters invalid: \n" + message});
                return;
            }
            await this.renderDmnBlock(parameters, el, ctx);
        });
        // Add ![[]] embedding
        this.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
            const embeds = el.querySelectorAll(".internal-embed");
            embeds.forEach((embed: HTMLElement) => {
                void this.renderDmnEmbed(el, ctx, embed);
            });
        });

        // Insert / edit a code block via popup (only with a markdown file active)
        this.addCommand({
            id: "insert-dmn-block",
            name: "Insert / Edit DMN code block",
            callback: () => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view == null) {
                    new Notice("DMN: open a markdown file first.");
                    return;
                }
                try {
                    new DmnBlockInsertModal(this.app, this.settings).open();
                } catch (e) {
                    new Notice("DMN: " + (e instanceof Error ? e.message : String(e)));
                }
            },
        });

        // Create a new DMN file in the vault
        this.addCommand({
            id: "create-dmn",
            name: "Create DMN",
            callback: () => {
                void this.createNewDmn();
            },
        });

        // Add icon
        this.addRibbonIcon("file-input", "New DMN", () => {
            void this.createNewDmn();
        });
    }

    private async createNewDmn() {
        let path = "/";
        const currentFile = this.app.workspace.getActiveFile();
        if (currentFile != null && currentFile.parent != null) {
            path = currentFile.parent.path + "/";
        }
        path += "model";
        // search for new non-existing file
        for (let i = 1; i < 99; i++) {
            const newPath = path + "_" + i + ".dmn";
            if (!(await this.app.vault.adapter.exists(newPath))) {
                path = newPath;
                break;
            }
        }
        let newDmnContent = emptyDmn;
        // replace Decision ID and DecisionTable ID (including the DI reference)
        const randomId = (Math.random() + 1).toString(36).substring(7);
        newDmnContent = newDmnContent
            .replace(/DecisionTable_1/g, "DecisionTable_" + randomId)
            .replace(/Decision_1/g, "Decision_" + randomId);
        let newDmnFile = await this.app.vault.create(path, newDmnContent);
        let leaf = this.app.workspace.getMostRecentLeaf();
        if (leaf != null) {
            await leaf.openFile(newDmnFile);
        }
    }

    private async renderDmnEmbed(el: HTMLElement, ctx: MarkdownPostProcessorContext, embed: HTMLElement) {
        const src = embed.getAttribute("src");
        if (!src || !src.endsWith(".dmn")) return;
        const file = this.app.vault.getAbstractFileByPath(src);
        if (!(file instanceof TFile)) return;
        let parameters: DmnNodeParameters | null = null;
        try {
            parameters = this.readParameters("url: " + file.path);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            embed.createEl("h3", {text: "DMN parameters invalid: \n" + message});
            return;
        }
        embed.innerHTML = "";
        await this.renderDmnBlock(parameters, el, ctx);
        embed.addClass("dmn-embed");
    }

    private async renderDmnBlock(parameters: DmnNodeParameters, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        try {
            if (parameters.url.startsWith("./")) {
                const filePath = ctx.sourcePath;
                const folderPath = filePath.substring(0, filePath.lastIndexOf("/"));
                parameters.url = folderPath + "/" + parameters.url.substring(2, parameters.url.length);
            }

            const rootDiv = el.createDiv();

            if (parameters.opendiagram) {
                const href = rootDiv.createEl("a", {text: "Open diagram"});
                href.href = parameters.url;
                href.className = "internal-link";
                setIcon(href, "file-edit");
            }
            let dmn_view_classes = "dmn-view"
            const dmnDiv = rootDiv.createDiv({cls: dmn_view_classes});
            if (parameters.forcewhitebackground) {
                dmnDiv.addClass("dmn-view-white-background");
            } else {
                const theme = this.app.getTheme();
                if (theme === 'obsidian') {
                    dmnDiv.addClass("dmn-view-obsidian-theme");
                } else if (theme === 'moonstone') {
                    dmnDiv.addClass("dmn-view-moonstone-theme");
                }
            }
            const xml = await this.app.vault.adapter.read(parameters.url);
            dmnDiv.setAttribute("style", "height: " + parameters.height + "px;");
            const dmnViewer = parameters.enablepanzoom ?
                new NavigatedViewer({container: dmnDiv}) :
                new Viewer({container: dmnDiv});
            const p_zoom = parameters.zoom;
            const p_x = parameters.x;
            const p_y = parameters.y;
            const decisionId = parameters.decisionid;
            if (parameters.showzoom && parameters.enablepanzoom) {
                const zoomDiv = rootDiv.createDiv();
                const zoomInBtn = zoomDiv.createEl("button", {"text": "+"});
                zoomInBtn.addEventListener("click",
                    (e: Event) => {
                        // only drd (not table view), see https://github.com/camunda/camunda-modeler/issues/117
                        const activeView = dmnViewer.getActiveView();
                        if (activeView !== null && activeView.type === 'drd') {
                            dmnViewer.getActiveViewer().get("zoomScroll").stepZoom(0.5);
                        }
                    });
                const zoomOutBtn = zoomDiv.createEl("button", {"text": "-"});
                zoomOutBtn.addEventListener("click",
                    (e: Event) => {
                        // only drd (not table view), see https://github.com/camunda/camunda-modeler/issues/117
                        const activeView = dmnViewer.getActiveView();
                        if (activeView !== null && activeView.type === 'drd') {
                            dmnViewer.getActiveViewer().get("zoomScroll").stepZoom(-0.5);
                        }
                    });
                setIcon(zoomInBtn, "zoom-in");
                setIcon(zoomOutBtn, "zoom-out");
            }
            dmnViewer.importXML(xml).then(() => {
                // If requested, open directly a decision
                if (decisionId !== undefined) {
                    dmnViewer.getViews().forEach(function (view: DmnView) {
                        if (view.element.id === decisionId) {
                            void dmnViewer.open(view);
                        }
                    });
                }

                const activeView = dmnViewer.getActiveView();
                // apply initial logic in DRD view
                if (activeView !== null && activeView.type === 'drd') {
                    // fetch currently active view
                    const activeEditor = dmnViewer.getActiveViewer();
                    // access active editor components
                    const canvas = activeEditor.get('canvas');
                    // zoom to fit full viewport
                    if (p_zoom === undefined) {
                        canvas.zoom('fit-viewport');
                    } else {
                        canvas.zoom(p_zoom, {x: p_x, y: p_y});
                    }
                }
            }).catch((err: unknown) => {
                const e = err as Error & {warnings?: unknown[]};
                const details = Array.isArray(e.warnings) ? e.warnings.map(String) : [];
                details.push(e instanceof Error ? e.message : String(err));
                const message = details.join(" ");
                console.error('something went wrong:', message);
                dmnViewer.destroy();
                rootDiv.createEl("h3", {text: message});
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            el.createEl("h3", {text: message});
            console.error(message);
        }
    }

    private readParameters(yamlString: string) {
        if (yamlString.contains("[[") && !yamlString.contains('"[[')) {
            yamlString = yamlString.replace("[[", '"[[');
            yamlString = yamlString.replace("]]", ']]"');
        }

        const parameters = parseYaml(yamlString) as DmnNodeParameters;

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

        if (parameters.enablepanzoom === undefined) {
            parameters.enablepanzoom = this.settings.enablepanzoom_by_default;
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
    }
}
