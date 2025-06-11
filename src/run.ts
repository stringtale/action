import * as core from "@actions/core"
import * as github from "@actions/github"
import { GitHub, getOctokitOptions } from "@actions/github/lib/utils"
import { throttling } from "@octokit/plugin-throttling"
import * as gitUtils from "./gitUtils"
import replace from "./replace"
import { pull, fetchUtil } from "@stringtale/node"
// import getLocalConfig, { LocalConfig } from "utils/getLocalConfig"

const searchPullRequest = async ({
  repo,
  stringtaleBranch,
  branch,
  octokit,
}: {
  repo: string;
  stringtaleBranch: string;
  branch: string;
  octokit: ReturnType<typeof setupOctokit>;
}) => {
  const searchQuery = `repo:${repo}+state:open+head:${stringtaleBranch}+base:${branch}+is:pull-request`;
  const searchResult = await octokit.rest.search.issuesAndPullRequests({
    q: searchQuery,
  });

  core.info(JSON.stringify(searchResult.data, null, 2));
  return searchResult.data.items;
};

const setupOctokit = (githubToken: string) => {
  return new (GitHub.plugin(throttling))(
    getOctokitOptions(githubToken, {
      throttle: {
        onRateLimit: (retryAfter, options: any, octokit, retryCount) => {
          core.warning(
            `Request quota exhausted for request ${options.method} ${options.url}`
          );

          if (retryCount <= 2) {
            core.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onSecondaryRateLimit: (
          retryAfter,
          options: any,
          octokit,
          retryCount
        ) => {
          core.warning(
            `SecondaryRateLimit detected for request ${options.method} ${options.url}`
          );

          if (retryCount <= 2) {
            core.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
      },
    })
  );
};

type RunProps = {
  githubToken: string;
  prTitle?: string;
  commitMessage?: string;
  root?: string,
  token: string,
  files?: string[] | string
  ignore?: string[] | string
}

type RunVersionResult = {
  pullRequestNumber: number;
} | null;

export async function run({
  githubToken,
  prTitle = "Stringtale Updates",
  commitMessage = "Stringtale Updates",
  token,
  ...props
}: RunProps): Promise<RunVersionResult> {

  const octokit = setupOctokit(githubToken);

  let repo = `${github.context.repo.owner}/${github.context.repo.repo}`;
  let branch = github.context.ref.replace("refs/heads/", "");
  let stringtaleBranch = `stringtale/${branch}`;

  await gitUtils.switchToMaybeExistingBranch(stringtaleBranch);
  await gitUtils.reset(github.context.sha);

  core.info("Fetch values from StringTale")
  // const groupCommitsBy = core.getInput("group-commits-by", { required: false }) as "none" | "version";

  // if (groupCommitsBy === "version") {
  //   const datas = await fetchUtil(token, "grouped-pull", {})
  //   let hasChanges = false

  //   for (const data of datas) {
  //     const keys = data.history.map((h) => ({
  //       key: h.key,
  //       version: data.version,
  //       values: [{
  //         value: h.newValue,
  //         selector: h.selector
  //       }]
  //     }))
  //     const res = await replace({
  //       data: keys, ...props
  //     })

  //     if (res.length === 0) {
  //       core.info("No files to update")
  //       continue
  //     }
  //     hasChanges = true
  //     core.info(`Committing version ${data.version}`)

  //     // project with `commit: true` setting could have already committed files
  //     if (!(await gitUtils.checkIfClean())) {
  //       await gitUtils.commitAll(`Stringtale update from ${data.user ? data.user.name : "[Deleted User]"} (version ${data.version})`);
  //     }
  //   }
  //   if (!hasChanges) {
  //     return null
  //   }
  // } else {

  const data = await pull(token)

  const res = await replace({
    data, ...props
  })

  if (res.length === 0) {
    core.info("No files to update")

    const searchResult = await searchPullRequest({
      repo,
      stringtaleBranch,
      branch,
      octokit,
    });
    if (searchResult.length > 0) {
      const [pullRequest] = searchResult;
      await octokit.rest.pulls.update({
        pull_number: pullRequest.number,
        ...github.context.repo,
        state: "closed",
      })
    }
    return null
  }

  // project with `commit: true` setting could have already committed files
  if (!(await gitUtils.checkIfClean())) {
    await gitUtils.commitAll(`Stringtale update`);
  }
  // }
  core.info("Pushing")

  await gitUtils.push(stringtaleBranch, { force: true });

  const searchResult = await searchPullRequest({
    repo,
    stringtaleBranch,
    branch,
    octokit,
  });

  const finalPrTitle = prTitle;
  let prBody = ``

  if (searchResult.length === 0) {
    core.info("creating pull request");
    const { data: newPullRequest } = await octokit.rest.pulls.create({
      base: branch,
      head: stringtaleBranch,
      title: finalPrTitle,
      body: prBody,
      ...github.context.repo,
    });

    return {
      pullRequestNumber: newPullRequest.number,
    };
  } else {
    const [pullRequest] = searchResult;

    core.info(`updating found pull request #${pullRequest.number}`);
    await octokit.rest.pulls.update({
      pull_number: pullRequest.number,
      title: finalPrTitle,
      body: prBody,
      ...github.context.repo,
    });

    return {
      pullRequestNumber: pullRequest.number,
    };
  }
}
