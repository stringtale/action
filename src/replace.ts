

// import replace from "replace-in-file"
import { glob } from "glob"
import fs from "fs"
import path from "path"
import { replaceInFile } from "@stringtale/utils"
import { pull } from "@stringtale/node"
import * as core from "@actions/core"


const replace = async ({ data, files = ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"], root, ignore = [] }: any) => {

  core.info("Get files to update: " + files.toString())

  const filesPaths = await glob(files, {
    ignore,
    cwd: root,
    nodir: true
  })

  let filesChanged: string[] = []

  for (const file of filesPaths) {

    const fullPath = root ? path.resolve(root, file) : file

    const input = fs.readFileSync(fullPath, 'utf-8')
    const output = replaceInFile(input, data, file)
    //Contents changed and not a dry run? Write to file
    if (output !== input) {
      fs.writeFileSync(file, output, 'utf8')
      core.info("Writen file: " + fullPath)
      filesChanged.push(file)
    }
  }
  return filesChanged

}

export default replace
