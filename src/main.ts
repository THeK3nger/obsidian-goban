import { MarkdownPostProcessorContext, Plugin } from "obsidian";
import { GoDiagram } from "./sltxt2svg";

export default class ObsidianGoban extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("goban", this.drawGoban());
  }

  refreshMarkdownCodeBlockProcessor() {
    this.registerMarkdownCodeBlockProcessor("goban", this.drawGoban());
  }

  private drawGoban() {
    return (
      source: string,
      el: HTMLElement,
      _ctx: MarkdownPostProcessorContext
    ) => {
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
    };
  }

  private roundNumberToTens(num : number) : number {
    return Math.ceil(num / 10) * 10;
  }
}
