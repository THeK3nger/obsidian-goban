import { Plugin } from "obsidian";
import { GoDiagram } from "./sltxt2svg";

export default class ObsidianGoban extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("goban", this.drawGoban());
  }

  private drawGoban() {
    return (source: string, el: HTMLElement) => {
      try {
        const goban = new GoDiagram(source);
        const svgGoban = goban.createSVG(activeDocument);

        const boxWidth = svgGoban.width ?? 320;
        const boxHeight = svgGoban.height ?? 320;
        const block = svgGoban.element;
        block.setAttributeNS(
          null,
          "viewBox",
          "0 0 " + boxWidth + " " + boxHeight
        );
        block.setAttributeNS(null, "width", String(this.roundNumberToTens(boxWidth)));
        block.setAttributeNS(null, "height", String(this.roundNumberToTens(boxHeight)));
        block.classList.add("goban-block");
        el.appendChild(block);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        el.createEl("pre", { cls: "goban-error", text: `Goban: ${message}` });
      }
    };
  }

  private roundNumberToTens(num : number) : number {
    return Math.ceil(num / 10) * 10;
  }
}
