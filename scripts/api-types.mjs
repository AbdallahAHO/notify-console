#!/usr/bin/env node
/** Regenerates src/api/openapi.json and src/api/schema.d.ts from a notify OpenAPI URL or file. */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const source = process.argv[2] ?? "http://localhost:8787/openapi.json"
const root = fileURLToPath(new URL("..", import.meta.url))
const jsonPath = `${root}src/api/openapi.json`
const typesPath = `${root}src/api/schema.d.ts`

const text = /^https?:\/\//.test(source)
  ? await fetch(source).then((response) => {
      if (!response.ok) throw new Error(`${source} answered ${response.status}`)
      return response.text()
    })
  : readFileSync(source, "utf8")

writeFileSync(jsonPath, `${JSON.stringify(JSON.parse(text), null, 2)}\n`)
execFileSync("pnpm", ["exec", "openapi-typescript", jsonPath, "-o", typesPath], { stdio: "inherit", cwd: root })
console.log(`types from ${source} → src/api/schema.d.ts`)
