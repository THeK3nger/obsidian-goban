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
 * - create image with new GoDiagram(string) where string contains
 *   the diagram in Sensei Library's diagram format.
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

export class GoDiagram {
  fontSize: { h: number; w: number };
  inputDiagram: string;
  diagram: any;
  failureErrorMessage: string;

  // Auxiliary global variables.
  private content: string[];
  private firstColor!: string;
  private coordinates!: boolean;
  private boardSize!: number;
  private title!: string;
  private linkmap: Record<string, any> = {};
  private startrow!: number;
  private startcol!: number;
  private endrow!: number;
  private endcol!: number;
  private rows!: string[];
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
    fontSize = { h: 16, w: 8 }
    /**
     * Constructor of class GoDiagram
     * input_diagram is the diagram in SL's diagram format
     *
     * fontSize are the height and width in pixels of a box for
     * HTML latin2 standard fontsize 4.
     **/
  ) {
    this.fontSize = fontSize;
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
      var diag;
      // remove unnecessary chars, replace border chars
      diag = this.diagram.replace(/[-|+]/g, "%");
      diag = diag.replace(/[\t\r\$]/g, "");
      diag = diag.replace(/\n+/g, " \n");
      // trim(preg_replace("/\n+/", " \n", $diag));
      
      this.rows = [];
      var tempRows = diag.split("\n");
      for (var i = 0; i < tempRows.length; i++) {
        // Check if the row appears to be in non-compact form (spaces), 
        // includes a number (/\d/.test), and is not a line/arrow definition line ({)
        if (tempRows[i].contains(' ') && /\d/.test(tempRows[i]) && !tempRows[i].contains('{'))
          this.rows.push(tempRows[i].split(' '));
        else
          this.rows.push(tempRows[i].replaceAll(' ', ''));
      }
      
      // find borders
      this.startrow = 0;
      this.startcol = 0;
      this.endrow = this.rows.length - 1;

      // top border
      if (this.rows[0][1] == "%") {
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

      var diameter = Math.floor(
        Math.sqrt(this.fontSize["h"] ** 2 + this.fontSize["w"] ** 2)
      );
      this.radius = diameter / 2;
      //this.diameter = diameter;
      this.imageWidth = diameter * (1 + this.endcol - this.startcol) + 4;
      this.imageHeight = diameter * (1 + this.endrow - this.startrow) + 4;
      this.offset_x = 2;
      this.offset_y = 2;

      // adjust image size if coordinates are needed
      if (this.coordinates) {
        if (
          (this.bottomborder || this.topborder) &&
          (this.leftborder || this.rightborder)
        ) {
          var x = this.fontSize["w"] * 2 + 4;
          var y = this.fontSize["h"] + 2;
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
    this.coordinates = !(match[2] == undefined);
    this.boardSize = match[3] == undefined ? 19 : parseInt(match[3]);
    this.title = match[4].trim();

    // fill diagram and linkmap variables
    this.diagram = "";
    this.linkmap = {}; // new Object because JS does not have distinct associative arrays

    // Read all lines after first one
    // Using "  " as regex delimiter instead of / because
    // we are looking for possible URLs
    for (var line of this.content.slice(1)) {
      // Add NOT EMPTY line prefixed with $$ NOT containing bracketed links, discarding prefix
      if ((match = line.trim().match(/^\$\$\s*([^[\s].*)/))) {
        this.diagram += match[1] + "\n";
      }
      // Now looking for links and adding them to the map
      if ((match = line.match(/^\$\$\s*\[(.*)\|(.*)\]/))) {
        var anchor = match[1].trim();
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
      this.imageWidth < this.fontSize["w"] ||
      this.imageHeight < this.fontSize["h"]
    ) {
      this.diagram = null;
    }
  }

  private htmlspecialchars(text: string) {
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

  getTitle() {
    return this.htmlspecialchars(this.title);
  }

  createSvgErrorMessage(errorClass: string) {
    // Return an svgElement string with the error message

    // poor man text wrapping, still unsupported in SVG 1.1
    //        var splitMessage = this.failureErrorMessage.match(/(.{1,15})/g);
    const xmlns = "http://www.w3.org/2000/svg";

    let splitMessage = this.failureErrorMessage.split(/(.{1,15})/g);
    let wPerL = 4; //words per line
    let lines = Math.floor(splitMessage.length / wPerL);
    if (splitMessage.length % wPerL !== 0) {
      lines++;
    }
    const svgError = document.createElementNS(xmlns, "g");
    const rect = document.createElementNS(xmlns, "rect");
    rect.setAttributeNS(null, "x", "0");
    rect.setAttributeNS(null, "y", "0");
    rect.setAttributeNS(null, "rx", "20");
    rect.setAttributeNS(null, "ry", "20");
    rect.setAttributeNS(null, "height", String(lines*50));
    rect.setAttributeNS(null, "fill", "red");
    rect.setAttributeNS(null, "stroke", "black");
    rect.setAttributeNS(null, "class", "errorClass");
    const text = document.createElementNS(xmlns, "text");
    text.setAttributeNS(null, "x", "30");
    text.setAttributeNS(null, "y", "30");
    text.setAttributeNS(null, "font-size", "15");
    text.setAttributeNS(null, "fill", "black");

    let message = ""
    for (let i = 0; i < lines; i++) {
      message += splitMessage.slice(i * wPerL, (i + 1) * wPerL) + "\n";
    }
    text.innerHTML = message;
    svgError.appendChild(rect)
    svgError.appendChild(text)
    return String(svgError); // TODO: Just to allow compilation.
  }

  createSVG() 
   /** Create the SVG image based on ASCII diagram
    *  returns an SVG object (an XML text file), and the svg's width and height.
    **/
  : {xml: string, width: number | null, height: number | null} {
    // parse input diagram, create error SVG if failed
    let errorClass = "";

    if (this.diagram === null) {
      //parsing failed
      this.failureErrorMessage = "Parsing of ASCII diagram failed";
      return { xml: this.createSvgErrorMessage(errorClass), width: null, height: null};
    } else {
      // parsing succeeded --> create SVG diagram
      var imgSvg: Record<string, string> = {};
      // 1. Create the SVG image element
      imgSvg["openSvgTag"] =
        '<svg width = "' +
        this.imageWidth +
        '" height = "' +
        this.imageHeight +
        '">\n';
      imgSvg["closeSvgTag"] = "</svg>\n";

      // 2. Set up the default colors
      var black = "rgb(0, 0, 0)";
      var white = "rgb(255, 255, 255)";
      var red = "rgb(255, 55, 55)";
      var goban = "rgb(242, 176, 109)";
      var gobanborder = "rgb(150, 110, 65)";
      var gobanborder2 = "rgb(210, 145, 80)";
      var gobanopen = "rgb(255, 210, 140)";
      var link = "rgb(202, 106, 69)";
      var markupColor = "";
      var linkOpacity = 0.4; // Transparency of the linked areas on the goban

      // 3. Setup the CSS classes for styling
      var blackStoneClass = "blackstone";
      var whiteStoneClass = "whitestone";
      var gobanClass = "goban";
      var gobanBorderClass = "gobanBorder";
      var linkClass = "linkClass";
      var markupClass = "markup";
      var evenColorClass = "evenColor";
      var oddColorClass = "oddColor";
      var textClass = "textClass";
      var coordClass = "coordClass";
      errorClass = "errorClass";

      // plus some default styles in case CSS classes are not present
      // Text size in SVG behaves differently than in PHP's image
      // Approximately half the height of our fontSize box is desired
      // coordinates and auxiliary text. About 90% of the standard font for markup
      var svgMarkupTextSize =
        'style="font-size:' +
        Math.floor(this.fontSize["h"] * 0.9).toString() +
        'px"';
      var svgDefaultTextSize =
        'style="font-size:' + (this.fontSize["h"] / 2).toString() + 'px"';

      // 5. Create the background
      imgSvg["background"] =
        '<rect  x="0" y="0" width="' +
        this.imageWidth +
        '" height = "' +
        this.imageHeight +
        '" fill = "' +
        goban +
        '"/>\n';

      // 6. Draw the coordinates
      if (this.coordinates) {
        imgSvg["coordinates"] = this.drawCoordinates(
          black,
          coordClass,
          svgDefaultTextSize
        );
      } else {
        imgSvg["coordinates"] = "";
      }

      // 7. Draw Goban border
      //this.drawGobanBorder(gobanborder, gobanborder2, gobanopen, white);

      // 8. Draw stones, numbers etc. for each row and column
      if (this.firstColor == "W") {
        var evencolor = black;
        var oddcolor = white;
      } else {
        evencolor = white;
        oddcolor = black;
      }
      /** main drawing routine starts here
       *   imgSvg['svgDiagram']  is the string collecting
       *   all the svg elements for all the cells in the diagram
       **/
      imgSvg["svgDiagram"] = "";
      for (var ypos = this.startrow; ypos <= this.endrow; ypos++) {
        // Get the ordinate of the element to draw
        var elementY =
          (ypos - this.startrow) * (this.radius * 2) +
          this.radius +
          this.offset_y;
        //for each character in the row
        for (var xpos = this.startcol; xpos <= this.endcol; xpos++) {
          // svgItem contains one or more svg elements
          //(circles, intersection, marks, colored areas, etc.)
          // with the drawing code for each  cell in the diagram
          var svgItem = "";
          // get the absciss of the element to draw
          var elementX =
            (xpos - this.startcol) * (this.radius * 2) +
            this.radius +
            this.offset_x;
          // Get the character
          var curchar = this.rows[ypos][xpos];

          // FIXME: TODO
          /** Is this a linked area? if so,
           *   add a square colored with link color
           *   to the link elements array
           *   and wrap the it in an "a" element with
           *   the proper anchor and link.
           *
           *   We are following SVG 2.0 rules and using href
           *   instead of the xlink namespace.
           *   See https://www.w3.org/TR/SVG2/linking.html#URLReference
           */
          if (
            typeof this.linkmap[curchar] !== "undefined" &&
            this.linkmap[curchar] !== null
          ) {
            imgSvg["links"] += '<a href="' + this.linkmap[curchar] + '" >\n';
            imgSvg["links"] +=
              '<rect x="' +
              (elementX - this.radius) +
              '" y="' +
              (elementY - this.radius) +
              '" width="' +
              this.radius * 2 +
              '" height="' +
              this.radius * 2 +
              '" stroke="' +
              goban +
              '" fill="' +
              link +
              '" fill-opacity="' +
              linkOpacity +
              '" />\n';
            imgSvg["links"] += "</a>\n";
          }
          // {
          //    list($x, $y, $xx, $yy) = $this->_getLinkArea($xpos, $ypos);
          //    ImageFilledRectangle($img, $x, $y, $xx, $yy, $link);
          // }
          switch (curchar) {
            // if X, B, or  # we have a black stone (marked or not)
            case "X":
            case "B":
            case "#":
              svgItem += this.drawStone(elementX, elementY, black, black);
              if (curchar !== "X") {
                svgItem += this.markIntersection(
                  elementX,
                  elementY,
                  this.radius,
                  red,
                  curchar
                );
              }
              break;
            // if O, W, or @ we have a white stone, marked or unmarked
            case "O":
            case "W":
            case "@":
              svgItem += this.drawStone(elementX, elementY, black, white);
              if (curchar !== "O") {
                svgItem += this.markIntersection(
                  elementX,
                  elementY,
                  this.radius,
                  red,
                  curchar
                );
              }
              break;
            // if . , C or S we have EMPTY intersections possibly with hoshi, circle or square
            case ".": // empty intersection, check location
            // (edge, corner)
            case ",":
            case "C":
            case "S":
              var type = this.getIntersectionType(xpos, ypos);
              svgItem += this.drawIntersection(elementX, elementY, black, type);
              if (curchar !== ".") {
                var col = curchar == "," ? black : red;
                svgItem += this.markIntersection(
                  elementX,
                  elementY,
                  this.radius,
                  col,
                  curchar
                );
              }
              break;
            // any other markup (including & / ( ) ! etc.)
            default:
              if (parseInt(curchar) % 2 == 1) {
                //odd numbers
                svgItem += this.drawStone(elementX, elementY, black, oddcolor);
                markupColor = evencolor;
              } else if (parseInt(curchar) % 2 == 0 || parseInt(curchar) == 0) {
                // even numbers
                svgItem += this.drawStone(elementX, elementY, black, evencolor);
                markupColor = oddcolor;
                if (curchar == "0") {
                  curchar = "10";
                }
              } else if (curchar >= "a" && curchar <= "z") {
                type = this.getIntersectionType(xpos, ypos);
                svgItem += this.drawIntersection(
                  elementX,
                  elementY,
                  black,
                  type
                );
                var bkColor =
                  typeof this.linkmap[curchar] !== "undefined" &&
                  this.linkmap[curchar] !== null
                    ? link
                    : goban;
                // Draw a stone-sized circle under the letter to hide the intersection
                svgItem += this.drawStone(elementX, elementY, goban, goban);
                // then draw the letter
                this.markIntersection(
                  elementX,
                  elementY,
                  this.radius + 4,
                  bkColor,
                  "@"
                );
                markupColor = black;
                //font++   ??? Unclear what this does. font starts up set at this.fontsize, which was  2
              }
              // unknown character
              else {
                break;
              }
              var xOffset =
                parseInt(curchar) >= 10
                  ? this.fontSize["w"]
                  : this.fontSize["w"] / 2;
              var yOffset = this.fontSize["h"] / 2 - 12.5;
              svgItem +=
                '<text x="' +
                (elementX - xOffset).toString() +
                '" y="' +
                (elementY - yOffset).toString() +
                '" fill="' +
                markupColor +
                '" class="' +
                markupClass +
                '" ' +
                svgMarkupTextSize +
                ">" +
                curchar +
                "</text>\n";
              break;
          } // end of switch curchar
          imgSvg["svgDiagram"] += svgItem;
        } // end of xpos loop
      } // end of ypos loop

      // 7. Assemble the complete  svg element and return it
      var svgElement =
        imgSvg["openSvgTag"] +
        imgSvg["background"] +
        imgSvg["svgDiagram"] +
        imgSvg["links"] +
        imgSvg["coordinates"] +
        imgSvg["closeSvgTag"];

      return {xml: svgElement, width: this.imageWidth, height: this.imageHeight};
    }
  }

  drawStone(
    x: string | number,
    y: string | number,
    colorRing: string,
    colorInside: string
    /** Return Svg element for a stone
     * x and y are the coords of the center of the diagram's cell
     * colorRing, colorInside are stone colors (edge and body, resp.)
     **/
  ) {
    return `<circle cx="${String(x)}" cy = "${String(y)}" r = "${String(
      this.radius
    )}" stroke = "${String(colorRing)}" fill = "${String(colorInside)}" />
  `;
  }

  markIntersection(
    x: number,
    y: number,
    radius: number,
    color: string,
    type: string
    /** Draws board markup and hoshi marks.
     * x and y are the coords of the center of the diagram's cell
     * type is one of W,B,C for circle or S,@,# for square
     **/
  ) {
    var intersectionElements = "";
    var svgElem;
    switch (type) {
      case "W":
      case "B":
      case "C":
        intersectionElements +=
          '<circle cx="' +
          x +
          '" cy = "' +
          y +
          '" r = "' +
          (radius - 3) +
          '" stroke = "' +
          color +
          '" fill = "none"' +
          '" />\n';
        intersectionElements +=
          '<circle cx="' +
          x +
          '" cy = "' +
          y +
          '" r = "' +
          (radius - 2) +
          '" stroke = "' +
          color +
          '" fill = "none"' +
          '" />\n';
        // intersectionElements += '<circle cx="' +
        // x + '" cy = "'  +
        // y + '" r = "'  +
        // radius  +
        // '" stroke = "' +
        // color +
        // '" fill = "none"'   +
        //     '" />\n';
        break;

      case "S":
      case "@":
      case "#":
        intersectionElements +=
          '<rect x="' +
          (x - radius / 2 + 1) +
          '" y = "' +
          (y - radius / 2 + 1) +
          '" width = "' +
          7 +
          '" height = "' +
          7 +
          '" stroke = "' +
          color +
          '" fill = "none"' +
          '" />\n';
        break;

      case ",":
        intersectionElements +=
          '<circle cx="' +
          x +
          '" cy = "' +
          y +
          '" r = "' +
          3 +
          '" stroke = "' +
          color +
          '" fill = "' +
          color +
          '" />\n';
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
  ) {
    var type = "";
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
    x: number,
    y: number,
    color: string,
    type: string
    /** x and y are the coordinates of the center of the cell
     * type can be 'U', 'L', 'R', 'B', 'UL', 'BL', 'UR', 'BR'
     * an empty type represents a middle (non-edge) intersection.
     **/
  ) {
    var intersectionElements = "";
    var svgElem;
    if (!type.includes("U")) {
      svgElem =
        '<line x1="' +
        x +
        '" y1="' +
        (y - this.radius) +
        '" x2="' +
        x +
        '" y2="' +
        y +
        '" stroke="' +
        color +
        '" />\n';
      intersectionElements += svgElem;
    }
    if (!type.includes("B")) {
      svgElem = `<line x1="${x}" y1="${
        y + this.radius
      }" x2="${x}" y2="${y}" stroke="${color}" />
  `;
      intersectionElements += svgElem;
    }
    if (!type.includes("L")) {
      svgElem =
        '<line x1="' +
        (x - this.radius) +
        '" y1="' +
        y +
        '" x2="' +
        x +
        '" y2="' +
        y +
        '" stroke="' +
        color +
        '" />\n';
      intersectionElements += svgElem;
    }
    if (!type.includes("R")) {
      svgElem =
        '<line x1="' +
        (x + this.radius) +
        '" y1="' +
        y +
        '" x2="' +
        x +
        '" y2="' +
        y +
        '" stroke="' +
        color +
        '" />\n';
      intersectionElements += svgElem;
    }
    return intersectionElements;
  }

  drawCoordinates(
    color: string,
    coordClass: string,
    SVGTextSize: string // Returns one or more svg elements with the Goban coordinates
  ) {
    var coordChars =
        "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghjklmnopqrstuvwxyz123456789",
      coordY,
      coordX,
      topRowSvgElems = "",
      leftColSvgElems = "",
      svgElem;

    if (this.bottomborder) {
      coordY = this.endrow - this.startrow + 1;
    } else if (this.topborder) {
      coordY = this.boardSize;
    } else {
      coordY = 0;
    }

    if (this.leftborder) {
      coordX = 0;
    } else if (this.rightborder) {
      coordX = this.boardSize - this.endcol - 1;
      if (coordX < 0) {
        coordX = 0;
      }
    } else {
      coordX = 0;
    }
    // coordinate calculations according to offsets and sizes
    // in createSVG.  See createSVG for values

    // Offset from left border. May have to be adjusted for different fontsizes
    var leftX = 6 + this.fontSize["w"];
    var img_y =
      12 + this.fontSize["h"] + 2 + this.radius - this.fontSize["h"] / 2;
    for (var y = 0; y <= this.endrow - this.startrow - 1; y++) {
      var Xoffset = coordY >= 10 ? this.fontSize["w"] : this.fontSize["w"] / 2;
      svgElem =
        '<text x="' +
        (leftX - Xoffset) +
        '" y="' +
        img_y +
        '" class="' +
        coordClass +
        '" ' +
        SVGTextSize +
        '" color="' +
        color +
        '">' +
        coordY.toString() +
        " </text>\n";
      img_y += this.radius * 2 + 0.5;
      coordY--;
      leftColSvgElems += svgElem;
    }
    // Offset from top of image. May have to be adjusted for different font sizes
    var topY = 18;
    var img_x =
      2 + this.fontSize["w"] * 2 + 4 + this.radius - this.fontSize["w"] / 2;
    for (var x = 0; x <= this.endcol - this.startcol; x++) {
      svgElem =
        '<text x="' +
        img_x +
        '" y="' +
        topY +
        '" class="' +
        coordClass +
        '" ' +
        SVGTextSize +
        ' color="' +
        color +
        '">' +
        coordChars[coordX] +
        " </text>\n";
      img_x += this.radius * 2;
      coordX++;
      topRowSvgElems += svgElem;
    }
    return leftColSvgElems + topRowSvgElems;
  }

  //   drawGobanBorder(color, color2, open, white) {
  //     return "";
  //   }

  createSGF() /** Creates SGF based on ASCII diagram and title //FIX ME: STILL TO DO
   * returns SGF as string or FALSE (if board not a square)
   **/ {
    return "";
  }
}
