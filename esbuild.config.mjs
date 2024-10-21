import esbuild from "esbuild";
import process from "process";
import builtins from 'builtin-modules';
import vue from "@the_tree/esbuild-plugin-vue3";

const banner =
    `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = (process.argv[2] === 'production');

await esbuild.build({
    banner: {
        js: banner,
    },
    plugins: [
        vue({ isProd: true }),
    ],
    entryPoints: ['./src/plugin.ts'],
    bundle: true,
    external: [
        'obsidian',
        'electron',
        '@codemirror/autocomplete',
        '@codemirror/closebrackets',
        '@codemirror/collab',
        '@codemirror/commands',
        '@codemirror/comment',
        '@codemirror/fold',
        '@codemirror/gutter',
        '@codemirror/highlight',
        '@codemirror/history',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/matchbrackets',
        '@codemirror/panel',
        '@codemirror/rangeset',
        '@codemirror/rectangular-selection',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/stream-parser',
        '@codemirror/text',
        '@codemirror/tooltip',
        '@codemirror/view',
        ...builtins],
    format: 'cjs',
    watch: !prod,
    target: 'es2016',
    logLevel: "info",
    sourcemap: prod ? false : 'inline',
    minify: prod ? true : false,
    treeShaking: true,
    outfile: 'main.js',
}).catch(() => process.exit(1));

await esbuild.build({
    entryPoints: ["./src/main.css"],
    outfile: "styles.css",
    watch: !prod,
    bundle: true,
    allowOverwrite: true,
    minify: false,
});

// if (!prod) {
// 	fs.rm("./main.css", () => {
// 		console.log("Build completed successfully.")
// 	})
// }