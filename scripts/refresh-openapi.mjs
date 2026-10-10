#!/usr/bin/env node
// Refreshes scripts/openapi.json, the API contract the suite checks the
// client's calls against (scripts/contract.test.mjs), from the API about to
// ship. Run it before each release.
//
//   npm run contract:refresh                                 the dev server's (http://localhost:3001/openapi.json)
//   npm run contract:refresh -- https://unq-be.onrender.com/openapi.json
//   npm run contract:refresh -- ../UnQ-BE/openapi.json      a file
//
// Exit 0: written. 1: not an OpenAPI 3.1 document. 2: couldn't read it.

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "openapi.json")
const source = process.argv[2] ?? "http://localhost:3001/openapi.json"

const read = async () => {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`)
    return res.text()
  }
  return readFile(source, "utf8")
}

let document
try {
  document = JSON.parse(await read())
} catch (error) {
  console.error(`Couldn't read the document: ${error.message}`)
  process.exit(2)
}
if (typeof document?.openapi !== "string" || !document.openapi.startsWith("3.1.") || !document.paths) {
  console.error("Not an OpenAPI 3.1 document")
  process.exit(1)
}

// The host it was read from is not part of the contract.
document.servers = [{ url: "/", description: "This host" }]
await writeFile(OUT, JSON.stringify(document, null, 2) + "\n")
console.log(`${path.relative(process.cwd(), OUT)}: ${document.info?.title ?? "API"} ${document.info?.version ?? ""}, ${Object.keys(document.paths).length} paths`)
