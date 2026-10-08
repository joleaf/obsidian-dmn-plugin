import Modeler from "dmn-js/lib/Modeler";
import {Notice, setIcon, TextFileView, WorkspaceLeaf} from "obsidian";
import gridModule from "diagram-js-grid";
import minimapModule from "diagram-js-minimap";
import {DmnPropertiesPanelModule, DmnPropertiesProviderModule} from "dmn-js-properties-panel";
import {ObsidianDmnPluginSettings} from "./settings";

export const VIEW_TYPE_DMN = "dmn-view";

export class DmnModelerView extends TextFileView {
    dmnXml: string;
    dmnDiv: HTMLElement;
    dmnModeler: DmnViewer;
    dmnTabs: HTMLElement | null = null;
    dmnPropertiesPanel: HTMLElement | null = null;
    panelCollapsed: boolean = false;

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
        // Decision tabs: DRD first, then one tab per decision. Always
        // present, on its own row above the canvas/workspace.
        this.dmnTabs = contentEl.createDiv({cls: "dmn-tabs"});
        let dmn_view_classes = "dmn-view dmn-view-modeler";
        // Two-column layout when the properties panel is enabled:
        // [canvas | properties panel]; disabled keeps the single
        // full-width canvas (identical DOM to before the panel existed).
        const panelEnabled = this.settings.enable_properties_panel;
        if (panelEnabled) {
            const workspaceEl = contentEl.createDiv({cls: "dmn-workspace"});
            this.dmnDiv = workspaceEl.createDiv({cls: dmn_view_classes});
            this.dmnPropertiesPanel = workspaceEl.createDiv({cls: "dmn-properties-panel"});
        } else {
            this.dmnPropertiesPanel = null;
            this.dmnDiv = contentEl.createDiv({cls: dmn_view_classes});
        }
        const propertiesPanelParent = this.dmnPropertiesPanel;
        // Collapse/expand button for the panel column (only when the panel
        // itself is enabled in the settings).
        if (panelEnabled) {
            const dmnTogglePanel = buttonbar.createEl("button", {
                text: "Properties",
                attr: {"aria-label": "Toggle properties panel"}
            });
            dmnTogglePanel.addClass("mod-active");
            dmnTogglePanel.addEventListener("click", () => {
                this.panelCollapsed = !this.panelCollapsed;
                dmnTogglePanel.toggleClass("mod-active", !this.panelCollapsed);
                // the panel sits on the right: collapse rightward, expand leftward
                setIcon(dmnTogglePanel, this.panelCollapsed ? "chevron-left" : "chevron-right");
                let activeType: string | null = null;
                try {
                    const active = this.dmnModeler.getActiveView();
                    activeType = active !== null ? active.type : null;
                } catch {
                    // no active viewer yet — treat as "not the DRD"
                    activeType = null;
                }
                this.updatePanelVisibility(activeType);
            });
            setIcon(dmnTogglePanel, "chevron-right");
        }
        const additionalModules = [];
        if (this.settings.enable_minimap) {
            additionalModules.push(minimapModule);
        }
        if (this.settings.enable_grid) {
            additionalModules.push(gridModule);
        }
        // The properties panel is a service of the DRD child viewer, so its
        // modules and the `propertiesPanel.parent` config both live under
        // `drd` (the manager forwards per-view options to the viewer it
        // creates for that view id). The panel attaches to `parent` when
        // the DRD view is imported and detaches when it is switched away,
        // so it only shows for the DRD — no extra view logic needed.
        if (panelEnabled) {
            additionalModules.push(DmnPropertiesPanelModule, DmnPropertiesProviderModule);
        }
        const drdOptions: Record<string, unknown> = {
            canvas: {
                autoFocus: true
            },
            additionalModules: additionalModules,
        };
        if (panelEnabled && propertiesPanelParent !== null) {
            drdOptions.propertiesPanel = {parent: propertiesPanelParent};
        }
        // dmn-js 17 is a multi-view manager: per-viewer options are looked
        // up under the view id (`drd`), `container` stays top-level.
        this.dmnModeler = new Modeler({
            container: this.dmnDiv,
            drd: drdOptions,
        });
        if (this.settings.force_white_background_by_default) {
            this.dmnDiv.addClass("dmn-view-white-background");
        }

        // The tab bar reflects the manager's view list. views.changed fires
        // after the initial import, on every switch, and when decisions are
        // added, removed, or renamed (the EditingManager re-derives the
        // views from the child viewers' elements.changed); content-only
        // edits (e.g. a rule row) do not fire it.
        this.dmnModeler.on("views.changed", (event: {views: DmnView[]; activeView: DmnView | null}) => {
            this.renderTabs(event.views, event.activeView);
            this.updatePanelVisibility(event.activeView !== null ? event.activeView.type : null);
        });

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

    private renderTabs(views: DmnView[], activeView: DmnView | null): void {
        const tabs = this.dmnTabs;
        if (tabs === null) {
            return;
        }
        tabs.empty();
        for (const view of views) {
            const label = view.name ?? (view.type === "drd" ? "DRD" : view.id);
            const tab = tabs.createEl("button", {text: label, cls: "dmn-tab"});
            if (activeView !== null && activeView.id === view.id) {
                tab.addClass("active");
            }
            tab.addEventListener("click", () => {
                // open() on the already-active view still re-imports the
                // child viewer (the DRD: a full clear + import), so a click
                // on the active tab must be a no-op
                const active = this.dmnModeler.getActiveView();
                if (active !== null && active.id === view.id) {
                    return;
                }
                void this.dmnModeler.open(view).catch((err: unknown) => {
                    console.error(err);
                    new Notice("DMN: could not open view: " + (err instanceof Error ? err.message : String(err)));
                });
            });
        }
    }

    // The panel is only rendered for the DRD (the manager attaches it to
    // the DRD child viewer and detaches it in the table views), but its
    // container column would still take 320px there — hide the whole
    // column unless we are on the DRD and the user has not collapsed it.
    private updatePanelVisibility(activeType: string | null): void {
        const panel = this.dmnPropertiesPanel;
        if (panel === null) {
            return;
        }
        panel.toggleClass("dmn-collapsed", !(activeType === "drd" && !this.panelCollapsed));
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
