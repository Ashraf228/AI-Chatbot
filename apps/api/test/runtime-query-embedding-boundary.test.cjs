const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isBuiltin } = require('node:module');
const ts = require('typescript');

const API_ROOT = path.join(__dirname, '..');
const SRC_ROOT = path.join(API_ROOT, 'src');
const EMBEDDING_MODULE = path.join(SRC_ROOT, 'vector', 'embedding.service.ts');
const RUNTIME_BOUNDARY_MODULE = path.join(SRC_ROOT, 'knowledge-sources', 'runtime-query-embedding.service.ts');
const DIRECT_CONSUMERS = new Map([
  ['knowledge-sources/runtime-query-embedding.service.ts', ['RuntimeQueryEmbeddingService', 'embedWithResolvedConfig']],
  ['conversation-engine/knowledge-preview-retrieval.service.ts', ['KnowledgePreviewRetrievalService', 'embed']],
]);
const REGISTRATION_ONLY = new Map([
  ['app.module.ts', 'AppModule'],
  ['knowledge-sources/knowledge-sources.module.ts', 'KnowledgeSourcesModule'],
  ['conversation-engine/conversation-engine.module.ts', 'ConversationEngineModule'],
]);
const RUNTIME_CONSUMERS = [
  ['ChatPipelineService', 'ai/chat-pipeline/chat-pipeline.service.ts'],
  ['ToolExecutorService', 'tools/tool-executor.service.ts'],
  ['ToolDispatcherService', 'tools/tool-dispatcher.service.ts'],
];
const CONFIG_PATH = path.join(API_ROOT, 'tsconfig.json');
const PARSED_CONFIG = ts.parseJsonConfigFileContent(
  ts.readConfigFile(CONFIG_PATH, ts.sys.readFile).config,
  ts.sys,
  API_ROOT,
  undefined,
  CONFIG_PATH,
);

function canonicalPath(fileName) {
  return path.resolve(fileName).split(path.sep).join('/');
}

function relativeSourcePath(fileName) {
  return path.relative(SRC_ROOT, fileName).split(path.sep).join('/');
}

function parseSource(fileName, sourceText) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(sourceFile.parseDiagnostics.length, 0, `${relativeSourcePath(fileName)} must parse without diagnostics`);
  return sourceFile;
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function staticModulePath(node) {
  return node && ts.isStringLiteral(node) ? node.text : null;
}

function resolveStaticModule(sourceFileName, specifier, kind) {
  if (isBuiltin(specifier) || (specifier.startsWith('node:') && isBuiltin(specifier.slice(5)))) {
    return { status: 'node_builtin', specifier, kind };
  }
  const resolved = ts.resolveModuleName(specifier, sourceFileName, PARSED_CONFIG.options, ts.sys).resolvedModule?.resolvedFileName;
  if (!resolved) return { status: 'unresolved_error', specifier, kind };
  const fileName = canonicalPath(resolved);
  return fileName.startsWith(`${canonicalPath(SRC_ROOT)}/`)
    ? { status: 'resolved_project_module', specifier, kind, fileName }
    : { status: 'resolved_external_package', specifier, kind, fileName };
}

function allTypeScriptFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(fullPath);
    }
  }
  return files;
}

function staticModuleReferences(sourceFile) {
  const references = [];
  walk(sourceFile, (node) => {
    let specifier = null;
    let kind = null;
    if (ts.isImportDeclaration(node)) {
      specifier = staticModulePath(node.moduleSpecifier);
      kind = 'import';
    } else if (ts.isExportDeclaration(node)) {
      specifier = staticModulePath(node.moduleSpecifier);
      kind = 're-export';
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      specifier = staticModulePath(node.arguments[0]);
      kind = 'require';
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      specifier = staticModulePath(node.arguments[0]);
      kind = 'dynamic-import';
    }
    if (specifier !== null) references.push({ node, ...resolveStaticModule(sourceFile.fileName, specifier, kind) });
  });
  return references;
}

function assertResolvedReferences(sourceFile) {
  for (const reference of staticModuleReferences(sourceFile)) {
    assert.notEqual(
      reference.status,
      'unresolved_error',
      `${relativeSourcePath(sourceFile.fileName)}: ${reference.kind} "${reference.specifier}" resolution status unresolved_error`,
    );
  }
}

function embeddingReferences(sourceFile) {
  assertResolvedReferences(sourceFile);
  return staticModuleReferences(sourceFile).filter((reference) =>
    reference.status === 'resolved_project_module' && reference.fileName === canonicalPath(EMBEDDING_MODULE));
}

function namedImportBinding(reference, exportedName) {
  if (!ts.isImportDeclaration(reference.node)) return null;
  const named = reference.node.importClause?.namedBindings;
  if (!named || !ts.isNamedImports(named)) return null;
  const element = named.elements.find((candidate) => (candidate.propertyName || candidate.name).text === exportedName);
  return element ? element.name.text : null;
}

function isImportBindingIdentifier(node, importDeclaration, bindingName) {
  const named = importDeclaration.importClause?.namedBindings;
  return Boolean(named && ts.isNamedImports(named)
    && named.elements.some((element) => element.name === node && element.name.text === bindingName));
}

function findClass(sourceFile, className) {
  let found = null;
  walk(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) found = node;
  });
  assert.ok(found, `${className} must be declared`);
  return found;
}

function constructorParameters(classDeclaration) {
  return classDeclaration.members.find(ts.isConstructorDeclaration)?.parameters || [];
}

function typeReferenceName(typeNode) {
  return typeNode && ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)
    ? typeNode.typeName.text
    : null;
}

function injectionProperties(classDeclaration, bindingName) {
  const properties = new Set();
  for (const parameter of constructorParameters(classDeclaration)) {
    if (ts.isIdentifier(parameter.name) && typeReferenceName(parameter.type) === bindingName) properties.add(parameter.name.text);
  }
  return properties;
}

function hasThisMethodCall(sourceFile, propertyNames, methodName) {
  let found = false;
  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    const method = node.expression;
    if (method.name.text !== methodName || !ts.isPropertyAccessExpression(method.expression)) return;
    if (method.expression.expression.kind === ts.SyntaxKind.ThisKeyword && propertyNames.has(method.expression.name.text)) found = true;
  });
  return found;
}

function nestModuleBindings(sourceFile) {
  const bindings = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || staticModulePath(statement.moduleSpecifier) !== '@nestjs/common') continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) {
      if ((element.propertyName || element.name).text === 'Module') bindings.add(element.name.text);
    }
  }
  return bindings;
}

function providerArrayForEmbeddingReference(identifier, sourceFile, expectedClassName, moduleBindings) {
  assert.ok(ts.isArrayLiteralExpression(identifier.parent), 'EmbeddingService must be a direct providers-array element');
  const array = identifier.parent;
  assert.ok(ts.isPropertyAssignment(array.parent) && ts.isIdentifier(array.parent.name) && array.parent.name.text === 'providers',
    'EmbeddingService must be inside the providers property');
  assert.ok(ts.isObjectLiteralExpression(array.parent.parent), 'providers must belong to a Module configuration object');
  assert.ok(array.elements.every((element) => ts.isIdentifier(element)),
    'providers must not contain spreads, nested arrays, objects, or call expressions');
  const objectLiteral = array.parent.parent;
  assert.ok(ts.isCallExpression(objectLiteral.parent) && objectLiteral.parent.arguments.length === 1
    && objectLiteral.parent.arguments[0] === objectLiteral, 'Module configuration must be the direct decorator argument');
  const call = objectLiteral.parent;
  assert.ok(ts.isIdentifier(call.expression) && moduleBindings.has(call.expression.text),
    'Module decorator must use the @nestjs/common Module binding');
  assert.ok(ts.isDecorator(call.parent) && ts.isClassDeclaration(call.parent.parent)
    && call.parent.parent.name?.text === expectedClassName,
  `Module decorator must belong to ${expectedClassName}`);
}

function validateRegistrationOnly(sourceFile, reference, relativePath) {
  const expectedClassName = REGISTRATION_ONLY.get(relativePath);
  assert.ok(expectedClassName, `${relativePath}: unapproved direct EmbeddingService module access`);
  const binding = namedImportBinding(reference, 'EmbeddingService');
  assert.ok(binding, `${relativePath}: registration-only access must be a named EmbeddingService import`);
  const modules = nestModuleBindings(sourceFile);
  assert.ok(modules.size > 0, `${relativePath}: @nestjs/common Module import is required`);
  let validUses = 0;
  walk(sourceFile, (node) => {
    if (!ts.isIdentifier(node) || node.text !== binding || isImportBindingIdentifier(node, reference.node, binding)) return;
    providerArrayForEmbeddingReference(node, sourceFile, expectedClassName, modules);
    validUses += 1;
  });
  assert.equal(validUses, 1, `${relativePath}: EmbeddingService must appear exactly once in @Module providers`);
}

function validateDirectConsumer(sourceFile, reference, relativePath) {
  const expected = DIRECT_CONSUMERS.get(relativePath);
  assert.ok(expected, `${relativePath}: unapproved direct EmbeddingService module access`);
  assert.equal(reference.kind, 'import', `${relativePath}: direct consumers must use a static named import`);
  const binding = namedImportBinding(reference, 'EmbeddingService');
  assert.ok(binding, `${relativePath}: direct consumers must bind EmbeddingService explicitly`);
  const [className, methodName] = expected;
  const properties = injectionProperties(findClass(sourceFile, className), binding);
  assert.ok(properties.size > 0, `${relativePath}: ${className} must inject EmbeddingService`);
  assert.equal(hasThisMethodCall(sourceFile, properties, methodName), true,
    `${relativePath}: ${className} must use the injected embedding service`);
  walk(sourceFile, (node) => {
    assert.equal(ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === binding, false,
      `${relativePath}: EmbeddingService must not be manually constructed`);
  });
}

function classifyEmbeddingAccesses(records) {
  const directConsumers = [];
  const registrations = [];
  for (const record of records) {
    const sourceFile = parseSource(record.fileName, record.sourceText);
    assertResolvedReferences(sourceFile);
    const relativePath = relativeSourcePath(record.fileName);
    for (const reference of embeddingReferences(sourceFile)) {
      if (DIRECT_CONSUMERS.has(relativePath)) {
        validateDirectConsumer(sourceFile, reference, relativePath);
        directConsumers.push(relativePath);
      } else if (relativePath === 'ingest/ingestion-embedding.service.ts') {
        assert.equal(reference.kind, 'import');
        const named = reference.node.importClause?.namedBindings;
        assert.ok(named && ts.isNamedImports(named));
        assert.equal(named.elements.length, 1);
        assert.ok(namedImportBinding(reference, 'resolveEmbeddingConfig'), 'ingestion may import configuration only');
        assert.equal(reference.node.importClause.name, undefined, 'no default embedding-module import');
      } else if (REGISTRATION_ONLY.has(relativePath)) {
        validateRegistrationOnly(sourceFile, reference, relativePath);
        registrations.push(relativePath);
      } else {
        assert.fail(`${relativePath}: forbidden ${reference.kind} access to EmbeddingService module`);
      }
    }
  }
  return { directConsumers: [...new Set(directConsumers)].sort(), registrations: [...new Set(registrations)].sort() };
}

function productionRecords() {
  return allTypeScriptFiles(SRC_ROOT).map((fileName) => ({ fileName, sourceText: fs.readFileSync(fileName, 'utf8') }));
}

function runtimeBoundaryBindings(sourceFile) {
  const bindings = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const specifier = staticModulePath(statement.moduleSpecifier);
    if (!specifier) continue;
    const resolution = resolveStaticModule(sourceFile.fileName, specifier, 'import');
    assert.notEqual(resolution.status, 'unresolved_error', `${relativeSourcePath(sourceFile.fileName)}: unresolved runtime boundary import`);
    if (resolution.status !== 'resolved_project_module' || resolution.fileName !== canonicalPath(RUNTIME_BOUNDARY_MODULE)) continue;
    const named = statement.importClause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) {
      if ((element.propertyName || element.name).text === 'RuntimeQueryEmbeddingService') bindings.add(element.name.text);
    }
  }
  return bindings;
}

function assertRuntimeConsumerBoundary(className, relativePath) {
  const fileName = path.join(SRC_ROOT, relativePath);
  const sourceFile = parseSource(fileName, fs.readFileSync(fileName, 'utf8'));
  assert.deepEqual(embeddingReferences(sourceFile), [], `${relativePath}: must not access EmbeddingService directly`);
  const bindings = runtimeBoundaryBindings(sourceFile);
  assert.ok(bindings.size > 0, `${relativePath}: must import the canonical runtime boundary`);
  const properties = new Set();
  for (const binding of bindings) {
    for (const property of injectionProperties(findClass(sourceFile, className), binding)) properties.add(property);
  }
  assert.ok(properties.size > 0, `${relativePath}: must inject the runtime boundary`);
  assert.equal(hasThisMethodCall(sourceFile, properties, 'embedAuthorizedQuery'), true,
    `${relativePath}: query path must use the injected runtime boundary`);
}

function fixture(relativePath, sourceText) {
  return { fileName: path.join(SRC_ROOT, 'fixtures', relativePath), sourceText };
}

test('repository-wide AST inventory limits direct embedding access to exact consumers and registrations', () => {
  const inventory = classifyEmbeddingAccesses(productionRecords());
  assert.deepEqual(inventory.directConsumers, [...DIRECT_CONSUMERS.keys()].sort());
  assert.deepEqual(inventory.registrations, [...REGISTRATION_ONLY.keys()].sort());
});

test('runtime query embedding consumers use the canonical DI-backed boundary in their query paths', () => {
  for (const [className, relativePath] of RUNTIME_CONSUMERS) assertRuntimeConsumerBoundary(className, relativePath);
});

test('static module resolution distinguishes project files, packages, and Node builtins', () => {
  const sourceFile = parseSource(path.join(SRC_ROOT, 'fixtures', 'resolution.ts'),
    "import '../vector/embedding.service'; import 'typescript'; import 'fs'; import 'node:fs';");
  const statuses = staticModuleReferences(sourceFile).map((reference) => reference.status);
  assert.deepEqual(statuses, ['resolved_project_module', 'resolved_external_package', 'node_builtin', 'node_builtin']);
});

test('unresolved static imports, requires, dynamic imports, and re-exports fail closed', () => {
  const cases = [
    ["import './missing-relative';", 'import', './missing-relative'],
    ["import 'missing-package';", 'import', 'missing-package'],
    ["require('missing-require');", 'require', 'missing-require'],
    ["import('missing-dynamic');", 'dynamic-import', 'missing-dynamic'],
    ["export * from 'missing-reexport';", 're-export', 'missing-reexport'],
    ["import '';", 'import', ''],
    ["require('');", 'require', ''],
    ["import('');", 'dynamic-import', ''],
    ["export * from '';", 're-export', ''],
  ];
  for (const [sourceText, kind, specifier] of cases) {
    const expected = new RegExp(`unresolved\\.ts: ${kind} "${specifier}" resolution status unresolved_error`);
    assert.throws(() => classifyEmbeddingAccesses([fixture('unresolved.ts', sourceText)]), expected);
  }
  const nonStatic = parseSource(path.join(SRC_ROOT, 'fixtures', 'non-static.ts'), "require(variable); import(variable);");
  assert.deepEqual(staticModuleReferences(nonStatic), []);
});

test('AST inventory rejects external consumers, aliases, requires, imports, and re-exports', () => {
  const cases = [
    "import { EmbeddingService } from '../vector/embedding.service'; class Other { constructor(private value: EmbeddingService) {} }",
    "import { EmbeddingService as E } from '../vector/embedding.service'; class Other { constructor(private value: E) {} }",
    "import * as embedding from '../vector/embedding.service'; export const value = embedding.EmbeddingService;",
    "const embedding = require('../vector/embedding.service'); export const value = embedding.EmbeddingService;",
    "const { EmbeddingService: E } = require('../vector/embedding.service'); export const value = E;",
    "export async function load() { return import('../vector/embedding.service'); }",
    "export { EmbeddingService as E } from '../vector/embedding.service';",
    "export * from '../vector/embedding.service';",
  ];
  for (const sourceText of cases) {
    assert.throws(() => classifyEmbeddingAccesses([fixture('external.ts', sourceText)]), /forbidden|unapproved/);
  }
});

test('validated direct consumer and real Module provider registration are accepted', () => {
  const directConsumer = fixture('../conversation-engine/knowledge-preview-retrieval.service.ts',
    "import { EmbeddingService as E } from '../vector/embedding.service'; class KnowledgePreviewRetrievalService { constructor(private readonly embedder: E) {} run() { return this.embedder.embed('x'); } }");
  const registration = fixture('../app.module.ts',
    "import { Module as NestModule } from '@nestjs/common'; import { EmbeddingService } from './vector/embedding.service'; @NestModule({ providers: [EmbeddingService] }) export class AppModule {}");
  assert.deepEqual(classifyEmbeddingAccesses([directConsumer]), { directConsumers: ['conversation-engine/knowledge-preview-retrieval.service.ts'], registrations: [] });
  assert.deepEqual(classifyEmbeddingAccesses([registration]), { directConsumers: [], registrations: ['app.module.ts'] });
});

test('registration-only rejects fake decorators, indirect config, structures, and additional use', () => {
  const invalidCases = [
    "import { EmbeddingService } from './vector/embedding.service'; const x = { providers: [EmbeddingService] };",
    "import { EmbeddingService } from './vector/embedding.service'; function Module() {} @Module({ providers: [EmbeddingService] }) export class AppModule {}",
    "import { Module } from 'typescript'; import { EmbeddingService } from './vector/embedding.service'; @Module({ providers: [EmbeddingService] }) export class AppModule {}",
    "import { Module } from '@nestjs/common'; import { EmbeddingService } from './vector/embedding.service'; @Module({ providers: [EmbeddingService] }) export class WrongModule {}",
    "import { Module } from '@nestjs/common'; import { EmbeddingService } from './vector/embedding.service'; const config = { providers: [EmbeddingService] }; @Module(config) export class AppModule {}",
    "import { Module } from '@nestjs/common'; import { EmbeddingService } from './vector/embedding.service'; @Module({ providers: [...items, EmbeddingService] }) export class AppModule {}",
    "import { Module } from '@nestjs/common'; import { EmbeddingService } from './vector/embedding.service'; @Module({ providers: [[EmbeddingService]] }) export class AppModule {}",
    "import { Module } from '@nestjs/common'; import { EmbeddingService } from './vector/embedding.service'; @Module({ providers: [{ provide: 'x', useValue: EmbeddingService }] }) export class AppModule {}",
    "import { Module } from '@nestjs/common'; import { EmbeddingService } from './vector/embedding.service'; @Module({ providers: [EmbeddingService], exports: [EmbeddingService] }) export class AppModule {}",
  ];
  for (const sourceText of invalidCases) {
    assert.throws(() => classifyEmbeddingAccesses([fixture('../app.module.ts', sourceText)]));
  }
});

test('site runtime boundary performs the grant lookup inside RuntimeQueryEmbeddingService', () => {
  const fileName = path.join(SRC_ROOT, 'knowledge-sources/runtime-query-embedding.service.ts');
  const sourceFile = parseSource(fileName, fs.readFileSync(fileName, 'utf8'));
  let hasSiteRuntimeLookup = false;
  let hasGenericLookup = false;
  walk(sourceFile, (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      hasSiteRuntimeLookup ||= node.expression.name.text === 'evaluateSiteRuntimeQueryEmbeddingApprovalFromStorage';
      hasGenericLookup ||= node.expression.name.text === 'evaluateProviderApprovalFromStorage';
    }
  });
  assert.equal(hasSiteRuntimeLookup, true);
  assert.equal(hasGenericLookup, false);
});

// Ingestion no longer has access to the raw shared embedder. Its dedicated gate
// may reuse configuration resolution, but cannot import the ungated service.
test('ingestion inventory rejects reintroduced raw embedding imports', () => {
  assert.throws(() => classifyEmbeddingAccesses([fixture('../ingest/ingest.service.ts',
    "import { EmbeddingService } from '../vector/embedding.service';")]), /forbidden/);
  assert.throws(() => classifyEmbeddingAccesses([fixture('../ingest/ingestion-embedding.service.ts',
    "import { EmbeddingService } from '../vector/embedding.service';")]), /configuration only/);
  assert.doesNotThrow(() => classifyEmbeddingAccesses([fixture('../ingest/ingestion-embedding.service.ts',
    "import { resolveEmbeddingConfig } from '../vector/embedding.service';") ]));
});
