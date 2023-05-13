import { MarkdownPostProcessorContext, Plugin } from "obsidian";
import { GoDiagram } from "./sltxt2svg";

export default class ObsidianGoban extends Plugin {
  onInit() {}

  async onload() {
    console.log("Loading Obsidian Goban");
    this.registerMarkdownCodeBlockProcessor("goban", this.draw_chessboard());
  }

  refreshMarkdownCodeBlockProcessor() {
    this.registerMarkdownCodeBlockProcessor("goban", this.draw_chessboard());
  }

  private draw_chessboard() {
    return (
      source: string,
      el: HTMLElement,
      ctx: MarkdownPostProcessorContext
    ) => {
      const goban = new GoDiagram(source);
      const svgGoban = goban.createSVG();
      console.log(svgGoban);
      //const parser = new DOMParser();
      //const svgGobanDOM = parser.parseFromString(svgGoban, "image/svg+xml");

      const xmlns = "http://www.w3.org/2000/svg";
      var boxWidth = svgGoban.width ?? 320;
      var boxHeight = svgGoban.height ?? 320;
      var block = document.createElementNS(xmlns, "svg");
      block.setAttributeNS(
        null,
        "viewBox",
        "0 0 " + boxWidth + " " + boxHeight
      );
      block.setAttributeNS(null, "width", String(this.roundNumberToTens(boxWidth)));
      block.setAttributeNS(null, "height", String(this.roundNumberToTens(boxHeight)));
      block.innerHTML = svgGoban.xml;
      block.style.display = "block";
      el.appendChild(block);
    };
  }

  private roundNumberToTens(num : number) : number {
    return Math.ceil(num / 10) * 10;
  }
}
