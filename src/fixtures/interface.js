
export interface Actor {
  avatarUrl: (params: { size?: ?number }) => URI,
  login: string,
  resourcePath: URI,
  url: URI,
}
