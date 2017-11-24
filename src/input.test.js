// @flow
/* eslint-env jest */
import generate from '@babel/generator'
import * as t from '@babel/types'
import template from '@babel/template'
import { transform } from '.'
import traverse from '@babel/traverse'

export const parserConfig = {
  plugins: [
    'jsx',
    'flow',
    'doExpressions',
    'objectRestSpread',
    'decorators',
    'classProperties',
    'exportExtensions',
    'asyncGenerators',
    'functionBind',
    'functionSent',
    'dynamicImport'
  ]
}

const stripLocation = (ast) => {
  traverse(ast, {
    enter (path) {
      delete path.node.start
      delete path.node.end
      delete path.node.loc
    }
  })
  // I don't know why traverse doesn't visit the root node
  delete ast.start
  delete ast.end
  delete ast.loc
  return ast
}

const testMacro = ({ graphql, flow }) => async () => {
  // Copied from Github's schema
  const actual = transform(graphql)

  let body = template.ast(flow, parserConfig)
  if (!Array.isArray(body)) {
    body = [ body ]
  }

  const expected = stripLocation(
    t.program(body, [], 'module')
  )
  const actualSource = generate(actual, {}, '').code
  const expectedSource = generate(expected, {}, '').code

  // the AST may have some differences, but what matters is that it generates
  // the correct source.
  expect(actualSource).toEqual(expectedSource)
}

test('will convert a simple `input` containing only scalar types', testMacro({
  // Copied from Github's schema
  graphql: `
  # Autogenerated input type of AcceptTopicSuggestion
  input AcceptTopicSuggestionInput {
    # A unique identifier for the client performing the mutation.
    clientMutationId: String

    # The name of the suggested topic.
    name: String!

    # The Node ID of the repository.
    repositoryId: ID!
  }
  `,
  flow: `
  type AcceptTopicSuggestionInput = {|
    clientMutationId?: ?string,
    name: string,
    repositoryId: string,
  |}
  `
}))

test('will convert a simple `type`', testMacro({
  // Copied from Github's schema
  graphql: `
  # Autogenerated return type of AcceptTopicSuggestion
  type AcceptTopicSuggestionPayload {
    # A unique identifier for the client performing the mutation.
    clientMutationId: String

    # The accepted topic.
    topic: Topic!
  }
  `,
  flow: `
  type AcceptTopicSuggestionPayload = {|
    clientMutationId?: ?string,
    topic: Topic,
  |}
  `
}))

test('will convert an `interface`', testMacro({
  // Copied from Github's schema
  graphql: `
    # Represents an object which can take actions on GitHub. Typically a User or Bot.
    interface Actor {
      # A URL pointing to the actor's public avatar.
      avatarUrl(
        # The size of the resulting square image.
        size: Int
      ): URI!

      # The username of the actor.
      login: String!

      # The HTTP path for this actor.
      resourcePath: URI!

      # The HTTP URL for this actor.
      url: URI!
    }
  `,
  flow: `
    interface Actor {
      avatarUrl: URI,
      login: string,
      resourcePath: URI,
      url: URI,
    }
  `
}))

test('scalar (opaque type)', testMacro({
  graphql: `
    # An RFC 3986, RFC 3987, and RFC 6570 (level 4) compliant URI string.
    scalar URI
  `,
  flow: `
    opaque type URI = any
  `
}))

test('type A implements B', testMacro({
  graphql: `
    # An object with an ID.
    interface Node {
      # ID of the object.
      id: ID!
    }

    # Represents an 'assigned' event on any assignable object.
    type AssignedEvent implements Node {
      # Identifies the actor who performed the event.
      actor: Actor

      # Identifies the assignable associated with the event.
      assignable: Assignable!

      # Identifies the date and time when the object was created.
      createdAt: DateTime!
      id: ID!

      # Identifies the user who was assigned.
      user: User
    }
  `,
  flow: `
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
  `
}))
