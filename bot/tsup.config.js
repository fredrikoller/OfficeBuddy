/**
 * @type {import('tsup').Options}
 */
module.exports = {
  dts: false,
  minify: false,
  bundle: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  format: ["cjs"],
  entry: ["src/index.ts"],
  tsconfig: "tsconfig.json",
};
