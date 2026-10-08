// Ambient declarations for dmn-js 17 and the diagram-js extension modules,
// which ship no types of their own.
//
// This file must stay a GLOBAL SCRIPT (no top-level import/export): in a
// module file, `declare module "x"` is treated as an *augmentation*, which
// is only possible for modules that already ship types. The shared
// interfaces below are therefore global, and every ambient module
// declaration in this file references them.
//
// dmn-js 17 is a multi-view manager: one DRD (diagram) viewer plus one
// editor viewer per decision element (decision table, literal expression,
// boxed expression). Only the surface this plugin uses is declared.

// diagram-js extension modules are plain didi injector modules.
declare module "diagram-js-grid" {
    import type {ModuleDeclaration} from "didi";
    const GridModule: ModuleDeclaration;
    export default GridModule;
}

declare module "diagram-js-minimap" {
    import type {ModuleDeclaration} from "didi";
    const MinimapModule: ModuleDeclaration;
    export default MinimapModule;
}

// dmn-js-properties-panel ships no types either; the two named exports
// this plugin uses are didi module declarations (the properties panel
// service plus the standard DMN properties provider).
declare module "dmn-js-properties-panel" {
    import type {ModuleDeclaration} from "didi";
    export const DmnPropertiesPanelModule: ModuleDeclaration;
    export const DmnPropertiesProviderModule: ModuleDeclaration;
}

// --- the surface of a dmn-js child viewer that this plugin uses ---

interface DmnView {
    type: string;
    element: {id: string};
    // the manager's view objects also carry the element's id and name
    // (dmn-js-shared Manager.js _updateViews)
    id: string;
    name: string | undefined;
}

interface DmnCommandStack {
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): void;
    redo(): void;
}

interface DmnCanvas {
    focus(): void;
    zoom(zoom: number | "fit-viewport", options?: {x?: number; y?: number}): void;
}

interface DmnEventBus {
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback?: (...args: unknown[]) => void): void;
}

interface DmnZoomScroll {
    stepZoom(delta: number): void;
}

interface DmnPopupMenu {
    _createContainer(config: {provider: string}): HTMLElement;
}

// Child viewers are didi injectors; the typed overloads cover the services
// this plugin resolves, the generic fallback keeps unknown services usable
// without widening everything to any. The DRD viewer (unlike the table
// editors) can also export the diagram as SVG.
interface DmnChildViewer {
    get(name: "eventBus"): DmnEventBus;
    get(name: "commandStack"): DmnCommandStack;
    get(name: "canvas"): DmnCanvas;
    get(name: "zoomScroll"): DmnZoomScroll;
    get(name: "popupMenu"): DmnPopupMenu;
    get<T>(name: string): T;
    saveSVG(): Promise<{svg: string}>;
}

// The manager (Modeler / NavigatedViewer / Viewer) surface.
interface DmnViewer {
    importXML(xml: string): Promise<{warnings: string[]}>;
    saveXML(options?: {format?: boolean}): Promise<{xml: string}>;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback?: (...args: unknown[]) => void): void;
    getActiveView(): DmnView | null;
    getActiveViewer(): DmnChildViewer;
    getViews(): DmnView[];
    open(view: DmnView): Promise<void>;
    destroy(): void;
}

interface DmnViewerOptions {
    container?: HTMLElement;
    width?: string | number;
    height?: string | number;
    common?: Record<string, unknown>;
    // per-view options, keyed by view id (e.g. `drd`)
    [viewId: string]: unknown;
}

declare module "dmn-js/lib/Modeler" {
    const Modeler: new (options?: DmnViewerOptions) => DmnViewer;
    export default Modeler;
}

declare module "dmn-js/lib/NavigatedViewer" {
    const NavigatedViewer: new (options?: DmnViewerOptions) => DmnViewer;
    export default NavigatedViewer;
}

declare module "dmn-js/lib/Viewer" {
    const Viewer: new (options?: DmnViewerOptions) => DmnViewer;
    export default Viewer;
}
