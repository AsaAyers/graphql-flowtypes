// @flow

import * as t from '@babel/types'
import type {
  ASTNode as GQLNode
} from 'graphql'
import {
  parse,
  visit,
  getVisitFn
} from 'graphql'

const mapToNewTree = (getSource, map, visitor) => {
  function replaceNode (node, key, parent, path, ancestors, leaving) {
    var visitFn = getVisitFn(visitor, node.kind, leaving)
    if (visitFn) {
      try {
        const newNode = visitFn.call(visitor, node, key, parent, path, ancestors)
        if (newNode != null) {
          map.set(node, newNode)
        }
      } catch (e) {
        const src = getSource(node)
        e.message = `Error replacing node: \n${node.kind}${src}\n\n  (original error)${e.message}`
        throw e
      }
    }
  }

  return {
    enter (node, key, parent, path, ancestors) {
      replaceNode(node, key, parent, path, ancestors, false)
    },
    leave (node, key, parent, path, ancestors) {
      replaceNode(node, key, parent, path, ancestors, true)
    }
  }
}

function smartIdentifier (node) {
  const { value } = node

  let identifier = t.identifier(value)
  if (value === 'String' || value === 'ID') {
    identifier = t.stringTypeAnnotation()
  }

  return identifier
}

export function transform (schemaText: string): * {
  const graphqlAst = parse(schemaText)
  type BabelNode = mixed
  const map: WeakMap<GQLNode, BabelNode> = new WeakMap()
  const getSource = (graphqlNode) => {
    const { loc } = graphqlNode
    return (loc != null
      ? '\n\n  ' + schemaText.substr(loc.start, loc.end - loc.start)
      : ''
    )
  }

  const get = (graphqlNode) => {
    const replacement = map.get(graphqlNode)
    if (!replacement) {
      const src = getSource(graphqlNode)

      throw new Error(`replacement not found for ${graphqlNode.kind}${src}`)
    }
    return replacement
  }

  // @TODO: My wrapper already hijacks the return of these functions to produce
  // Babel types. Maybe I should drop the `Node: { leave() {} }` too.
  const visitors = {
    Document: {
      leave (node) {
        const body = node.definitions.map(get)
        const directives = []

        return t.program(
          body, directives, 'module'
        )
      }
    },
    NamedType: {
      leave (node, key, parent) {
        return smartIdentifier(node.name)
      }
    },
    ListType: {
      leave (node, key, parent) {
        let listType = get(node.type)
        if (t.isIdentifier(listType)) {
          listType = t.nullableTypeAnnotation(listType)
        }

        let newNode = t.genericTypeAnnotation(
          t.identifier('Array'), t.typeParameterInstantiation(
            [ listType ]
          )
        )

        return newNode
      }
    },
    NonNullType: {
      leave (node) {
        return t.genericTypeAnnotation(
          get(node.type)
        )
      }
    },
    InputValueDefinition: {
      leave (node, parent) {
        return this.FieldDefinition.leave(node, parent)
      }
    },
    FieldDefinition: {
      leave (node, parent) {
        const optional = (node.type.kind !== 'NonNullType')

        let id = smartIdentifier(node.name)
        let value = get(node.type)

        if (optional) {
          value = t.nullableTypeAnnotation(value)
        }

        return {
          ...t.objectTypeProperty(id, value),
          kind: 'init',
          optional,
          static: false,
          variance: null
        }
        // const otp = (
        // )
        // otp.kind = 'init'
        // otp.optional = (node.type.kind !== 'NonNullType')
        //
        // otp.static = false
        // otp.variance = null
        //
        // return otp
      }
    },
    ObjectTypeDefinition: {
      leave (node) {
        const id = t.identifier(node.name.value)
        const typeParameters = null

        const properties = node.fields.map(get)
        const indexers = []
        const callProperties = []

        const body = t.objectTypeAnnotation(properties, indexers, callProperties)

        if (node.interfaces.length > 0) {
          let interfaces = node.interfaces.map(n => {
            return smartIdentifier(n.name)
          })

          const tmp = t.interfaceDeclaration(id, typeParameters, interfaces, body)
          tmp.mixins = []
          return tmp
        }

        body.exact = true
        return t.typeAlias(id, typeParameters, body)
      }
    },
    ScalarTypeDefinition: {
      leave (node) {
        const id = t.identifier(node.name.value)

        // http://graphql.org/learn/schema/#scalar-types
        // > `scalar Date`
        // > it's up to our implementation to define how that type should be
        // > serialized
        //
        // I think the best thing I can do here is make it `any`. Maybe a future
        // version will require passing types for scalar values.
        const impltype = t.anyTypeAnnotation()
        return t.opaqueType(id, null, null, impltype)
      }
    },
    EnumValueDefinition: {
      leave (node) {
        const newNode = t.stringLiteralTypeAnnotation()
        // I don't understand why this isn't a parameter
        newNode.value = node.name.value
        return newNode
      }
    },
    EnumTypeDefinition: {
      leave (node) {
        const id = t.identifier(node.name.value)
        const typeParameters = null
        const types = node.values.map(get)

        const right = t.unionTypeAnnotation(types)

        return t.typeAlias(id, typeParameters, right)
      }
    },
    UnionTypeDefinition: {
      leave (node) {
        const id = t.identifier(node.name.value)
        const typeParameters = null
        const types = node.types.map(get)

        const right = t.unionTypeAnnotation(types)

        return t.typeAlias(id, typeParameters, right)
      }
    },
    InterfaceTypeDefinition: {
      leave (node) {
        const id = t.identifier(node.name.value)
        const typeParameters = null

        const properties = node.fields.map(get)
        const indexers = []
        const callProperties = []
        const body = t.objectTypeAnnotation(properties, indexers, callProperties)
        body.exact = false

        let interfaces = []

        const tmp = t.interfaceDeclaration(id, typeParameters, interfaces, body)
        tmp.mixins = []

        return tmp
      }
    },
    InputObjectTypeDefinition: {
      leave (node) {
        const id = t.identifier(node.name.value)
        const typeParameters = null

        const properties = node.fields.map(get)
        const indexers = []
        const callProperties = []

        const right = t.objectTypeAnnotation(properties, indexers, callProperties)
        right.exact = true

        return t.typeAlias(id, typeParameters, right)
      }
    }
  }

  visit(graphqlAst, mapToNewTree(getSource, map, visitors))

  return get(graphqlAst)
}
