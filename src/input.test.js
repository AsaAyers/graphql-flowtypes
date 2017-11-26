// @flow
/* eslint-env jest */
import fs from 'fs'
import path from 'path'
import * as babylon from 'babylon'
import generate from '@babel/generator'
import * as t from '@babel/types'
import printAst from 'ast-pretty-print'
import { transform } from '.'
import traverse from '@babel/traverse'

export const parserConfig = {
  sourceType: 'module',
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

function gatherExports (node) {
  return {
    type: node.type,
    name: node.declaration.id.name
  }
}

const testMacro = (basename) => async () => {
  const graphql = fs.readFileSync(
    path.join(fixtures, basename + '.graphql')
    , 'UTF8'
  )
  const flow = fs.readFileSync(
    path.join(fixtures, basename + '.js')
    , 'UTF8'
  )

  const actual = transform(graphql)

  let body
  try {
    body = babylon.parse(flow, parserConfig).program.body
  } catch (e) {
    e.message = `Test setup failure: Error parsing fixtures/${basename}.js\n  ${e.message}`
    throw e
  }

  const expected = stripLocation(
    t.program(body, [], 'module')
  )
  const actualSource = generate(actual.ast).code
  const expectedSource = generate(expected).code

  if (actualSource !== expectedSource) {
    // $FlowFixMe
    const actualExports = actual.ast.body.map(gatherExports)
    const expectedExports = expected.body.map(gatherExports)
    // This will verify that the sort is working.
    expect(actualExports).toEqual(expectedExports)

    // Sometimes this is useful in debugging, but it's often too much noise
    // const separator = `\n\n// ***** AST *****\n\n`
    // const actualWithAST = actualSource + separator + printAst(actual.ast)
    // const expectedWithAST = expectedSource + separator + printAst(expected)
    // expect(actualWithAST).toEqual(expectedWithAST)
  }

  // the AST may have some differences, but what matters is that it generates
  // the correct source.
  expect(actualSource).toEqual(expectedSource)
}

const fixtures = path.join(__dirname, 'fixtures')
fs.readdirSync(fixtures)
  .filter(f => path.extname(f) === '.graphql')
  .map(f => path.basename(f, '.graphql'))
  // .filter(f => f === 'reference-sort')
  .map(basename => {
    test(basename, testMacro(basename))
  })
