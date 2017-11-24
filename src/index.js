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

const mapToNewTree = (map, visitor) => {
  function replaceNode (node, key, parent, path, ancestors, leaving) {
    var visitFn = getVisitFn(visitor, node.kind, leaving)
    if (visitFn) {
      try {
        const newNode = visitFn.call(visitor, node, key, parent, path, ancestors)
        if (newNode != null) {
          map.set(node, newNode)
        }
      } catch (e) {
        e.message = `Error replacing node \n  kind: ${node.kind}\n  at: ${path}\n  ${e.message}`
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
  const get = (graphqlNode) => {
    const replacement = map.get(graphqlNode)
    if (!replacement) {
      throw new Error(`replacement not found for ${graphqlNode.kind}`)
    }
    return replacement
  }

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
        let identifier = smartIdentifier(node.name)

        if (parent.kind !== 'NonNullType') {
          identifier = t.nullableTypeAnnotation(identifier)
        }
        return identifier
      }
    },
    NonNullType: {
      leave (node) {
        return get(node.type)
      }
    },
    InputValueDefinition: {
      leave (node, parent) {
        const key = t.identifier(node.name.value)

        const value = get(node.type)

        const otp = t.objectTypeProperty(key, value)
        otp.kind = 'init'
        otp.optional = (node.type.kind !== 'NonNullType')

        otp.static = false
        otp.variance = null

        return otp
      }
    },
    FieldDefinition: {
      leave (node, parent) {
        let id = smartIdentifier(node.name)
        let value = get(node.type)

        if (value.type === 'Identifier') {
          value = t.genericTypeAnnotation(value)
        }

        // console.log(value, node)
        const otp = (
          t.objectTypeProperty(id, value)
        )
        otp.kind = 'init'
        otp.optional = (node.type.kind !== 'NonNullType')

        otp.static = false
        otp.variance = null

        return otp
      }
    },
    ObjectTypeDefinition: {
      leave (...args) {
        return this.InputObjectTypeDefinition.leave(...args)
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

        const tmp = t.interfaceDeclaration(id, typeParameters, [], body)
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

  visit(graphqlAst, mapToNewTree(map, visitors))

  return get(graphqlAst)
}
