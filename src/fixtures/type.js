
type AcceptTopicSuggestionPayload = {|
  clientMutationId?: ?string,
  topic: Topic,
|}

interface Node {
  id: string,
}

interface AssignedEvent extends Node {
  actor?: ?Actor,
  assignable: Assignable,
  createdAt: DateTime,
  id: string,
  user?: ?User,
}

type Blame = {|
  ranges: Array<BlameRange>
|}
