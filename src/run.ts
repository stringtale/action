import * as core from "@actions/core"
import * as github from "@actions/github"
import { GitHub, getOctokitOptions } from "@actions/github/lib/utils"
import { throttling } from "@octokit/plugin-throttling"
import * as gitUtils from "./gitUtils"
import { pull } from "@stringtale/utils"
// import getLocalConfig, { LocalConfig } from "utils/getLocalConfig"

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
  prTitle = "StringTale Updates",
  commitMessage = "StringTale Updates",
  ...props
}: RunProps): Promise<RunVersionResult> {

  const res = await pull(props)
  if (res.length === 0) {
    core.info("No files to update")
    return null
  }

  const octokit = setupOctokit(githubToken);

  let repo = `${github.context.repo.owner}/${github.context.repo.repo}`;
  let branch = github.context.ref.replace("refs/heads/", "");
  let versionBranch = `stringtale/${branch}`;

  await gitUtils.switchToMaybeExistingBranch(versionBranch);
  await gitUtils.reset(github.context.sha);

  let searchQuery = `repo:${repo}+state:open+head:${versionBranch}+base:${branch}+is:pull-request`;
  let searchResultPromise = octokit.rest.search.issuesAndPullRequests({
    q: searchQuery,
  });
  const finalPrTitle = `${prTitle}`;

  // project with `commit: true` setting could have already committed files
  if (!(await gitUtils.checkIfClean())) {
    await gitUtils.commitAll(commitMessage);
  }

  await gitUtils.push(versionBranch, { force: true });

  let searchResult = await searchResultPromise;
  core.info(JSON.stringify(searchResult.data, null, 2));

  let prBody = ``

  if (searchResult.data.items.length === 0) {
    core.info("creating pull request");
    const { data: newPullRequest } = await octokit.rest.pulls.create({
      base: branch,
      head: versionBranch,
      title: finalPrTitle,
      body: prBody,
      ...github.context.repo,
    });

    return {
      pullRequestNumber: newPullRequest.number,
    };
  } else {
    const [pullRequest] = searchResult.data.items;

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
