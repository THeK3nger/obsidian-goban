import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const isProd = process.env.BUILD === "production";

export default {
  input: "./src/main.ts",
  output: {
    dir: ".",
    entryFileNames: "main.js",
    sourcemap: "inline",
    sourcemapExcludeSources: isProd,
    format: "cjs",
    exports: "default",
  },
  external: ["obsidian"],
  plugins: [
    typescript({ allowSyntheticDefaultImports: true, outDir: "./dist" }),
    nodeResolve({ browser: true }),
    commonjs({ include: "node_modules/**" }),
  ],
};
