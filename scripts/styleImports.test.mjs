// vite.config.ts silences Sass's @import deprecation for every file, for the
// one @import Bootstrap 5 requires (src/styles/theme.scss). Anywhere else it
// would go unreported until Dart Sass 3 refuses it: use @use instead.
// Outside src, as plain JS, so Node's types stay out of the app's type check.
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const SRC = path.join(import.meta.dirname, "..", "src")
// Comments out, read in one pass with strings, so neither hides the other
// ("//" in a URL, "/*" in a line comment).
const code = (text) =>
  text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (token) => (token.startsWith("/") ? "" : token))
// A Sass @import: not a plain-CSS one (url(), a .css file or a web address),
// which Sass leaves to the browser and doesn't deprecate.
const SASS_IMPORT = /@import\s+(["'])(?!https?:|\/\/)(?![^"']*\.css\1)[^"']*\1/

describe("Sass @import", () => {
  it("is used only for Bootstrap, in styles/theme.scss", () => {
    const files = fs.readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((f) => /\.s[ac]ss$/.test(f))
    const importing = files.filter((f) => SASS_IMPORT.test(code(fs.readFileSync(path.join(SRC, f), "utf8"))))

    expect(files.length).toBeGreaterThan(0)
    expect(importing).toEqual([path.join("styles", "theme.scss")])
  })
})
