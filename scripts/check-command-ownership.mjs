#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TARGET_DIRS = [path.join(ROOT, 'src', 'app'), path.join(ROOT, 'src', 'features')];
const COMMAND_NAMESPACES = ['beans.', 'brews.', 'coffees.', 'gas.', 'pin.'];

const REGISTER_COMMAND_RE = /registerCommand\s*\(\s*['"]([^'"]+)['"]/g;
const REGISTER_COMPAT_USAGE_RE = /\bregisterCompatCommand\b/g;

const walk = (dir) => {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(abs));
            continue;
        }
        if (entry.isFile() && entry.name.endsWith('.js')) out.push(abs);
    }
    return out;
};

const files = TARGET_DIRS.flatMap((dir) => walk(dir));

const isTrackedCommand = (commandName) =>
    COMMAND_NAMESPACES.some((namespace) => commandName.startsWith(namespace));

const toLine = (source, idx) => source.slice(0, idx).split('\n').length;

const commandOwners = new Map();
const compatUsages = [];

for (const file of files) {
    const rel = path.relative(ROOT, file);
    const source = fs.readFileSync(file, 'utf8');

    REGISTER_COMMAND_RE.lastIndex = 0;
    let match;
    while ((match = REGISTER_COMMAND_RE.exec(source)) !== null) {
        const commandName = match[1];
        if (!isTrackedCommand(commandName)) continue;
        const entry = {
            file: rel,
            line: toLine(source, match.index)
        };
        if (!commandOwners.has(commandName)) commandOwners.set(commandName, []);
        commandOwners.get(commandName).push(entry);
    }

    REGISTER_COMPAT_USAGE_RE.lastIndex = 0;
    let compatMatch;
    while ((compatMatch = REGISTER_COMPAT_USAGE_RE.exec(source)) !== null) {
        compatUsages.push({
            file: rel,
            line: toLine(source, compatMatch.index)
        });
    }
}

const duplicates = [];
for (const [commandName, owners] of [...commandOwners.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (owners.length !== 1) {
        duplicates.push({ commandName, owners });
    }
}

let hasErrors = false;

if (compatUsages.length) {
    hasErrors = true;
    console.error('Disallowed registerCompatCommand usage found under src/app or src/features:');
    for (const usage of compatUsages.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)))) {
        console.error(`- ${usage.file}:${usage.line}`);
    }
}

if (duplicates.length) {
    hasErrors = true;
    if (compatUsages.length) console.error('');
    console.error('Command ownership violations detected (expected exactly one owner):');
    for (const violation of duplicates) {
        console.error(`- ${violation.commandName} has ${violation.owners.length} owners`);
        for (const owner of violation.owners) {
            console.error(`  - ${owner.file}:${owner.line}`);
        }
    }
}

if (!hasErrors) {
    console.log(
        `Command ownership checks passed for ${commandOwners.size} tracked commands; no registerCompatCommand usage detected.`
    );
}

process.exitCode = hasErrors ? 1 : 0;
