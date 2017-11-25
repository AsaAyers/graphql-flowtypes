// @flow
import fs from 'fs'
import { transform } from '.'
import generate from '@babel/generator'

function run (filename) {
  if (filename == null) {
    throw new Error('filename required')
  }

  const graphql = fs.readFileSync(filename, 'UTF8')
  const ast = transform(graphql)

  console.log(generate(ast, {}, ''))
}

run(...process.argv.slice(2))
