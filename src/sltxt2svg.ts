/**
    sltxt2svg.js -- create an SVG image from Sensei's Library diagram format
    Copyright (C) 2001-2004 by
    Arno Hollosi <ahollosi@xmp.net>, Morten Pahle <morten@pahle.org.uk>
    
    Javascript port Copyright (C) by 
    Stefano Franchi 2019 <stefano.franchi@gmail.com>

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program (see bottom of file); if not, write to the
    Free Software Foundation, Inc., 59 Temple Place, Suite 330,
    Boston, MA  02111-1307  USA


    See demo function after the class definition on how to use it.
**/

/**
 * The syntax for Sensei Library ASCII diagrams:
 *
 *        The first line controls the behavior of the diagram.
 *
 *        The basic syntax is:
 *        $$(B,W)(c)(size)(m Num)(title)
 *          |    |  |     |      +----> title of the diagram
 *          |    |  |     +-----> starting move number (e.g m67 - no space!)
 *          |    |  +----> board size (for SGF and coordinates - default:19)
 *          |    +-> enable and show coordinates in the diagram image
 *          +--> first move is either by black (B) or white (W)
 *         All parts are optional and can be omitted.
 *
 *        The diagram itself may contain the following symbols
 *        (see https://senseis.xmp.net/?HowDiagramsWork for full details):
 *
 *   .         empty intersection (dot)
 *   ,         hoshi
 *   +         empty corner intersection
 *   |         empty vertical border
 *   -         empty horizontal border (minus sign)
 *   _         empty space (underscore) (used to create room around the diagram)
 *   X         plain black stone
 *   O         plain white stone
 * 1..9        Black's move 1, White's move 2
 * 0 (zero)    Black's or White's move 10
 * 10+         Black's or White's moves from 10 to infinity can be added by using a
 *                multi-digit number.  However, any row that includes such a number
 *                cannot be written in compact notation (row must include spaces
 *                between intersections).
 *   B         black stone with circle
 *   W         white stone with circle
 *   #         black stone with square
 *   @         white stone with square
 *   Y         black stone with triangle (omitted [OTF])
 *   Q         white stone with triangle (appears as WS [OTF])
 *   Z         black stone with cross mark (X) (omitted [OTF])
 *   P         white stone with cross mark (X) (omitted [OTF])
 *   C         circle on empty intersection
 *   S         square on empty intersection
 *   T         triangle on empty intersection (omitted [OTF])
 *   M         cross mark (X) on empty intersection (omitted [OTF])
 * a..z       letter on empty intersection
 *
 * The diagram may also contain links between any of the symbols
 * and an internal or external URL in standard wiki format,
 * i.e. [symbol|link]
 *
 **/

/**
 * The GoDiagram class
 * All you need to know are the following methods and variables:
 *
 * - create image with new GoDiagram(string, options) where string contains
 *   the diagram in Sensei Library's diagram format.
 *
 *   Options (all optional):
 *   - width: target width in pixels (default: 400)
 *   - fontSize: custom font size { h: number, w: number } (will be auto-calculated from width if not provided)
 *
 *   Examples:
 *   - new GoDiagram(diagramString) // Uses default 400px width
 *   - new GoDiagram(diagramString, { width: 600 }) // Custom width
 *   - new GoDiagram(diagramString, { fontSize: { h: 20, w: 10 } }) // Custom fontSize
 *
 * - to parse the ASCII diagram and get the SVG image call diagram.createSVG()
 *   If parsing has failed, an SVG image with an error message will be returned.
 *   If parsing was successful, an SVG image of the diagram will be returned.
 *
 * - image size and width can be read from diagram.imageWidth and
 *   diagram.imageHeight
 *
 * - for the client side link map call diagram.getLinkmap()
 *
 * - for the (escaped) title call diagram.getTitle()
 *
 * - for the SGF file call diagram.createSGF()
 *
 * The basic unit of measure for the conversion from ASCII to SVG image
 * in the original sl2png.php codebase is fontsize, which represents
 * the height and width in pixels of a box containing a character of
 * font size n, where n goes from 1 to 5.
 *
 * GoDiagramJS keeps the same mechanism but uses instead height and width
 * (stored as attributes h and w of a fontisize dictionary variable)
 * of a character cell, given in pixels to the class constructor method.
 * The constructor defaults to 16x8, which would correspond
 * to a font of size 2 for a browser's built-in latin2 font.
 *
 **/

// Constants for magic numbers
const DEFAULT_BOARD_SIZE = 19;
const IMAGE_OFFSET = 2;
const IMAGE_BORDER = 4;
const COORDINATE_LEFT_OFFSET = 6;
const COORDINATE_TOP_OFFSET = 18;
const MARKUP_TEXT_SIZE_RATIO = 0.9;
const DEFAULT_TEXT_SIZE_RATIO = 0.5;
const CIRCLE_INNER_RADIUS_OFFSET = 3;
const CIRCLE_OUTER_RADIUS_OFFSET = 2;
const SQUARE_HALF_SIZE = 7;
const HOSHI_RADIUS = 3;
const DEFAULT_DIAGRAM_WIDTH = 400;
const COORDINATE_WIDTH_PADDING = 4;  // extra px added to image width for coordinate labels
const COORDINATE_HEIGHT_PADDING = 2; // extra px added to image height for coordinate labels
const LINK_HIGHLIGHT_OPACITY = 0.28;  // transparency of linked intersections on the goban
const LINK_HIGHLIGHT_STROKE_OPACITY = 0.85;
const LETTER_RADIUS_OFFSET = 4;      // extra radius when drawing a background behind letters
const ERROR_WORDS_PER_LINE = 4;      // chunks used for wrapping the error message text
const SVG_NS = "http://www.w3.org/2000/svg";

type FontSize = { h: number; w: number };
type SVGResult = { element: SVGSVGElement; width: number | null; height: number | null };

interface SVGComponents {
  background: SVGRectElement;
  coordinates: SVGTextElement[];
  svgDiagram: SVGElement[];
}

interface ColorPalette {
  black: string;
  white: string;
  red: string;
  goban: string;
  link: string;
}

interface RenderContext {
  svgDocument: Document;
  palette: ColorPalette;
  evencolor: string;
  oddcolor: string;
  markupClass: string;
  markupTextSize: number;
}

export class GoDiagram {
  fontSize: FontSize;
  inputDiagram: string;
  diagram: string | null;
  failureErrorMessage: string;
  targetWidth: number | null;

  // Auxiliary global variables.
  private content: string[];
  private firstColor!: string;
  private coordinates!: boolean;
  private boardSize!: number;
  private title!: string;
  private linkmap: Record<string, string> = {};
  private startrow!: number;
  private startcol!: number;
  private endrow!: number;
  private endcol!: number;
  private rows!: (string | string[])[];
  private topborder!: number;
  private bottomborder!: number;
  private leftborder!: number;
  private rightborder!: number;
  private radius!: number;
  private imageWidth!: number;
  private imageHeight!: number;
  private offset_x!: number;
  private offset_y!: number;

  constructor(
    input_diagram: string,
    options: {
      fontSize?: FontSize;
      width?: number;
    } = {}
    /**
     * Constructor of class GoDiagram
     * input_diagram is the diagram in SL's diagram format
     *
     * options.fontSize are the height and width in pixels of a box for
     * HTML latin2 standard fontsize 4. (optional, will be calculated from width if not provided)
     * options.width is the target width in pixels for the diagram (default: 400px)
     **/
  ) {
    this.targetWidth = options.width ?? DEFAULT_DIAGRAM_WIDTH;
    // Only use default fontSize if fontSize is explicitly provided
    // Otherwise use placeholder to trigger auto-calculation based on width
    this.fontSize = options.fontSize ?? { h: 0, w: 0 };
    this.inputDiagram = input_diagram;
    this.diagram = null; //default value, overwritten if parsing succeeds
    this.failureErrorMessage = "";
    /** 
       Parse input (this.inputDiagram) into internal representation. 
       Sets this.diagram to null if invalid diagram found
  
       //values extracted from the title line
       firstColor;	// 'B' or 'W'
       coordinates;	// boolean
       boardSize;	        // integer
       title;		// raw text of title
  
       diagram;	        // raw copy of diagram contents (single string)
       rows;		// normalized copy of _diagram (array of lines)
       linkmap;      	// array of imagemap links (bracketlinks)
       image;		// image object of PNG graphic
  
      // image properties
       fontsize;		// dict (h,w), the base unit for dimensions, 
                          //see note above.
       radius;	        // based on fontsize, is the radius of the circle 
                          // circumscribing the cell containing a stone,
                          // markup, or an empty intersection. 
       imageWidth;
       imageHeight;
       offset_x;
       offset_y;
  
      // information about rows, columns
       startrow;
       startcol;
       endrow;
       endcol;
  
      // whether there is a border at the top, bottom, left, right (boolean)
       topborder;
       bottomborder;
       leftborder;
       rightborder;
      **/

    /**
     * Parse diagram and calculate board dimensions
     **/
    const initBoardAndDimensions = () => {
      // remove unnecessary chars, replace border chars
      if (!this.diagram) return;
      let diag = this.diagram.replace(/[-|+]/g, "%");
      diag = diag.replace(/[\t\r$]/g, "");
      diag = diag.replace(/\n+/g, " \n");

      this.rows = [];
      const tempRows = diag.split("\n");
      for (let i = 0; i < tempRows.length; i++) {
        // Check if the row appears to be in non-compact form (spaces),
        // includes a number (/\d/.test), and is not a line/arrow definition line ({)
        if (
          tempRows[i].includes(" ") &&
          /\d/.test(tempRows[i]) &&
          !tempRows[i].includes("{")
        )
          this.rows.push(tempRows[i].split(" "));
        else this.rows.push(tempRows[i].replace(/ /g, ""));
      }

      // find borders
      this.startrow = 0;
      this.startcol = 0;
      this.endrow = this.rows.length - 1;

      // top border
      if (this.rows[0] && this.rows[0][1] == "%") {
        this.startrow++;
        this.topborder = 1;
      } else this.topborder = 0;

      // bottom border
      if (this.rows[this.endrow][1] == "%") {
        this.endrow--;
        this.bottomborder = 1;
      } else this.bottomborder = 0;

      // left border
      if (this.rows[this.startrow][0] == "%") {
        this.startcol++;
        this.leftborder = 1;
      } else this.leftborder = 0;

      // right border
      this.endcol = this.rows[this.startrow].length - 2;
      if (this.rows[this.endrow][this.endcol] == "%") {
        this.endcol--;
        this.rightborder = 1;
      } else this.rightborder = 0;

      /** Initialize image size.
       * The goban is a matrix of rectangular cells, which can be empty,
       * contain a stone, or a symbol. A cell's minimum size must accommodate
       * a symbol in the font used, whose height and width are stored
       * in an instance variable and default to h:16 and w:8 (equivalent to
       * the px heights and width of a font size 2).
       * The image's size adds room for two cells on all sides for the borders **/

      // Calculate fontSize based on target width if it needs to be calculated
      if (this.targetWidth && this.fontSize.h === 0) {
        const numCols = 1 + this.endcol - this.startcol;
        const targetDiameter = (this.targetWidth - IMAGE_BORDER) / numCols;
        // Calculate fontSize from diameter (reverse of diameter = sqrt(h^2 + w^2))
        // Using the ratio h:w = 2:1 from default fontSize
        const h = Math.floor(targetDiameter / Math.sqrt(5)); // sqrt(2^2 + 1^2) = sqrt(5)
        const w = Math.floor(h / 2);
        this.fontSize = { h, w };
      }

      const diameter = Math.floor(
        Math.sqrt(this.fontSize.h ** 2 + this.fontSize.w ** 2)
      );
      this.radius = diameter / 2;
      this.imageWidth = diameter * (1 + this.endcol - this.startcol) + IMAGE_BORDER;
      this.imageHeight = diameter * (1 + this.endrow - this.startrow) + IMAGE_BORDER;
      this.offset_x = IMAGE_OFFSET;
      this.offset_y = IMAGE_OFFSET;

      // adjust image size if coordinates are needed
      if (this.coordinates) {
        if (
          (this.bottomborder || this.topborder) &&
          (this.leftborder || this.rightborder)
        ) {
          const x = this.fontSize.w * 2 + COORDINATE_WIDTH_PADDING;
          const y = this.fontSize.h + COORDINATE_HEIGHT_PADDING;
          this.imageWidth += x;
          this.offset_x += x;
          this.imageHeight += y;
          this.offset_y += y;
        } else {
          // cannot determine X *and* Y coordinates (missing borders)
          this.coordinates = false;
        }
      }
    };

    this.content = this.inputDiagram.split("\n");
    // Parse the parameters of the first line

    let match = this.content[0].trim().match(/^\$\$([WB])?(c)?(d+)?(.*)/);
    if (match === null) {
      this.failureErrorMessage = "Parsing of ASCII diagram failed";
      return;
    }
    this.firstColor = match[1] == "W" ? "W" : "B";
    this.coordinates = match[2] !== undefined;
    this.boardSize = match[3] !== undefined ? parseInt(match[3]) : DEFAULT_BOARD_SIZE;
    this.title = match[4].trim();

    // fill diagram and linkmap variables
    this.diagram = "";
    this.linkmap = {}; // new Object because JS does not have distinct associative arrays

    // Read all lines after first one
    // Using "  " as regex delimiter instead of / because
    // we are looking for possible URLs
    for (const line of this.content.slice(1)) {
      // Add NOT EMPTY line prefixed with $$ NOT containing bracketed links, discarding prefix
      if ((match = line.trim().match(/^\$\$\s*([^[\s].*)/))) {
        this.diagram += match[1] + "\n";
      }
      // Now looking for links and adding them to the map
      if ((match = line.match(/^\$\$\s*\[(.*)\|(.*)\]/))) {
        const anchor = match[1].trim();
        if (anchor.match(/^[a-z0-9WB@#CS]$/)) {
          this.linkmap[anchor] = match[2].trim();
        }
      }
    }

    initBoardAndDimensions();

    if (
      this.startrow > this.endrow || // check if diagram is at least
      this.startcol > this.endcol || // 1x1
      this.endrow < 0 ||
      this.endcol < 0 ||
      this.imageWidth < this.fontSize.w ||
      this.imageHeight < this.fontSize.h
    ) {
      this.diagram = null;
    }
  }

  private htmlspecialchars(text: string): string {
    return text.replace(/[&<>"']/g, (m) => {
      switch (m) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#039;";
        default:
          return "";
      }
    });
  }

  getTitle(): string {
    return this.htmlspecialchars(this.title);
  }

  createSvgErrorMessage(svgDocument: Document, errorClass: string): SVGGElement {
    // Return an svgElement with the error message
    // poor man text wrapping, still unsupported in SVG 1.1
    const splitMessage = this.failureErrorMessage.split(/(.{1,15})/g);
    const wPerL = ERROR_WORDS_PER_LINE;
    let lines = Math.floor(splitMessage.length / wPerL);
    if (splitMessage.length % wPerL !== 0) {
      lines++;
    }
    const svgError = svgDocument.createElementNS(SVG_NS, "g");
    const rect = svgDocument.createElementNS(SVG_NS, "rect");
    rect.setAttributeNS(null, "x", "0");
    rect.setAttributeNS(null, "y", "0");
    rect.setAttributeNS(null, "rx", "20");
    rect.setAttributeNS(null, "ry", "20");
    rect.setAttributeNS(null, "height", String(lines * 50));
    rect.setAttributeNS(null, "fill", "red");
    rect.setAttributeNS(null, "stroke", "black");
    rect.setAttributeNS(null, "class", errorClass);
    const text = svgDocument.createElementNS(SVG_NS, "text");
    text.setAttributeNS(null, "x", "30");
    text.setAttributeNS(null, "y", "30");
    text.setAttributeNS(null, "font-size", "15");
    text.setAttributeNS(null, "fill", "black");

    let message = "";
    for (let i = 0; i < lines; i++) {
      message += splitMessage.slice(i * wPerL, (i + 1) * wPerL).join("") + "\n";
    }
    text.textContent = message;
    svgError.appendChild(rect);
    svgError.appendChild(text);
    return svgError;
  }

  /** Create the SVG image based on ASCII diagram
   *  returns an SVG object and the svg's width and height.
   **/
  createSVG(svgDocument: Document = activeDocument): SVGResult {
    if (this.diagram === null) {
      this.failureErrorMessage = "Parsing of ASCII diagram failed";
      const element = this.createSVGRoot(svgDocument, DEFAULT_DIAGRAM_WIDTH, DEFAULT_DIAGRAM_WIDTH);
      element.appendChild(this.createSvgErrorMessage(svgDocument, "errorClass"));
      return { element, width: null, height: null };
    }

    const palette = this.buildColorPalette();
    const markupTextSize = Math.floor(this.fontSize.h * MARKUP_TEXT_SIZE_RATIO - 1);
    const defaultTextSize = this.fontSize.h * DEFAULT_TEXT_SIZE_RATIO;

    const ctx: RenderContext = {
      svgDocument,
      palette,
      evencolor: this.firstColor === "W" ? palette.black : palette.white,
      oddcolor:  this.firstColor === "W" ? palette.white : palette.black,
      markupClass: "markup",
      markupTextSize,
    };

    const svgDiagram = this.renderGrid(ctx);

    const components: SVGComponents = {
      background: this.renderBackground(svgDocument, palette),
      coordinates: this.coordinates
        ? this.drawCoordinates(svgDocument, palette.black, "coordClass", defaultTextSize)
        : [],
      svgDiagram,
    };

    return {
      element: this.assembleSVG(svgDocument, components),
      width: this.imageWidth,
      height: this.imageHeight,
    };
  }

  private createSVGRoot(
    svgDocument: Document,
    width: number,
    height: number
  ): SVGSVGElement {
    const svg = svgDocument.createElementNS(SVG_NS, "svg");
    svg.setAttributeNS(null, "width", String(width));
    svg.setAttributeNS(null, "height", String(height));
    return svg;
  }

  private setSvgAttributes(
    element: SVGElement,
    attributes: Record<string, string | number>
  ): void {
    for (const key in attributes) {
      element.setAttributeNS(null, key, String(attributes[key]));
    }
  }

  private buildColorPalette(): ColorPalette {
    return {
      black: "rgb(0, 0, 0)",
      white: "rgb(255, 255, 255)",
      red: "rgb(255, 55, 55)",
      goban: "rgb(242, 176, 109)",
      link: "rgb(230, 238, 75)",
    };
  }

  private renderBackground(svgDocument: Document, palette: ColorPalette): SVGRectElement {
    const rect = svgDocument.createElementNS(SVG_NS, "rect");
    this.setSvgAttributes(rect, {
      x: 0,
      y: 0,
      width: this.imageWidth,
      height: this.imageHeight,
      fill: palette.goban,
    });
    return rect;
  }

  private renderGrid(ctx: RenderContext): SVGElement[] {
    const svgDiagram: SVGElement[] = [];

    for (let ypos = this.startrow; ypos <= this.endrow; ypos++) {
      const elementY =
        (ypos - this.startrow) * (this.radius * 2) + this.radius + this.offset_y;
      for (let xpos = this.startcol; xpos <= this.endcol; xpos++) {
        const elementX =
          (xpos - this.startcol) * (this.radius * 2) + this.radius + this.offset_x;
        const svg = this.renderCell(xpos, ypos, elementX, elementY, ctx);
        svgDiagram.push(...svg);
      }
    }

    return svgDiagram;
  }

  private renderCell(
    xpos: number,
    ypos: number,
    elementX: number,
    elementY: number,
    ctx: RenderContext
  ): SVGElement[] {
    const { svgDocument, palette, evencolor, oddcolor, markupClass, markupTextSize } = ctx;
    const svg: SVGElement[] = [];
    let markupColor = "";
    let curchar = this.rows[ypos][xpos];

    // SVG 2.0 href, see https://www.w3.org/TR/SVG2/linking.html#URLReference
    const linkUrl = this.linkmap[curchar];

    switch (curchar) {
      // Black stone — plain (X) or with circle (B) or square (#)
      case "X":
      case "B":
      case "#":
        svg.push(this.drawStone(svgDocument, elementX, elementY, palette.black, palette.black));
        if (curchar !== "X") {
          svg.push(...this.markIntersection(svgDocument, elementX, elementY, this.radius, palette.red, curchar));
        }
        break;

      // White stone — plain (O) or with circle (W) or square (@)
      case "O":
      case "W":
      case "@":
        svg.push(this.drawStone(svgDocument, elementX, elementY, palette.black, palette.white));
        if (curchar !== "O") {
          svg.push(...this.markIntersection(svgDocument, elementX, elementY, this.radius, palette.red, curchar));
        }
        break;

      // Empty intersections — dot, hoshi, circle mark, square mark
      case ".":
      case ",":
      case "C":
      case "S": {
        const type = this.getIntersectionType(xpos, ypos);
        svg.push(...this.drawIntersection(svgDocument, elementX, elementY, palette.black, type));
        if (curchar !== ".") {
          const col = curchar === "," ? palette.black : palette.red;
          svg.push(...this.markIntersection(svgDocument, elementX, elementY, this.radius, col, curchar));
        }
        break;
      }

      // Numbered moves and lettered intersections
      default: {
        if (parseInt(curchar) % 2 === 1) {
          // odd-numbered move
          svg.push(this.drawStone(svgDocument, elementX, elementY, palette.black, oddcolor));
          markupColor = evencolor;
        } else if (parseInt(curchar) % 2 === 0 || parseInt(curchar) === 0) {
          // even-numbered move (0 is displayed as "10")
          svg.push(this.drawStone(svgDocument, elementX, elementY, palette.black, evencolor));
          markupColor = oddcolor;
          if (curchar === "0") curchar = "10";
        } else if (curchar >= "a" && curchar <= "z") {
          const intersectionType = this.getIntersectionType(xpos, ypos);
          svg.push(...this.drawIntersection(svgDocument, elementX, elementY, palette.black, intersectionType));
          // Blank stone-circle hides the grid lines behind the letter
          svg.push(this.drawStone(svgDocument, elementX, elementY, palette.goban, palette.goban));
          svg.push(...this.markIntersection(svgDocument, elementX, elementY, this.radius + LETTER_RADIUS_OFFSET, palette.goban, "@"));
          markupColor = palette.black;
        } else {
          break; // unknown character — skip
        }
        svg.push(this.createTextElement(svgDocument, elementX, elementY, curchar, markupClass, markupTextSize, markupColor));
        break;
      }
    }

    if (!linkUrl) {
      return svg;
    }

    const link = svgDocument.createElementNS(SVG_NS, "a");
    link.setAttributeNS(null, "href", linkUrl);
    link.setAttributeNS(null, "style", "text-decoration:none");
    link.appendChild(this.drawLinkHighlight(svgDocument, elementX, elementY, palette));
    svg.forEach((element) => link.appendChild(element));
    link.appendChild(this.drawLinkHitArea(svgDocument, elementX, elementY));
    return [link];
  }

  private assembleSVG(svgDocument: Document, components: SVGComponents): SVGSVGElement {
    const svg = this.createSVGRoot(svgDocument, this.imageWidth, this.imageHeight);
    svg.appendChild(components.background);
    components.svgDiagram.forEach((element) => svg.appendChild(element));
    components.coordinates.forEach((element) => svg.appendChild(element));
    return svg;
  }

  private drawLinkHighlight(
    svgDocument: Document,
    x: number,
    y: number,
    palette: ColorPalette
  ): SVGCircleElement {
    const circle = svgDocument.createElementNS(SVG_NS, "circle");
    this.setSvgAttributes(circle, {
      cx: x,
      cy: y,
      r: this.radius + 2,
      stroke: palette.link,
      "stroke-width": 2,
      "stroke-opacity": LINK_HIGHLIGHT_STROKE_OPACITY,
      fill: palette.link,
      "fill-opacity": LINK_HIGHLIGHT_OPACITY,
    });
    return circle;
  }

  private drawLinkHitArea(svgDocument: Document, x: number, y: number): SVGRectElement {
    const rect = svgDocument.createElementNS(SVG_NS, "rect");
    this.setSvgAttributes(rect, {
      x: x - this.radius,
      y: y - this.radius,
      width: this.radius * 2,
      height: this.radius * 2,
      fill: "transparent",
    });
    return rect;
  }

  drawStone(
    svgDocument: Document,
    x: number,
    y: number,
    colorRing: string,
    colorInside: string
    /** Return Svg element for a stone
     * x and y are the coords of the center of the diagram's cell
     * colorRing, colorInside are stone colors (edge and body, resp.)
     **/
  ): SVGCircleElement {
    const circle = svgDocument.createElementNS(SVG_NS, "circle");
    this.setSvgAttributes(circle, {
      cx: x,
      cy: y,
      r: this.radius - 1,
      stroke: colorRing,
      fill: colorInside,
    });
    return circle;
  }

  markIntersection(
    svgDocument: Document,
    x: number,
    y: number,
    radius: number,
    color: string,
    type: string
    /** Draws board markup and hoshi marks.
     * x and y are the coords of the center of the diagram's cell
     * type is one of W,B,C for circle or S,@,# for square
     **/
  ): SVGElement[] {
    const intersectionElements: SVGElement[] = [];
    switch (type) {
      case "W":
      case "B":
      case "C":
        [CIRCLE_INNER_RADIUS_OFFSET, CIRCLE_OUTER_RADIUS_OFFSET].forEach((offset) => {
          const circle = svgDocument.createElementNS(SVG_NS, "circle");
          this.setSvgAttributes(circle, {
            cx: x,
            cy: y,
            r: radius - offset,
            stroke: color,
            fill: "none",
          });
          intersectionElements.push(circle);
        });
        break;

      case "S":
      case "@":
      case "#":
        {
          const rect = svgDocument.createElementNS(SVG_NS, "rect");
          this.setSvgAttributes(rect, {
            x: x - radius / 2 + 1,
            y: y - radius / 2 + 1,
            width: SQUARE_HALF_SIZE,
            height: SQUARE_HALF_SIZE,
            stroke: color,
            fill: "none",
          });
          intersectionElements.push(rect);
        }
        break;

      case ",":
        {
          const circle = svgDocument.createElementNS(SVG_NS, "circle");
          this.setSvgAttributes(circle, {
            cx: x,
            cy: y,
            r: HOSHI_RADIUS,
            stroke: color,
            fill: color,
          });
          intersectionElements.push(circle);
        }
    }
    return intersectionElements;
  }

  getIntersectionType(
    x: number,
    y: number
    /** Check if the intersection is on an edge or in a corner
     * Returns one of these values, or their combination (for corners):
     * U(pper), L(eft), R(ight), B(ottom)
     **/
  ): string {
    let type = "";
    if (this.rows[y - 1][x] == "%") {
      type = "U";
    } // Upper row
    if (this.rows[y + 1][x] == "%") {
      type += "B";
    } // Bottom row
    if (this.rows[y][x - 1] == "%") {
      type += "L";
    } // Left column
    if (this.rows[y][x + 1] == "%") {
      type += "R";
    } // Right column
    return type;
  }

  drawIntersection(
    svgDocument: Document,
    x: number,
    y: number,
    color: string,
    type: string
    /** x and y are the coordinates of the center of the cell
     * type can be 'U', 'L', 'R', 'B', 'UL', 'BL', 'UR', 'BR'
     * an empty type represents a middle (non-edge) intersection.
     **/
  ): SVGLineElement[] {
    const intersectionElements: SVGLineElement[] = [];
    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      const line = svgDocument.createElementNS(SVG_NS, "line");
      this.setSvgAttributes(line, { x1, y1, x2, y2, stroke: color });
      intersectionElements.push(line);
    };

    if (!type.includes("U")) {
      drawLine(x, y - this.radius, x, y);
    }
    if (!type.includes("B")) {
      drawLine(x, y + this.radius, x, y);
    }
    if (!type.includes("L")) {
      drawLine(x - this.radius, y, x, y);
    }
    if (!type.includes("R")) {
      drawLine(x + this.radius, y, x, y);
    }
    return intersectionElements;
  }

  drawCoordinates(
    svgDocument: Document,
    color: string,
    coordClass: string,
    SVGTextSize: number // Returns one or more svg elements with the Goban coordinates
  ): SVGTextElement[] {
    const coordChars = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghjklmnopqrstuvwxyz123456789";
    const coordinates: SVGTextElement[] = [];

    let coordY = this.bottomborder
      ? this.endrow - this.startrow + 1
      : this.topborder
        ? this.boardSize
        : 0;

    let coordX = this.leftborder
      ? 0
      : this.rightborder
        ? Math.max(0, this.boardSize - this.endcol - 1)
        : 0;

    // coordinate calculations according to offsets and sizes
    // Align with grid intersections using the same formula as the main drawing loop

    // Offset from left border
    const leftX = COORDINATE_LEFT_OFFSET + this.fontSize.w;
    // Start at the same Y position as the first grid intersection
    let img_y = this.radius + this.offset_y;

    for (let y = 0; y <= this.endrow - this.startrow; y++) {
      coordinates.push(
        this.createTextElement(svgDocument, leftX, img_y, coordY.toString(), coordClass, SVGTextSize, color)
      );
      img_y += this.radius * 2;
      coordY--;
    }

    // Offset from top of image
    const topY = COORDINATE_TOP_OFFSET;
    // Start at the same X position as the first grid intersection
    let img_x = this.radius + this.offset_x;

    for (let x = 0; x <= this.endcol - this.startcol; x++) {
      coordinates.push(
        this.createTextElement(svgDocument, img_x, topY, coordChars[coordX], coordClass, SVGTextSize, color)
      );
      img_x += this.radius * 2;
      coordX++;
    }
    return coordinates;
  }

  private createTextElement(
    svgDocument: Document,
    x: number,
    y: number,
    value: string,
    cssClass: string,
    fontSize: number,
    color: string
  ): SVGTextElement {
    const text = svgDocument.createElementNS(SVG_NS, "text");
    this.setSvgAttributes(text, {
      x,
      y,
      dy: "0.14em",
      fill: color,
      class: cssClass,
      style: `font-size:${fontSize}px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:400;line-height:1`,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "alignment-baseline": "middle",
    });
    text.textContent = value;
    return text;
  }

  createSGF(): string /** Creates SGF based on ASCII diagram and title //FIX ME: STILL TO DO
   * returns SGF as string or FALSE (if board not a square)
   **/ {
    return "";
  }
}
