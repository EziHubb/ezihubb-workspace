import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// tsconfig.spec.json's `types` array doesn't pick up reflect-metadata's
// global Reflect.getMetadata augmentation the way the main app build does
// (same class of issue as the Express.Multer.File fix earlier this
// session) — this is a test-only, file-local cast, not a shared config
// change, deliberately, so this test doesn't need to touch tooling.
const ReflectMetadata = Reflect as unknown as { getMetadata(key: string, target: unknown): string[] | undefined };

// Regression test for the decorator-order bug found this session: a
// class-level `@Roles(...)` written AFTER `@AdminController(...)` in source
// is silently overwritten, because decorators on one declaration apply
// bottom-to-top and @AdminController(...) internally calls its own
// `Roles(Role.ADMIN, Role.SUPER_ADMIN)` (see admin-controller.decorator.ts).
// The bug is invisible from reading the source — the code looks correct.
//
// This test parses the REAL TypeScript AST (not regex, not code reading) to
// find every class-level and method-level @Roles(...) decorator actually
// written in apps/api/src, then imports the REAL compiled class and checks
// Reflect.getMetadata('roles', ...) against what the source declared. Any
// mismatch means a decorator silently lost its effect — exactly this bug
// class, for any controller, present now or added later. No knowledge of
// which controllers "should" be SUPER_ADMIN-only is needed or hardcoded —
// the invariant is purely structural: whatever @Roles(...) is written in
// source must be what actually takes effect at runtime.

const SRC_ROOT = path.resolve(__dirname, '../../..'); // apps/api/src

interface RolesDeclaration {
  file: string;
  className: string;
  methodName: string | null; // null = class-level
  declaredRoles: string[];
}

function findControllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findControllerFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
      out.push(full);
    }
  }
  return out;
}

function parseRolesArgs(call: ts.CallExpression): string[] | null {
  if (!ts.isIdentifier(call.expression) || call.expression.text !== 'Roles') return null;
  const roles: string[] = [];
  for (const arg of call.arguments) {
    if (ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.name)) {
      roles.push(arg.name.text);
    }
  }
  return roles;
}

function getDecoratorCalls(node: ts.Node): ts.CallExpression[] {
  if (!ts.canHaveDecorators(node)) return [];
  const decorators = ts.getDecorators(node) ?? [];
  return decorators
    .map((d) => d.expression)
    .filter((e): e is ts.CallExpression => ts.isCallExpression(e));
}

function extractRolesDeclarations(filePath: string): RolesDeclaration[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const results: RolesDeclaration[] = [];

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;

      for (const call of getDecoratorCalls(node)) {
        const roles = parseRolesArgs(call);
        if (roles) results.push({ file: filePath, className, methodName: null, declaredRoles: roles });
      }

      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
          for (const call of getDecoratorCalls(member)) {
            const roles = parseRolesArgs(call);
            if (roles) {
              results.push({ file: filePath, className, methodName: member.name.text, declaredRoles: roles });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return results;
}

describe('Roles decorator metadata integrity (all controllers, source vs. runtime)', () => {
  const files = findControllerFiles(SRC_ROOT);
  const declarations = files.flatMap(extractRolesDeclarations);

  // Sanity check on the audit itself — if this is ever 0, the parser broke
  // silently and every test below would vacuously pass.
  it('found at least one @Roles(...) declaration to check (sanity check on the parser itself)', () => {
    expect(declarations.length).toBeGreaterThan(0);
  });

  it.each(declarations.map((d) => [
    `${path.relative(SRC_ROOT, d.file)}::${d.className}${d.methodName ? `.${d.methodName}` : ' (class)'}`,
    d,
  ] as const))('%s — declared @Roles(...) matches real Reflect.getMetadata', async (_label, decl) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- dynamic per-row import is the point of this test
    const mod = require(decl.file.replace(/\.ts$/, ''));
    const Class = mod[decl.className];
    expect(Class).toBeDefined();

    const target = decl.methodName ? Class.prototype[decl.methodName] : Class;
    expect(target).toBeDefined();

    const actualRoles = ReflectMetadata.getMetadata('roles', target);

    expect(new Set(actualRoles)).toEqual(new Set(decl.declaredRoles));
  });
});
