// The docs that live beside the code drift from it silently: these catch the
// drift the code can see. (What the client calls is checked against the API's
// document in contract.test.mjs.) Outside src, as plain JS, so Node's types
// stay out of the app's type check.
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(import.meta.dirname, "..")
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8")

describe("the environment variables", () => {
  it("are each in the README's table and in .env.example, and nothing else is", () => {
    const table = [...read("README.md").matchAll(/^\| `([A-Z_]+)` \|/gm)].map((m) => m[1])
    const example = [...read(".env.example").matchAll(/^#? ?([A-Z_]+)=/gm)].map((m) => m[1])
    expect(table.length).toBeGreaterThan(0)
    expect(table.sort()).toEqual(example.sort())
  })
})

// The Markdown the repository ships: the root files and docs/. (Not every .md
// on disk: a developer's git-excluded notes aren't the project's docs.)
const markdownFiles = () =>
  [
    "README.md",
    "CHANGELOG.md",
    ...fs
      .readdirSync(path.join(ROOT, "docs"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join("docs", f)),
  ].sort()

// GitHub's anchor for a heading: lowercased, punctuation dropped, spaces to dashes.
const anchor = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")

const headingsOf = (markdown) => {
  const ids = new Set()
  for (const [, text] of markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) ids.add(anchor(text))
  // Explicit anchors: <div id="top">, <a id="…">, <a name="…">.
  for (const [, id] of markdown.matchAll(/<(?:div|a|span|p)\s[^>]*?(?:id|name)="([^"]+)"/g)) ids.add(id)
  return ids
}

describe("the README's version badge", () => {
  it("says the version in package.json", () => {
    const badge = read("README.md").match(/badge\/version-([\d.]+)-/)?.[1]
    expect(badge).toBe(JSON.parse(read("package.json")).version)
  })
})

describe("the Markdown files", () => {
  it("link only to files and headings that exist", () => {
    const broken = []
    for (const file of markdownFiles()) {
      const markdown = read(file)
      const headings = headingsOf(markdown)
      // Links, images and HTML links, without the code blocks, where a path
      // may be an example.
      const prose = markdown.replace(/```[\s\S]*?```/g, "")
      const targets = [
        ...[...prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]),
        ...[...prose.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
      ]
      for (const target of targets) {
        if (/^(https?:|mailto:)/.test(target)) continue
        const [file_, hash] = target.split("#")
        if (file_) {
          const resolved = path.join(ROOT, path.dirname(file), file_)
          if (!fs.existsSync(resolved)) {
            broken.push(`${file}: ${target} (no such file)`)
            continue
          }
          if (hash && !headingsOf(fs.readFileSync(resolved, "utf8")).has(hash)) broken.push(`${file}: ${target} (no such heading)`)
        } else if (hash && !headings.has(hash)) {
          broken.push(`${file}: ${target} (no such heading)`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})
