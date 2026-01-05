export default {
  api: {
    input: './openapi.json', // Use the generated schema in the same directory
    output: {
      target: './src/renderer/src/gen/api/endpoints',
      schemas: './src/renderer/src/gen/api/schemas',
      fileExtension: '.gen.ts',
      client: 'swr',
      mode: 'split',
      override: {
        mutator: {
          path: './src/renderer/src/lib/api/mutator.ts',
          name: 'customInstance'
        }
      },
      clean: true, // Don't clean to preserve mutator file
      prettier: true
    }
  }
}
