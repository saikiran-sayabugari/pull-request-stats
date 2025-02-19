const core = require('@actions/core');
const github = require('@actions/github');
const { subtractDaysToDate } = require('./utils');
const { Telemetry } = require('./services');
const {
  getPulls,
  buildTable,
  postComment,
  getReviewers,
  buildComment,
  getPullRequest,
  setUpReviewers,
  checkSponsorship,
  alreadyPublished,
  postSlackMessage,
} = require('./interactors');

const run = async (params) => {
  const {
    org,
    repos,
    limit,
    sortBy,
    octokit,
    periodLength,
    disableLinks,
    displayCharts,
    pullRequestId,
  } = params;

  const pullRequest = pullRequestId
    ? await getPullRequest({ octokit, pullRequestId })
    : null;

  if (pullRequest && alreadyPublished(pullRequest)) {
    core.info('Skipping execution because stats are published already');
    return;
  }

  const pulls = await getPulls({
    octokit,
    org,
    repos,
    startDate: subtractDaysToDate(new Date(), periodLength),
  });
  core.info(`Found ${pulls.length} pull requests to analyze`);

  const reviewersRaw = getReviewers(pulls);
  core.info(`Analyzed stats for ${reviewersRaw.length} pull request reviewers`);

  const reviewers = setUpReviewers({
    limit,
    sortBy,
    periodLength,
    reviewers: reviewersRaw,
  });

  const table = buildTable({ reviewers, disableLinks, displayCharts });
  core.debug('Stats table built successfully');

  const content = buildComment({ table, periodLength });
  core.debug(`Commit content built successfully: ${content}`);

  await postSlackMessage({
    ...params,
    core,
    reviewers,
    pullRequest,
  });

  if (!pullRequestId) return;
  await postComment({
    octokit,
    content,
    pullRequestId,
    currentBody: pullRequest.body,
  });
  core.debug('Posted comment successfully');
};

module.exports = async (params) => {
  core.debug(`Params: ${JSON.stringify(params, null, 2)}`);

  const { githubToken, org, repos } = params;
  const octokit = github.getOctokit(githubToken);
  const isSponsor = await checkSponsorship({ octokit, org, repos });
  const telemetry = new Telemetry({ core, isSponsor, telemetry: params.telemetry });
  if (isSponsor) core.info('Thanks for sponsoring this project! 💙');

/*  try {
    telemetry.start(params);
    await run({ ...params, isSponsor, octokit });
    telemetry.success();
  } catch (error) {
    telemetry.error(error);
    throw error;
  } */
};
