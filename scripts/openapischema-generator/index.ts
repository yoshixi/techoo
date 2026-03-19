import { program } from 'commander';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'yaml';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the Hono app from the backend app
import { honoApp } from '@apps/backend';

// Setup CLI with commander
program
  .name('openapi-generator')
  .description('Generate OpenAPI specification from Hono app')
  .version('1.0.0')
  .option('-p, --path <path>', 'output directory path (relative to workspace root)', '../..')
  .option('-f, --format <format>', 'output format: json, yaml, or both', 'both')
  .option('-n, --filename <name>', 'output filename (without extension)', 'openapi')
  .parse(process.argv);

const options = program.opts();

// Calculate output directory - relative to workspace root
const workspaceRoot = path.resolve(__dirname, '../..');
const outputDir = path.resolve(workspaceRoot, options.path);

// Extract the OpenAPI document from the actual Hono app
const openApiDoc = (honoApp as OpenAPIHono).getOpenAPIDocument({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Techoo API',
    description: 'API for the Techoo task management application with OpenAPI documentation'
  }
});

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const generatedFiles: string[] = [];

// Generate JSON format
if (options.format === 'json' || options.format === 'both') {
  const jsonPath = path.join(outputDir, `${options.filename}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(openApiDoc, null, 2), { encoding: 'utf-8' });
  generatedFiles.push(jsonPath);
}

// Generate YAML format
if (options.format === 'yaml' || options.format === 'both') {
  const yamlString = yaml.stringify(openApiDoc);
  const yamlPath = path.join(outputDir, `${options.filename}.yaml`);
  fs.writeFileSync(yamlPath, yamlString, { encoding: 'utf-8' });
  generatedFiles.push(yamlPath);
}

console.log(`✅ OpenAPI specification generated successfully from apps/backend!`);
generatedFiles.forEach((file, index) => {
  const relativeFile = path.relative(workspaceRoot, file);
  console.log(`📄 ${index === 0 ? 'JSON' : 'YAML'}: ${relativeFile}`);
});

// Show usage tip
const relativePath = path.relative(workspaceRoot, outputDir);
console.log(`\n💡 Tip: Use in orval config: input: './${path.join(relativePath, options.filename)}.json'`);
