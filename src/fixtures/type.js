
export type AcceptTopicSuggestionPayload = {|
  clientMutationId?: ?string,
  topic: Topic,
|}

export interface Node {
  id: string,
}

export interface AssignedEvent extends Node {
  actor?: ?Actor,
  number: number,
  assignable: Assignable,
  createdAt: DateTime,
  id: string,
  user?: ?User,
}

export type Blame = {|
  ranges: Array<BlameRange>
|}

export type Query = {|
  nodeById?: (params: { id: string }) => ?Node
|}
