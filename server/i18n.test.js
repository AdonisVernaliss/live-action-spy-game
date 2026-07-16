import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const i18nPath = path.join(projectRoot, "src/lib/i18n.ts");
const i18nSource = fs.readFileSync(i18nPath, "utf8");
const i18nFile = ts.createSourceFile(
  i18nPath,
  i18nSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);

function findVariable(file, name) {
  let initializer = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === name
    ) {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return initializer;
}

function propertyName(property) {
  const name = property.name;
  if (ts.isStringLiteral(name) || ts.isIdentifier(name)) return name.text;
  return null;
}

function objectKeys(object) {
  return object.properties.map(propertyName).filter(Boolean);
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(svelte|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

test("Russian and English dictionaries have identical unique keys", () => {
  const messages = findVariable(i18nFile, "messages");
  const languages = Object.fromEntries(
    messages.properties.map((property) => [
      propertyName(property),
      objectKeys(property.initializer),
    ])
  );

  assert.equal(new Set(languages.ru).size, languages.ru.length);
  assert.equal(new Set(languages.en).size, languages.en.length);
  assert.deepEqual([...languages.en].sort(), [...languages.ru].sort());
});

test("every literal $t key used by the UI exists in both dictionaries", () => {
  const messages = findVariable(i18nFile, "messages");
  const knownKeys = new Set(objectKeys(messages.properties[0].initializer));
  const missing = [];

  for (const file of sourceFiles(path.join(projectRoot, "src"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/\$t\(\s*["']([^"']+)["']/g)) {
      if (!knownKeys.has(match[1])) {
        missing.push(`${path.relative(projectRoot, file)}: ${match[1]}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test("inline bilingual helpers react to language changes", () => {
  const staleHelpers = [];

  for (const file of sourceFiles(path.join(projectRoot, "src"))) {
    const source = fs.readFileSync(file, "utf8");
    if (/\bconst\s+bi\s*=/.test(source)) {
      staleHelpers.push(path.relative(projectRoot, file));
    }
  }

  assert.deepEqual(staleHelpers, []);
});

test("literal server errors have an English translation", () => {
  const serverMessages = findVariable(i18nFile, "serverMessagesEn");
  const serverMessageKeys = objectKeys(serverMessages);
  const translated = new Set(serverMessageKeys);
  const untranslated = new Set();

  assert.equal(translated.size, serverMessageKeys.length);

  for (const filename of ["index.js", "lobbies.js", "player.js"]) {
    const filePath = path.join(projectRoot, "server", filename);
    const source = fs.readFileSync(filePath, "utf8");
    const file = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS
    );

    const visit = (node) => {
      if (ts.isStringLiteral(node) && /[А-Яа-яЁё]/.test(node.text)) {
        const parent = node.parent;
        const inErrorArray =
          ts.isArrayLiteralExpression(parent) &&
          parent.elements[0]?.kind === ts.SyntaxKind.FalseKeyword;
        const inMessageProperty =
          ts.isPropertyAssignment(parent) &&
          propertyName(parent) === "message";
        const inRejectCall =
          ts.isCallExpression(parent) &&
          ["reject", "applyResult"].includes(parent.expression.getText(file));

        if (
          (inErrorArray || inMessageProperty || inRejectCall) &&
          !translated.has(node.text)
        ) {
          untranslated.add(node.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }

  assert.deepEqual([...untranslated].sort(), []);
});
