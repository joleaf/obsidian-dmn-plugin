import Modeler from "dmn-js/lib/Modeler";
import {TextFileView} from "obsidian";

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
            thisRef.clear();
            thisRef.contentEl.createEl("div", {text: err.message});
        });
    }

    async onOpen() {
        let bpmnSave = this.contentEl.createEl("button", {text: "Save"});
        this.dmnDiv = this.contentEl.createEl("div", {cls: "dmn-view dmn-fullscreen"});
        this.dmnModeler = new Modeler({
            container: this.dmnDiv,
            keyboard: {
                bindTo: this.dmnDiv.win
            }
        });
        this.dmnDiv.addClass("dmn-view-white-background");

        const dmnModeler = this.dmnModeler
        const thisRef = this;
        this.dmnModeler.on("commandStack.changed", function () {
            dmnModeler.saveXML({format: true}).then(function (data: any) {
                const {xml} = data;
                thisRef.data = xml;
            });
        });
        bpmnSave.addEventListener("click", function (e: Event) {
            thisRef.save();
        });
    }

    async onClose() {
        this.contentEl.empty();
    }

    clear() {
        this.contentEl.empty();
    }

    getViewType() {
        return VIEW_TYPE_DMN;
    }
}