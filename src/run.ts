import * as core from "@actions/core"
import * as github from "@actions/github"
import { GitHub, getOctokitOptions } from "@actions/github/lib/utils"
import { throttling } from "@octokit/plugin-throttling"
import * as gitUtils from "./gitUtils"
import pullAndReplace from "./pull"
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

  const octokit = setupOctokit(githubToken);

  let repo = `${github.context.repo.owner}/${github.context.repo.repo}`;
  let branch = github.context.ref.replace("refs/heads/", "");
  let stringtaleBranch = `stringtale/${branch}`;

  await gitUtils.switchToMaybeExistingBranch(stringtaleBranch);
  await gitUtils.reset(github.context.sha);

  const res = await pullAndReplace(props)
  if (res.length === 0) {
    core.info("No files to update")
    return null
  }

  let searchQuery = `repo:${repo}+state:open+head:${stringtaleBranch}+base:${branch}+is:pull-request`;
  let searchResultPromise = octokit.rest.search.issuesAndPullRequests({
    q: searchQuery,
  });
  const finalPrTitle = `${prTitle}`;

  core.info("Committing")

  // project with `commit: true` setting could have already committed files
  if (!(await gitUtils.checkIfClean())) {
    await gitUtils.commitAll(commitMessage);
  }
  
  core.info("Pushing")

  await gitUtils.push(stringtaleBranch, { force: true });

  let searchResult = await searchResultPromise;
  core.info(JSON.stringify(searchResult.data, null, 2));

  let prBody = ``

  if (searchResult.data.items.length === 0) {
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
