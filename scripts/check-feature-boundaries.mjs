#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const FEATURES_ROOT = path.join(ROOT, 'src', 'features');
const SRC_ROOT = path.join(ROOT, 'src');

const IMPORT_RE = /(?:^|\n)\s*import[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g;
const EXPORT_RE = /(?:^|\n)\s*export\s+\*\s+from\s*['"]([^'"]+)['"]/g;

const walk = (dir) => {
    const out = [];
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

const toFeatureName = (absPath) => {
    const rel = path.relative(FEATURES_ROOT, absPath);
    if (rel.startsWith('..')) return null;
    const [feature] = rel.split(path.sep);
    return feature || null;
};

const tryResolveImport = (fromFile, specifier) => {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
    for (const candidate of candidates) {
        if (!candidate.startsWith(SRC_ROOT)) continue;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }
    return null;
};

const collectSpecifiers = (source) => {
    const specs = [];
    for (const re of [IMPORT_RE, EXPORT_RE]) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(source)) !== null) specs.push(match[1]);
    }
    return specs;
};

const files = walk(FEATURES_ROOT);
const crossFeatureImportViolations = [];
const shimCallsites = [];

for (const file of files) {
    const fileFeature = toFeatureName(file);
    if (!fileFeature) continue;
    const source = fs.readFileSync(file, 'utf8');
    const specs = collectSpecifiers(source);

    for (const spec of specs) {
        const resolved = tryResolveImport(file, spec);
        if (!resolved) continue;
        const targetFeature = toFeatureName(resolved);
        if (!targetFeature) continue;
        if (targetFeature !== fileFeature) {
            crossFeatureImportViolations.push({
                file: path.relative(ROOT, file),
                specifier: spec,
                target: path.relative(ROOT, resolved),
                sourceFeature: fileFeature,
                targetFeature
            });
        }
    }

    const rel = path.relative(ROOT, file);
    const shimMatches = [
        { name: 'openBeanCard', re: /\bopenBeanCard\s*\(/g },
        { name: 'openCoffeeCard', re: /\bopenCoffeeCard\s*\(/g },
        { name: 'openBrewForm', re: /\bopenBrewForm\s*\(/g }
    ];
    for (const { name, re } of shimMatches) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(source)) !== null) {
            const line = source.slice(0, m.index).split('\n').length;
            shimCallsites.push({ file: rel, line, name });
        }
    }
}

if (crossFeatureImportViolations.length) {
    console.error('Feature boundary violations detected (cross-feature imports):');
    for (const violation of crossFeatureImportViolations) {
        console.error(
            `- ${violation.file} imports ${violation.specifier} -> ${violation.target} (${violation.sourceFeature} -> ${violation.targetFeature})`
        );
    }
    process.exitCode = 1;
} else {
    console.log('No cross-feature import violations detected under src/features/*.');
}

if (shimCallsites.length) {
    console.log('\nPotential Stage 4 shim callsites (tracking only):');
    for (const callsite of shimCallsites.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)))) {
        console.log(`- ${callsite.file}:${callsite.line} -> ${callsite.name}(...)`);
    }
} else {
    console.log('\nNo potential shim callsites found under src/features/*.');
}
