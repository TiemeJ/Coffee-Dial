import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const ENTRYPOINT = path.join(ROOT, 'src', 'app', 'bootstrap.js');

const copyIfExists = async (fromRel, toRel = fromRel) => {
    const from = path.join(ROOT, fromRel);
    const to = path.join(DIST_DIR, toRel);
    await cp(from, to, { recursive: true });
};

const findBootstrapOutput = (metafile = null) => {
    const outputs = metafile?.outputs || {};
    for (const [outfile, outputMeta] of Object.entries(outputs)) {
        const entry = outputMeta?.entryPoint ? path.resolve(outputMeta.entryPoint) : '';
        if (entry === ENTRYPOINT) {
            return path.relative(DIST_DIR, path.resolve(outfile)).split(path.sep).join('/');
        }
    }
    throw new Error('Could not find bundled bootstrap output in esbuild metafile');
};

const rewriteIndexHtml = async (bootstrapOutfileRel) => {
    const indexPath = path.join(ROOT, 'index.html');
    const indexHtml = await readFile(indexPath, 'utf8');
    const rewritten = indexHtml.replace(
        /<script type="module" src="\.\/src\/app\/bootstrap\.js"><\/script>/,
        `<script type="module" src="./${bootstrapOutfileRel}"></script>`
    );
    if (rewritten === indexHtml) {
        throw new Error('Failed to rewrite bootstrap script tag in index.html');
    }
    await writeFile(path.join(DIST_DIR, 'index.html'), rewritten, 'utf8');
};

const main = async () => {
    await rm(DIST_DIR, { recursive: true, force: true });
    await mkdir(ASSETS_DIR, { recursive: true });

    const result = await build({
        entryPoints: [ENTRYPOINT],
        bundle: true,
        splitting: true,
        format: 'esm',
        target: 'es2022',
        minify: true,
        sourcemap: false,
        outdir: ASSETS_DIR,
        entryNames: '[name]-[hash]',
        chunkNames: 'chunks/[name]-[hash]',
        metafile: true,
        external: ['https://*', 'http://*']
    });

    const bootstrapOutfileRel = findBootstrapOutput(result.metafile);

    await Promise.all([
        copyIfExists('src'),
        copyIfExists('vendor'),
        copyIfExists('img'),
        copyIfExists('404.html'),
        copyIfExists('favicon.ico'),
        copyIfExists('manifest.json'),
        copyIfExists('sw.js'),
        copyIfExists('firebase.json'),
        copyIfExists('firebase.notifications.functions.json')
    ]);

    await rewriteIndexHtml(bootstrapOutfileRel);

    console.log(`[build] bootstrap -> ${bootstrapOutfileRel}`);
    console.log('[build] output: dist/');
};

main().catch((error) => {
    console.error('[build] failed:', error);
    process.exit(1);
});
