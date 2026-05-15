# Goban Viewer

Goban Viewer renders Go/Baduk/Weiqi diagrams in Obsidian using [Sensei's Library diagram syntax](https://senseis.xmp.net/?HowDiagramsWork).

Write a diagram inside a fenced `goban` code block and the plugin will render it as an SVG goban directly in your note.

## Features

- Render Sensei's Library-style Go diagrams in Obsidian notes.
- Supports fenced code blocks using the `goban` language.
- Outputs lightweight SVG diagrams.
- Works on desktop and mobile Obsidian.

The plugin is currently very experimental and offers limited customization options. But they will come in the future. :)

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community plugins** in Obsidian.
2. Disable **Restricted mode**, if needed.
3. Click **Browse**.
4. Search for **Goban Viewer**.
5. Install and enable the plugin.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create the folder `.obsidian/plugins/goban-viewer/` inside your vault, if it does not already exist.
3. Copy the downloaded files into that folder.
4. Reload Obsidian.
5. Enable **Goban Viewer** from **Settings → Community plugins**.

## Usage

Create a fenced code block with the `goban` language and write the board position using Sensei's Library diagram notation.

````markdown
```goban
$$c Links in diagrams - examples
$$  --------------
$$ | . . . . 1 . .
$$ | . C . . . . .
$$ | 2 . . X O 4 .
$$ | . . X O . . .
$$ | . . X O . . .
$$ | 3 . a . . C .
$$ | . . . . . . .
$$ [2|NadareJoseki]
$$ [a|http://gtl.xmp.net/members/info?p_key=349&pseudo=dada]
$$ [C|#1]
```
````
You should get something like this:

<img width="447" height="502" alt="CleanShot 2026-05-15 at 14 30 23@2x" src="https://github.com/user-attachments/assets/19d94745-d881-4e07-b595-40ccddaf5573" />

For the full diagram syntax, see [How Diagrams Work on Sensei's Library](https://senseis.xmp.net/?HowDiagramsWork).

## Limitations

Goban Viewer uses a renderer derived from an older Sensei's Library diagram conversion script. Most common diagrams should work, but some less common markup may be incomplete or behave differently from Sensei's Library.

If you find a diagram that does not render correctly, please open an issue with the original diagram text and the expected output.

## Development

Install dependencies:

```bash
npm install
```

Run a development build with watch mode:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

The Obsidian plugin entry point is generated as `main.js` in the repository root.

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
