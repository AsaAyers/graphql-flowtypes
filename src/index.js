// @flow

import * as t from '@babel/types'
import type {
  ASTNode as GQLNode
} from 'graphql'
import {
  parse,
  visit
} from 'graphql'

export function transform (schemaText: string): * {
  const graphqlAst = parse(schemaText)
  type BabelNode = mixed
  const map: WeakMap<GQLNode, BabelNode> = new WeakMap()

  const visitors = {
    Document: {
      leave (node) {
        console.log(node)
        const body = node.definitions.map(map.get.bind(map))
        const directives = []

        map.set(node, t.program(
          body, directives, 'module'
        ))
      }
    },
    NamedType: {
      leave (node, key, parent) {
        const { value } = node.name

        let identifier = t.identifier(node.name.value)
        if (value === 'String' || value === 'ID') {
          identifier = t.stringTypeAnnotation()
        }

        if (parent.kind !== 'NonNullType') {
          identifier = t.nullableTypeAnnotation(identifier)
        }

        map.set(node, identifier)
      }
    },
    NonNullType: {
      leave (node) {
        map.set(node,
          map.get(node.type)
        )
        return false
      }
    },
    InputValueDefinition: {
      leave (node, parent) {
        const key = t.identifier(node.name.value)

        const value = map.get(node.type)

        const otp = t.objectTypeProperty(key, value)
        otp.kind = 'init'
        otp.optional = (node.type.kind !== 'NonNullType')

        otp.static = false
        otp.variance = null

        map.set(node, otp)
      }
    },
    InputObjectTypeDefinition: {
      leave (node) {
        const id = t.identifier(node.name.value)
        const typeParameters = null

        const properties = node.fields.map(map.get.bind(map))
        const indexers = []
        const callProperties = []

        const right = t.objectTypeAnnotation(properties, indexers, callProperties)
        right.exact = true

        map.set(node, t.typeAlias(id, typeParameters, right))
        // const NAME = node.name.value
        // const PARAMS = context.params
        // console.log('node', tmpl({ NAME, PARAMS }))
      }
    }
  }

  visit(graphqlAst, visitors)

  return map.get(graphqlAst)
}
