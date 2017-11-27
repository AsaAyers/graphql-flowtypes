
export type AcceptTopicSuggestionInput = {
  clientMutationId?: ?string,
  name: string,
  repositoryId: string,
}

export type AddPullRequestReviewInput = {
  body?: ?string,
  clientMutationId?: ?string,
  comments?: ?Array<?DraftPullRequestReviewComment>,
  commitOID?: ?GitObjectID,
  event?: ?PullRequestReviewEvent,
  pullRequestId: string,
}
