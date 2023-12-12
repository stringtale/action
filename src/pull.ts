

// import replace from "replace-in-file"
import { glob } from "glob"
import fs from "fs"
import path from "path"
import { replaceInFile } from "@stringtale/utils"
import * as core from "@actions/core"
import fetch, { Headers } from "node-fetch"

export const BASE = "https://copytool.demonsters.nl"
export const CONFIG_FILE = "stringtale.config.json"


const pull = async ({ token, files = ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"], root, ignore = [] }: any) => {

  core.info("Fetch values from StringTale")

  const res = await fetch(`${BASE}/api/cli/pull/`, {
    method: 'POST',
    body: JSON.stringify({ version: 1, all: true }),
    headers: new Headers({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }),
  })

  if (!res.ok) {
    throw new Error(res.statusText)
  }

  const data = await res.json() as any

  core.info("Get files to update: " + files.toString())

  const filesPaths = await glob(files, {
    ignore,
    cwd: root,
    nodir: true
  })

  let filesChanged: string[] = []

  for (const file of filesPaths) {

    const fullPath = root ? path.resolve(root, file) : file

    core.info("Get file: " + fullPath)

    const input = fs.readFileSync(fullPath, 'utf-8')
    const output = replaceInFile(input, data.content, file)
    //Contents changed and not a dry run? Write to file
    if (output !== input) {
      core.info("Write file: " + fullPath)
      fs.writeFileSync(file, output, 'utf8')
      core.info("Writen file: " + fullPath)
      filesChanged.push(file)
    }
  }
  return filesChanged

}

export default pull
