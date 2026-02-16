#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TARGET_DIRS = [path.join(ROOT, 'src', 'app'), path.join(ROOT, 'src', 'features')];
const COMMAND_NAMESPACES = ['beans.', 'brews.', 'coffees.', 'gas.', 'pin.'];

const REGISTER_COMMAND_RE = /registerCommand\s*\(\s*['"]([^'"]+)['"]/g;
const DISPATCH_RES = [
    /\bdispatchCommand\s*\(\s*['"]([^'"]+)['"]/g,
    /\bdispatchWithFallback\s*\(\s*['"]([^'"]+)['"]/g,
    /\bappCommands\s*\?\.\s*dispatch\s*\?\.\s*\(\s*['"]([^'"]+)['"]/g,
    /\bappCommands\.dispatch\s*\(\s*['"]([^'"]+)['"]/g
];

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

const isTrackedCommand = (commandName) =>
    COMMAND_NAMESPACES.some((namespace) => commandName.startsWith(namespace));

const toLine = (source, idx) => source.slice(0, idx).split('\n').length;

const files = TARGET_DIRS.flatMap((dir) => walk(dir));

const registered = new Map();
const dispatchSites = new Map();

for (const file of files) {
    const rel = path.relative(ROOT, file);
    const source = fs.readFileSync(file, 'utf8');

    REGISTER_COMMAND_RE.lastIndex = 0;
    let registerMatch;
    while ((registerMatch = REGISTER_COMMAND_RE.exec(source)) !== null) {
        const commandName = registerMatch[1];
        if (!isTrackedCommand(commandName)) continue;
        if (!registered.has(commandName)) registered.set(commandName, []);
        registered.get(commandName).push({
            file: rel,
            line: toLine(source, registerMatch.index)
        });
    }

    for (const re of DISPATCH_RES) {
        re.lastIndex = 0;
        let dispatchMatch;
        while ((dispatchMatch = re.exec(source)) !== null) {
            const commandName = dispatchMatch[1];
            if (!isTrackedCommand(commandName)) continue;
            if (!dispatchSites.has(commandName)) dispatchSites.set(commandName, []);
            dispatchSites.get(commandName).push({
                file: rel,
                line: toLine(source, dispatchMatch.index)
            });
        }
    }
}

const missing = [];
for (const [commandName, sites] of [...dispatchSites.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!registered.has(commandName)) {
        missing.push({ commandName, sites });
    }
}

if (missing.length) {
    console.error('Dispatch coverage violations detected (dispatched command has no registered owner):');
    for (const issue of missing) {
        console.error(`- ${issue.commandName}`);
        for (const site of issue.sites) {
            console.error(`  - ${site.file}:${site.line}`);
        }
    }
    process.exitCode = 1;
} else {
    console.log(
        `Dispatch coverage checks passed for ${dispatchSites.size} tracked dispatched commands.`
    );
}
