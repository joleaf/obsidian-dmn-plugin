import Modeler from "dmn-js/lib/Modeler";
import {Notice, setIcon, TextFileView, WorkspaceLeaf} from "obsidian";
import gridModule from "diagram-js-grid";
import minimapModule from "diagram-js-minimap";
import {ObsidianDmnPluginSettings} from "./settings";

export const VIEW_TYPE_DMN = "dmn-view";

export class DmnModelerView extends TextFileView {
    dmnXml: string;
    dmnDiv: HTMLElement;
    dmnModeler: DmnViewer;

    constructor(
        public leaf: WorkspaceLeaf,
        public settings: ObsidianDmnPluginSettings,
    ) {
        super(leaf);
    }

    getViewData() {
        return this.data;
    }

    setViewData(data: string, clear: boolean) {
        this.dmnXml = data;
        this.dmnModeler.importXML(this.dmnXml).catch((err: unknown) => {
            console.error(err);
        });
    }

    async onOpen() {
        let contentEl = this.contentEl.createDiv({cls: "dmn-content"});
        let buttonbar = contentEl.createDiv();
        let dmnSave = buttonbar.createEl("button", {text: "Save", attr: {"aria-label": "Save"}});
        let dmnUndo = buttonbar.createEl("button", {text: "Undo", attr: {"aria-label": "Undo"}});
        let dmnRedo = buttonbar.createEl("button", {text: "Redo", attr: {"aria-label": "Redo"}});
        let dmnSaveSvg = buttonbar.createEl("button", {
            text: "Export SVG",
            attr: {"aria-label": "Export as SVG"}
        });
        let dmnSavePng = buttonbar.createEl("button", {
            text: "Export PNG",
            attr: {"aria-label": "Export as PNG"}
        });
        let dmn_view_classes = "dmn-view dmn-view-modeler";
        this.dmnDiv = contentEl.createDiv({cls: dmn_view_classes});
        const additionalModules = [];
        if (this.settings.enable_minimap) {
            additionalModules.push(minimapModule);
        }
        if (this.settings.enable_grid) {
            additionalModules.push(gridModule);
        }
        // dmn-js 17 is a multi-view manager: per-viewer options are looked
        // up under the view id (`drd`), `container` stays top-level.
        this.dmnModeler = new Modeler({
            container: this.dmnDiv,
            drd: {
                canvas: {
                    autoFocus: true
                },
                additionalModules: additionalModules,
            },
        });
        if (this.settings.force_white_background_by_default) {
            this.dmnDiv.addClass("dmn-view-white-background");
        }

        // The manager creates one child viewer per view type on demand and
        // does not bridge their event buses, so hook into the viewer as it
        // is created.
        this.dmnModeler.on("viewer.created", (event: {type: string; viewer: DmnChildViewer}) => {
            const {type, viewer} = event;
            // keep the file content in sync while editing (the DRD canvas
            // and the decision table editors both fire commandStack.changed
            // on their own event bus)
            viewer.get("eventBus").on("commandStack.changed", () => {
                void this.dmnModeler.saveXML({format: true}).then((data: {xml: string}) => {
                    this.data = data.xml;
                });
            });
            // The DRD context menu ("Change element") is rendered into the
            // canvas container by default, which Obsidian clips; append it
            // to <body> instead (the .djs-popup rules in styles.css theme
            // it with the active Obsidian theme).
            if (type === "drd") {
                const popupMenu = viewer.get("popupMenu");
                // Function.prototype.bind is typed to return `any`, so
                // re-assert the known signature to keep the no-unsafe-*
                // rules happy.
                const originalCreateContainer =
                    popupMenu._createContainer.bind(popupMenu) as typeof popupMenu._createContainer;
                popupMenu._createContainer = function (config) {
                    const container = originalCreateContainer(config);
                    document.body.appendChild(container);
                    return container;
                };
            }
        });

        // diagram-js binds its keyboard shortcuts to the canvas SVG element,
        // which only receives key events while focused. Obsidian keeps focus
        // on its own workspace elements, so the built-in autoFocus (which
        // requires document.body to be focused) never kicks in. Focus the
        // canvas when the mouse enters the diagram, unless the user is
        // typing somewhere else (e.g. a decision table cell or a note).
        this.registerDomEvent(this.dmnDiv, "mouseenter", () => {
            const active = document.activeElement;
            if (active instanceof HTMLElement &&
                (active.isContentEditable ||
                    active.tagName === "INPUT" ||
                    active.tagName === "TEXTAREA" ||
                    active.tagName === "SELECT")) {
                return;
            }
            try {
                const activeView = this.dmnModeler.getActiveView();
                if (activeView !== null && activeView.type === "drd") {
                    this.dmnModeler.getActiveViewer().get("canvas").focus();
                }
            } catch {
                // no active viewer yet (import in progress) — nothing to focus
            }
        });

        // Button Controller
        dmnSave.addEventListener("click", () => {
            this.requestSave();
        });
        setIcon(dmnSave, "save");
        dmnUndo.addEventListener("click", () => {
            const commandStack = this.getActiveCommandStack();
            if (commandStack !== null && commandStack.canUndo()) {
                commandStack.undo();
            }
        });
        setIcon(dmnUndo, "undo");
        dmnRedo.addEventListener("click", () => {
            const commandStack = this.getActiveCommandStack();
            if (commandStack !== null && commandStack.canRedo()) {
                commandStack.redo();
            }
        });
        setIcon(dmnRedo, "redo");
        dmnSaveSvg.addEventListener("click", () => {
            void this.exportSvg();
        });
        setIcon(dmnSaveSvg, "image");

        // PNG is not supported by dmn-js for now
        dmnSavePng.addEventListener("click", () => {
            void this.exportPng();
        });
        // HIDE PNG BUTTON, as it is not working right now...
        dmnSavePng.hide();
    }

    private getActiveCommandStack(): DmnCommandStack | null {
        try {
            return this.dmnModeler.getActiveViewer().get("commandStack");
        } catch {
            // no active viewer (yet), or a viewer without a command stack
            return null;
        }
    }

    async exportSvg() {
        const activeView = this.dmnModeler.getActiveView();
        if (activeView === null || activeView.type !== "drd") {
            new Notice("DMN: only the DRD view can be exported as SVG.");
            return;
        }
        try {
            const result = await this.dmnModeler.getActiveViewer().saveSVG();
            await this.saveImageFile(result.svg, "svg");
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            new Notice("DMN: could not export SVG: " + message);
        }
    }

    async exportPng() {
        const pngString = undefined;
        if (pngString !== undefined) {
            await this.saveImageFile(pngString, "png");
        }
    }

    async saveImageFile(data: string, format: string) {
        let path = "/";
        const currentFile = this.app.workspace.getActiveFile();
        if (currentFile != null) {
            path = currentFile.path.replace(".dmn", "." + format);
        }
        // getAbstractFileByPath is synchronous
        const existingFile = this.app.vault.getAbstractFileByPath(path);
        if (existingFile !== null) {
            await this.app.fileManager.trashFile(existingFile);
        }
        let newFile = await this.app.vault.create(path, data);
        let leaf = this.app.workspace.getMostRecentLeaf();
        if (leaf != null) {
            await leaf.openFile(newFile);
        }
    }

    async onClose() {
        await this.save();
        this.contentEl.empty();
    }

    clear() {
        // nothing to clear
    }

    getViewType() {
        return VIEW_TYPE_DMN;
    }
}
