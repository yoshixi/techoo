export default {
  api: {
    input: './openapi.json',
    output: {
      target: './gen/api/endpoints',
      schemas: './gen/api/schemas',
      fileExtension: '.gen.ts',
      client: 'swr',
      mode: 'split',
      override: {
        mutator: {
          path: './lib/api/mutator.ts',
          name: 'customInstance'
        }
      },
      clean: true,
      prettier: true
    }
  }
}
