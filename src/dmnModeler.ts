import Modeler from "dmn-js/lib/Modeler";
import {setIcon, TextFileView} from "obsidian";

export const VIEW_TYPE_DMN = "dmn-view";

export class DmnModelerView extends TextFileView {
    dmnXml: string;
    dmnDiv: HTMLElement;
    // @ts-ignore
    dmnModeler: Modeler;

    getViewData() {
        return this.data;
    }

    setViewData(data: string, clear: boolean) {
        this.dmnXml = data;
        const thisRef = this;
        this.dmnModeler.importXML(this.dmnXml).catch(function (err: { warnings: any; message: string; }) {
            console.error(err);
        });
    }

    async onOpen() {
        let contentEl = this.contentEl.createEl("div", {cls: "dmn-content"});
        let buttonbar = contentEl.createEl("div");
        let dmnSave = buttonbar.createEl("button", {text: "Save", placeholder: "Save"});
        setIcon(dmnSave, "save");
        this.dmnDiv = contentEl.createEl("div", {cls: "dmn-view dmn-view-modeler"});
        this.dmnModeler = new Modeler({
            container: this.dmnDiv,
            keyboard: {
                bindTo: this.dmnDiv.win
            }
        });
        this.dmnDiv.addClass("dmn-view-white-background");

        const dmnModeler = this.dmnModeler
        const thisRef = this;
        // Not working atm
        this.dmnModeler.on("commandStack.changed", function () {
            dmnModeler.saveXML({format: true}).then(function (data: any) {
                const {xml} = data;
                thisRef.data = xml;
            });
        });
        dmnSave.addEventListener("click", function (e: Event) {
            dmnModeler.saveXML({format: true}).then(function (data: any) {
                const {xml} = data;
                thisRef.data = xml;
                thisRef.save();
            });
        });
    }

    async onClose() {
        this.contentEl.empty();
    }

    clear() {

    }

    getViewType() {
        return VIEW_TYPE_DMN;
    }
}