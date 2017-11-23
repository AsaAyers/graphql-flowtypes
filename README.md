# graphql-flowtypes
Convert all types in a .graphql file into Flow types


# Downloading github's schema

`$GITHUB_TOKEN` is generated from https://github.com/settings/tokens

```
curl -H "Authorization: bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v4.idl" https://api.github.com/graphql | \
  jq -r ".data" > github.graphql
`
