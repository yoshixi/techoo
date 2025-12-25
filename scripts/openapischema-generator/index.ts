import { OpenAPIHono } from '@hono/zod-openapi';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'yaml';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the Hono app from the web app
import { honoApp } from '@apps/web';

// Extract the OpenAPI document from the actual Hono app
const openApiDoc = (honoApp as OpenAPIHono).getOpenAPIDocument({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Shuchu API',
    description: 'API for the Shuchu task management application with OpenAPI documentation'
  }
});

// Write both JSON and YAML versions
const outputDir = path.join(__dirname, '..');

// Write JSON version
const jsonPath = path.join(outputDir, 'openapi.json');
fs.writeFileSync(jsonPath, JSON.stringify(openApiDoc, null, 2), { encoding: 'utf-8' });

// Write YAML version
const yamlString = yaml.stringify(openApiDoc);
const yamlPath = path.join(outputDir, 'openapi.yaml');
fs.writeFileSync(yamlPath, yamlString, { encoding: 'utf-8' });

console.log(`✅ OpenAPI specification generated successfully from apps/web!`);
console.log(`📄 JSON: ${jsonPath}`);
console.log(`📄 YAML: ${yamlPath}`);