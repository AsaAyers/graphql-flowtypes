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

  let { code } = generate(ast, {}, '')

  code = `// @flow\n\n${code}`
  fs.writeFileSync(
    filename + '.js.flow',
    code
  )
}

run(...process.argv.slice(2))
