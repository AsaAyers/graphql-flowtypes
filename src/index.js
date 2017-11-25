// @flow

import * as t from '@babel/types'
import type {
  ASTNode as GQLNode
} from 'graphql'
import {
  parse,
  visit
} from 'graphql'

const mapToNewTree = (getSource, map, visitor) => {
  return {
    leave (node, key, parent, path, ancestors) {
      let visitFn = visitor[node.kind]
      // A string value will forward to the visitor for that kind.
      //
      // InputValueDefinition: 'FieldDefinition',
      // FieldDefinition (node, parent) {
      if (typeof visitFn === 'string') {
        visitFn = visitor[visitFn]
      }

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
  }
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

  const visitors = {
    Document (node) {
      const body = node.definitions
        .map(n => t.exportNamedDeclaration(get(n), []))
      const directives = []

      return t.program(
        body, directives, 'module'
      )
    },
    Name (node) {
      const { value } = node

      let identifier = t.identifier(value)
      if (value === 'String' || value === 'ID') {
        identifier = t.stringTypeAnnotation()
      }

      return identifier
    },
    NamedType (node, key, parent) {
      // NamedType doesn't need its own Babel node. It just fowards the type for
      // `.name`
      return get(node.name)
    },
    ListType (node, key, parent) {
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
    },
    NonNullType (node) {
      return t.genericTypeAnnotation(
        get(node.type)
      )
    },
    InputValueDefinition: 'FieldDefinition',
    FieldDefinition (node, parent) {
      const optional = (node.type.kind !== 'NonNullType')

      let id = get(node.name)
      let value = get(node.type)

      if (optional) {
        value = t.nullableTypeAnnotation(value)
      }

      return {
        ...t.objectTypeProperty(id, value),
        optional
      }
    },
    ScalarTypeDefinition (node) {
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
    },
    EnumValueDefinition (node) {
      const newNode = t.stringLiteralTypeAnnotation()
      // I don't understand why this isn't a parameter
      newNode.value = node.name.value
      return newNode
    },
    EnumTypeDefinition: 'commonUnionType',
    UnionTypeDefinition: 'commonUnionType',
    commonUnionType (node) {
      let childKey = 'types'
      if (node.kind === 'EnumTypeDefinition') {
        childKey = 'values'
      }
      const types = node[childKey].map(get)

      const id = t.identifier(node.name.value)
      const typeParameters = null

      return t.typeAlias(
        id,
        typeParameters,
        t.unionTypeAnnotation(types)
      )
    },
    objectTypeHelper (fields) {
      const properties = fields.map(get)
      const indexers = []
      const callProperties = []
      return t.objectTypeAnnotation(properties, indexers, callProperties)
    },
    ObjectTypeDefinition (node) {
      const id = t.identifier(node.name.value)
      const typeParameters = null

      const body = this.objectTypeHelper(node.fields)

      if (node.interfaces.length > 0) {
        let interfaces = node.interfaces.map(n => {
          return get(n.name)
        })

        return t.interfaceDeclaration(id, typeParameters, interfaces, body)
      }

      return t.typeAlias(id, typeParameters, {
        ...body,
        exact: true
      })
    },
    InterfaceTypeDefinition (node) {
      const id = t.identifier(node.name.value)
      const typeParameters = null

      const body = this.objectTypeHelper(node.fields)

      let interfaces = []

      return t.interfaceDeclaration(id, typeParameters, interfaces, body)
    },
    InputObjectTypeDefinition (node) {
      const id = t.identifier(node.name.value)
      const typeParameters = null

      const right = {
        ...this.objectTypeHelper(node.fields),
        exact: true
      }

      return t.typeAlias(id, typeParameters, right)
    }
  }

  visit(graphqlAst, mapToNewTree(getSource, map, visitors))

  return get(graphqlAst)
}
