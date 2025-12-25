export default {
  api: {
    input: './openapi.json',
    output: {
      target: './generated/api.ts',
      client: 'fetch',
      clean: true,
    },
  },
};