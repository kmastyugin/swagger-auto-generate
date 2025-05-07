import SwaggerParser from '@apidevtools/swagger-parser';
import mustache from 'mustache';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import type { OpenAPIV3 } from 'openapi-types';

const SWAGGER_DIR = path.resolve(__dirname, '../src/api/swagger');
const TEMPLATE_PATH = path.resolve(__dirname, './templates/class.mustache');
const OUTPUT_DIR = path.resolve(__dirname, '../src/api/api-generated');

function isRef(obj: unknown): obj is { $ref: string } {
  return typeof obj === 'object' && obj !== null && '$ref' in obj;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function pascalCase(str: string): string {
  return str.replace(/(^|[_\-/])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
}

function getSchemaRefName(ref: string): string {
  const match = ref.match(/#\/components\/schemas\/(\w+)/);
  return match ? match[1] : 'unknown';
}

function getOperationTypeName(summary: string | undefined, suffix: string): string {
  if (!summary) return `Unnamed${suffix}`;
  return (
    summary
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^./, (s) => s.toUpperCase()) + suffix
  );
}

async function generateForFile(filePath: string): Promise<void> {
  const baseName = pascalCase(path.basename(filePath, '.json'));
  const className = `${baseName}Api`;
  const typesFile = `${baseName}.types.ts`;
  const apiFile = `${baseName}.api.ts`;
  const outputDir = path.join(OUTPUT_DIR, baseName);

  const api = (await SwaggerParser.bundle(filePath)) as OpenAPIV3.Document;
  const template = await fs.readFile(TEMPLATE_PATH, 'utf-8');

  const tagsMap: Record<string, any[]> = {};
  const importsSet = new Set<string>();
  const knownInterfaces = new Set<string>();
  const inlineMap = new Map<object, string>();
  const schemas = api.components?.schemas || {};
  const nestedInterfaces: string[][] = [];
  const mainInterfaces: string[][] = [];
  const extraArrayResponseInterfaces: string[] = [];

  for (const [name, schema] of Object.entries(schemas)) {
    const chunk: string[] = [];
    renderSchema(
      name,
      schema as OpenAPIV3.SchemaObject,
      chunk,
      knownInterfaces,
      schemas,
      inlineMap,
      name,
      false,
    );
    if (chunk.length > 1) mainInterfaces.push(chunk);
  }

  for (const [pathName, pathItem] of Object.entries(api.paths)) {
    if (!pathItem) continue;

    for (const method of ['get', 'post', 'put', 'delete'] as const) {
      const op = (pathItem as any)[method] as OpenAPIV3.OperationObject;
      if (!op) continue;

      const opId = getOperationTypeName(op.summary, '');
      const tag = op.tags?.[0] || 'Default';
      if (!tagsMap[tag]) tagsMap[tag] = [];

      const params: any[] = [];
      for (const param of op.parameters || []) {
        if (isRef(param)) continue;
        const p = param as OpenAPIV3.ParameterObject;
        params.push({
          name: p.name,
          type: mapJsonSchemaType((p.schema as OpenAPIV3.SchemaObject)?.type),
          required: p.required ?? false,
          in: p.in as 'path' | 'query' | 'header',
        });
      }

      const requestSchema = (op.requestBody as OpenAPIV3.RequestBodyObject)?.content?.[
        'application/json'
      ]?.schema;
      const responseSchema = (
        (op.responses?.['200'] || op.responses?.['201']) as OpenAPIV3.ResponseObject
      )?.content?.['application/json']?.schema;

      let requestType = 'undefined';
      let responseType = 'unknown';

      if (requestSchema) {
        const typeName = getOperationTypeName(op.summary, 'Request');
        const chunk: string[] = [];
        requestType = handleSchemaType(
          requestSchema,
          typeName,
          chunk,
          knownInterfaces,
          schemas,
          inlineMap,
          typeName,
          true,
        );
        if (chunk.length > 1) nestedInterfaces.unshift(chunk);
        importsSet.add(requestType);
        params.push({ name: 'body', type: requestType, required: true, in: 'body' });
      }

      if (responseSchema) {
        const typeName = getOperationTypeName(op.summary, 'Response');

        if (!isRef(responseSchema) && responseSchema.type === 'array' && responseSchema.items) {
          const itemType = isRef(responseSchema.items)
            ? getSchemaRefName(responseSchema.items.$ref)
            : mapJsonSchemaType((responseSchema.items as OpenAPIV3.SchemaObject).type);
          responseType = `${typeName}`;
          extraArrayResponseInterfaces.push(`export type ${typeName} = ${itemType}[];`);
          importsSet.add(typeName);
        } else {
          const chunk: string[] = [];
          responseType = handleSchemaType(
            responseSchema,
            typeName,
            chunk,
            knownInterfaces,
            schemas,
            inlineMap,
            typeName,
            true,
          );
          if (chunk.length > 1) nestedInterfaces.unshift(chunk);
          importsSet.add(responseType);
        }
      }

      tagsMap[tag].push({
        operationName: opId.charAt(0).toLowerCase() + opId.slice(1),
        method,
        path: pathName,
        summary: op.summary || '',
        params,
        response: responseType,
      });
    }
  }

  await fs.ensureDir(outputDir);

  for (const [tag, methods] of Object.entries(tagsMap)) {
    const usedTypes = new Set<string>();
    for (const method of methods) {
      for (const p of method.params) {
        if (p.type && p.type !== 'undefined' && p.type !== 'unknown') {
          usedTypes.add(p.type);
        }
      }
      if (method.response && method.response !== 'unknown') {
        usedTypes.add(method.response);
      }
      const bodyType = method.params.find((p: any) => p.in === 'body')?.type;
      if (bodyType && bodyType !== 'undefined') {
        usedTypes.add(bodyType);
      }
    }

    const filteredImports = Array.from(importsSet).filter((type) => usedTypes.has(type));

    const rendered = mustache.render(template, {
      className,
      baseName,
      imports: filteredImports,
      methods: methods.map((m) => ({
        ...m,
        hasParams: m.params.length > 0,
        pathParams: m.params.filter((p: any) => p.in === 'path'),
        queryParams: m.params.filter((p: any) => p.in === 'query'),
        headerParams: m.params.filter((p: any) => p.in === 'header'),
        requestBody: m.params.find((p: any) => p.in === 'body'),
      })),
    });

    await fs.writeFile(path.join(outputDir, apiFile), rendered);
  }

  const lines = ['/* Auto-generated types */', ''];
  nestedInterfaces.forEach((chunk) => lines.push(...chunk, ''));
  mainInterfaces.forEach((chunk) => lines.push(...chunk, ''));
  lines.push(...extraArrayResponseInterfaces);
  await fs.writeFile(path.join(outputDir, typesFile), lines.join('\n'));

  runFormatting();
  console.log(`✅ Сгенерировано: ${baseName}`);
}

function handleSchemaType(
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
  fallbackName: string,
  lines: string[],
  known: Set<string>,
  allSchemas: Record<string, unknown>,
  inlineMap: Map<object, string>,
  parentKey: string,
  markOptional: boolean,
): string {
  if (isRef(schema)) return getSchemaRefName(schema.$ref);
  if (inlineMap.has(schema)) return inlineMap.get(schema)!;
  renderSchema(fallbackName, schema, lines, known, allSchemas, inlineMap, parentKey, markOptional);
  inlineMap.set(schema, fallbackName);
  return fallbackName;
}

function renderSchema(
  name: string,
  schema: OpenAPIV3.SchemaObject,
  lines: string[],
  known: Set<string>,
  allSchemas: Record<string, unknown>,
  inlineMap: Map<object, string>,
  parentName: string,
  markOptional: boolean,
): void {
  if (known.has(name)) return;
  known.add(name);

  const nestedLines: string[][] = [];
  const props = schema.properties || {};
  const bodyLines: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    const optional = markOptional || !schema.required?.includes(key) ? '?' : '';
    if (isRef(value)) {
      const refName = getSchemaRefName(value.$ref);
      bodyLines.push(`  ${key}${optional}: ${refName};`);
    } else {
      const v = value as OpenAPIV3.SchemaObject;
      if (v.type === 'array' && v.items) {
        const subName = `${name}${capitalize(key)}Item`;
        const itemType = isRef(v.items)
          ? getSchemaRefName(v.items.$ref)
          : (v.items as OpenAPIV3.SchemaObject).type
            ? mapJsonSchemaType((v.items as OpenAPIV3.SchemaObject).type)
            : handleSchemaType(
                v.items,
                subName,
                [],
                known,
                allSchemas,
                inlineMap,
                subName,
                markOptional,
              );
        bodyLines.push(`  ${key}${optional}: ${itemType}[];`);
      } else if (v.type === 'object' && v.properties) {
        const subName = `${name}${capitalize(key)}`;
        const objLines: string[] = [];
        const objType = handleSchemaType(
          v,
          subName,
          objLines,
          known,
          allSchemas,
          inlineMap,
          subName,
          markOptional,
        );
        bodyLines.push(`  ${key}${optional}: ${objType};`);
        nestedLines.unshift(objLines);
      } else {
        bodyLines.push(`  ${key}${optional}: ${mapJsonSchemaType(v.type)};`);
      }
    }
  }

  if (bodyLines.length > 0) {
    for (const nested of nestedLines) lines.unshift(...nested);
    lines.push(`export interface ${name} {`, ...bodyLines, '}');
  }
}

function mapJsonSchemaType(type?: string): string {
  switch (type) {
    case 'string':
    case 'number':
    case 'boolean':
      return type;
    case 'integer':
      return 'number';
    case 'array':
      return 'any[]';
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

function runFormatting(): void {
  try {
    execSync('npx eslint "../src/api/api-generated/**/*.{ts,js,vue}" --fix', {
      stdio: 'inherit',
      cwd: __dirname,
    });
    execSync('npx prettier "../src/api/api-generated/**/*.{ts,js}" --write', {
      stdio: 'inherit',
      cwd: __dirname,
    });
  } catch {
    console.warn('⚠️ Ошибка при форматировании');
  }
}

async function run(): Promise<void> {
  const files = (await fs.readdir(SWAGGER_DIR)).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const fullPath = path.join(SWAGGER_DIR, file);
    await generateForFile(fullPath);
  }
}

run().catch((err) => {
  console.error('❌ Ошибка генерации API:', err);
  process.exit(1);
});
