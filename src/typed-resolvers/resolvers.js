// @flow

import type {
  Todo as SchemaTodo,
  Tag as SchemaTag
} from './schema.graphql.js.flow'

type Resolver<Context, Parent, Params, Return> = (Parent, Params, Context) => Return

export type ResolverBundle<Context> = {
  Query: Resolver<Context, {}, mixed, mixed>,
  Mutation?: Resolver<Context, {}, mixed, mixed>,
  [string]: Resolver<Context, mixed, mixed, mixed>,
}

type Loader<Schema, Resolver, Intermediate>
  = Intermediate & $Diff<Schema, Resolver>

type TodoResolver = {
  tags: Array<SchemaTag>
}

type LoaderTodo = Loader<SchemaTodo, TodoResolver, {
  tags: Array<string>
}>

type TagResolver = {
  todos: Array<SchemaTodo>
}
type LoaderTag = Loader<SchemaTag, TagResolver, {
  todos: Array<string>
}>

const context = {
  loadTodo (id: string): LoaderTodo {
    return {
      id,
      text: 'test',
      done: false,
      tags: ['a', 'b']
    }
  },
  loadTag (id: string): LoaderTag {
    return {
      id,
      todos: [ '1' ]
    }
  }
}
type Context = typeof context

const tagResolver = {
  todos (parent: LoaderTag, ignored: Object, context: Context) {
    return parent.todos.map(context.loadTodo)
  }
}

const queryResolver = {
  getTodo (ignored: {}, {id}: {id: string}, context: Context): LoaderTodo {
    return context.loadTodo(id)
  },
  getTag (ignored: {}, {id}: {id: string}): LoaderTag {
    return context.loadTag(id)
  }
}

export const resolvers = {
  Tag: tagResolver,
  Query: queryResolver
}
