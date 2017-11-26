// @flow
import fs from 'fs'
import { transform } from '.'

function run (filename) {
  if (filename == null) {
    throw new Error('filename required')
  }

  const graphql = fs.readFileSync(filename, 'UTF8')
  let { code } = transform(graphql)

  const flowFile = filename + '.js.flow'
  code = `// @flow\n\n${code}\n`
  console.log(`writing ${flowFile}`)
  fs.writeFileSync(flowFile, code)
}

run(...process.argv.slice(2))
