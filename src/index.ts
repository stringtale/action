import * as core from "@actions/core"
import fs from "fs-extra"
import * as gitUtils from "./gitUtils"
import { run } from "./run"

(async () => {
  let githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    core.setFailed("Please add the GITHUB_TOKEN to the stringtale action")
    return
  }

  let token = process.env.STRINGTALE_TOKEN
  if (!token) {
    core.setFailed("Please add the STRINGTALE_TOKEN to the stringtale action")
    return
  }

  // const inputCwd = core.getInput("cwd")
  // if (inputCwd) {
  //   core.info("changing directory to the one given as the input")
  //   process.chdir(inputCwd)
  // }

  // let setupGitUser = core.getBooleanInput("setupGitUser")

  // if (setupGitUser) {
  //   core.info("setting git user")
  //   await gitUtils.setupUser()
  // }

  core.info("setting GitHub credentials: " + process.env.HOME)
  await fs.writeFile(
    `~/.netrc`,
    `machine github.com\nlogin github-actions[bot]\npassword ${githubToken}`
  )

  await run({
    githubToken,
    token
  })

  // core.setOutput("pullRequestNumber", String(pullRequestNumber))

})().catch((err) => {
  core.error(err)
  core.setFailed(err.message)
})
