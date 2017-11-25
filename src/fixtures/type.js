
export type AcceptTopicSuggestionPayload = {|
  clientMutationId?: ?string,
  topic: Topic,
|}

export interface Node {
  id: string,
}

export interface AssignedEvent extends Node {
  actor?: ?Actor,
  assignable: Assignable,
  createdAt: DateTime,
  id: string,
  user?: ?User,
}

export type Blame = {|
  ranges: Array<BlameRange>
|}
