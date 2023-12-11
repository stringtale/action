// @ts-nocheck

jest.mock("node-fetch", () => ({
  ...jest.requireActual("node-fetch"),
  __esModule: true,
  default: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ rates: { CAD: 1.42 } }),
    })
  ),
}))

import fixturez from "fixturez"
import fs from "fs-extra"
import fetch from "node-fetch"
import path from "path"
import { run } from "./run"

let f = fixturez(__dirname)

beforeEach(() => {
  f.cleanup()
  fetch.mockClear()
})

jest.mock("@actions/github", () => ({
  context: {
    repo: {
      owner: "stringtale",
      repo: "action",
    },
    ref: "refs/heads/some-branch",
    sha: "xeac7",
  },
}))
jest.mock("@actions/github/lib/utils", () => ({
  GitHub: {
    plugin: () => {
      // function necessary to be used as constructor
      return function () {
        return {
          rest: mockedGithubMethods,
        }
      }
    },
  },
  getOctokitOptions: jest.fn(),
}))
jest.mock("./gitUtils")

let mockedGithubMethods = {
  search: {
    issuesAndPullRequests: jest.fn(),
  },
  pulls: {
    create: jest.fn(),
  },
  repos: {
    createRelease: jest.fn(),
  },
}

const linkNodeModules = async (cwd: string) => {
  await fs.symlink(
    path.join(__dirname, "..", "node_modules"),
    path.join(cwd, "node_modules")
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("stringtale", () => {
  it("creates simple PR", async () => {
    let cwd = f.copy("simple-project")
    linkNodeModules(cwd)

    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [
              {
                key: "app.title",
                values: [
                  {
                    lang: {
                      code: "en",
                      name: "English",
                    },
                    value: "New value",
                  },
                ],
              },
            ],
            version: 1,
          }),
      })
    )

    mockedGithubMethods.search.issuesAndPullRequests.mockImplementationOnce(
      () => ({ data: { items: [] } })
    )

    mockedGithubMethods.pulls.create.mockImplementationOnce(() => ({
      data: { number: 123 },
    }))

    // gitUtils.checkIfClean.mockImplementationOnce(() => Promise.resolve(true))

    await run({
      githubToken: "@@GITHUB_TOKEN",
      token: "@@STRINGTALE_API_KEY",
      root: cwd,
    })

    expect(mockedGithubMethods.pulls.create.mock.calls[0])
      .toMatchInlineSnapshot(`
      [
        {
          "base": "some-branch",
          "body": "",
          "head": "stringtale/some-branch",
          "owner": "stringtale",
          "repo": "action",
          "title": "StringTale Updates",
        },
      ]
    `)
  })
  it("Should not create a PR when no changes", async () => {
    let cwd = f.copy("simple-project")
    linkNodeModules(cwd)

    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [
              {
                key: "app.title",
                values: [
                  {
                    lang: {
                      code: "en",
                      name: "English",
                    },
                    value: "Old title",
                  },
                ],
              },
            ],
            version: 1,
          }),
      })
    )

    mockedGithubMethods.search.issuesAndPullRequests.mockImplementationOnce(
      () => ({ data: { items: [] } })
    )

    mockedGithubMethods.pulls.create.mockImplementationOnce(() => ({
      data: { number: 123 },
    }))

    await run({
      githubToken: "@@GITHUB_TOKEN",
      token: "@@STRINGTALE_API_KEY",
      root: cwd,
    })

    expect(
      mockedGithubMethods.pulls.create
    ).not.toHaveBeenCalled()
  })
})
