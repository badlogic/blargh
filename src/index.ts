import * as path from "path";
import * as fs from "fs";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

const marked = new Marked(
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang, info) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            return hljs.highlight(code, { language }).value;
        },
    })
);

/** Adds additional properties, like utility functions, to the context object. You can add
 * additional extenders via {@link Config.contextExtenders}. */
export type ContextExtender = (config: Config, context: Context) => void;

/**
 * Default utility functions added to every context object.
 *
 * * `readDir(filePath: string) => { file: string, isDirectory: boolean }[]`: returns a list of files in the given directory
 * * `fileExists(filePath: string) => boolean`: returns true if the file exists, false otherwise
 * * `include(filePath: string, context?: any) => string`: reads the given file, transforms it via the {@link Transformer}s in {@link Config.transformers},
 *    and returns the resulting output string. The optional `context` will be merged with the context from the file in which `include()` was called.
 * * `require(id: string) => any`: pass through to Node.js' `require()`. Allows you to load any module in your template.
 * * `meta(filePath: string) => void`: reads the given JSON file and merges its content with the current context. If omitted, `filePath` defaults to
 *   `./meta.json`.
 * * `metas(filePath: string) => { directory: string, data: any }[]`: reads all `meta.json` files in the subdirectories of the given `filePath`.
 */
export const DefaultContextExtender: ContextExtender = (config: Config, context: Context) => {
    const inputParentDir = path.resolve(context.inputPath, "..");
    const outputParentDir = path.resolve(context.outputPath, "..");
    context.readFile = (filePath: string) => {
        filePath = path.resolve(inputParentDir, filePath);
        return fs.readFileSync(filePath, "utf-8");
    };

    context.readDir = (filePath: string) => {
        filePath = path.resolve(inputParentDir, filePath);
        const files = fs.readdirSync(filePath);
        return files.map((f) => {
            const fullPath = path.resolve(filePath, f);
            return {
                file: f,
                isDirectory: fs.statSync(fullPath).isDirectory(),
            };
        });
    };

    context.fileExists = (filePath: string) => {
        filePath = path.resolve(inputParentDir, filePath);
        return fs.existsSync(filePath);
    };

    context.include = (filePath: string, context: any) => {
        const includeInputPath = path.resolve(inputParentDir, filePath);
        const includeOutputPath = path.resolve(outputParentDir, filePath);
        const includeContext = {
            ...context,
            ...{
                inputPath: includeInputPath,
                content: fs.readFileSync(includeInputPath, "utf-8"),
                outputPath: includeOutputPath,
            },
            ...(context ?? {}),
        };
        return transform(config, includeContext);
    };

    context.require = (id: string) => {
        return require(id);
    };

    context.meta = (filePath: string = "meta.json") => {
        const metaFile = path.resolve(inputParentDir, filePath);
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
        Object.assign(context, meta);
    };

    context.metas = (filePath: string = "") => {
        filePath = path.resolve(inputParentDir, filePath);
        const files = fs.readdirSync(filePath);
        const metas: any[] = [];
        for (const file of files) {
            const metaPath = path.resolve(filePath, file, "meta.json");
            if (fs.existsSync(metaPath)) {
                metas.push({
                    directory: file,
                    data: JSON.parse(fs.readFileSync(metaPath, "utf-8")),
                });
            }
        }
        return metas;
    };
};

/** Transforms the given content and returns the transformed result. You can add transformers via {@link Config.transformers}. */
export type Transformer = (config: Config, context: Context, content: string) => string;

/** Markdown transformer which also applies highlight.js to code sections. */
export const MarkdownTransformer: Transformer = (config: Config, context: Context, output: string) => {
    if (context.inputPath.endsWith(".md")) {
        output = marked.parse(output) as string;
        context.outputPath = context.outputPath.substring(0, context.outputPath.length - 3) + ".html";
    }
    return output;
};

/** Configuration to be passed to {@link blargh()}*/
export interface Config {
    /** Input path to process recursively */
    inputPath: string;
    /** Output path. All contents will be deleted before  */
    outputPath: string;
    /** Whether to watch the input directory for changes */
    watch: boolean;
    /** Whether to output `debug.js` files containing the template evaluation script next to the output file. */
    debug: boolean;
    /** Opening tag for expressions, defaults to `<%` */
    openTag: string;
    /** Closing tag for expressions, defaults to `%>` */
    closeTag: string;
    /** File extensions to be transformed. Files matching an extension are assumed to be UTF-8 encoded text files. */
    transformedExtensions: string[];
    /** List of {@link Transformer}s to be applied in sequence to all transformed files. */
    transformers: Transformer[];
    /** List or {@link ContextExtender}s to be applied to the {@link Context} before templates expressions are evaluated. */
    contextExtenders: ContextExtender[];
}

const defaultConfig: Config = {
    inputPath: "",
    outputPath: "",
    watch: false,
    debug: false,
    openTag: "<%",
    closeTag: "%>",
    transformedExtensions: [".txt", ".html", ".css", ".js", ".json", ".md"],
    transformers: [MarkdownTransformer],
    contextExtenders: [DefaultContextExtender],
};

/**
 * Data passed on `this` and thus accessible globally within template expressions in a file. See {@link ContextExtender} on
 * how to add additional data and functions by default. Expressions in a template can modify this object.
 */
export type Context = {
    /** Input path of the current file */
    inputPath: string;
    /** Content of the current file */
    content: string;
    /** Output path of the current file */
    outputPath: string;
} & {
    [key: string]: any;
};

type Token = { type: "expression" | "content"; text: string };

function tokenize(input: string, openTag: string, closeTag: string): Token[] {
    const regex = new RegExp(`(${openTag}[\\s\\S]*?${closeTag})`, "g");
    const segments: Token[] = [];

    input.split(regex).forEach((part) => {
        if (part.startsWith(openTag) && part.endsWith(closeTag)) {
            segments.push({ type: "expression", text: part.substring(openTag.length, part.length - closeTag.length) });
        } else if (part) {
            segments.push({ type: "content", text: part });
        }
    });

    return segments;
}

const prologue = `(() => {
let __out = "";
`;

const epilogue = `\n\nreturn __out;
})()`;

function escapeString(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

function compile(input: string, config: Config): string {
    const tokens = tokenize(input, config.openTag, config.closeTag);
    let program = prologue;
    for (const token of tokens) {
        if (token.type === "expression") {
            if (token.text.startsWith("=")) {
                program += `\n__out += (${token.text.substring(1)})`;
            } else {
                program += "\n" + token.text;
            }
        } else {
            program += `\n__out += "${escapeString(token.text)}";`;
        }
    }
    program += epilogue;
    return program;
}

function evalWithContext(program: string, context: Context): any {
    const func = new Function(`with (this) { return ${program}; }`);
    return func.call(context);
}

function transform(config: Config, context: Context) {
    let { outputPath, content } = context;
    const outputParentDir = path.resolve(outputPath, "..");
    try {
        const program = compile(content, config);
        if (config.debug) {
            if (!fs.existsSync(outputParentDir)) {
                fs.mkdirSync(outputParentDir);
            }
            fs.writeFileSync(outputPath + ".debug.js", program);
        }

        for (const extender of config.contextExtenders) {
            extender(config, context);
        }
        let output = evalWithContext(program, context);
        for (const transformer of config.transformers) {
            output = transformer(config, context, output);
        }
        return output;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

function processFiles(config: Config, callback?: (config: Config, context: Context) => string) {
    const start = performance.now();
    const traverseAndProcess = (currentInputDir: string, currentOutputDir: string) => {
        const inputItems = fs.readdirSync(currentInputDir, { withFileTypes: true });
        const outputItems = fs.readdirSync(currentOutputDir, { withFileTypes: true });

        const inputItemNames = new Set(inputItems.map((item) => item.name));

        // Delete files in output that are not in input
        for (const outputItem of outputItems) {
            const outputPath = path.join(currentOutputDir, outputItem.name);
            if (!inputItemNames.has(outputItem.name)) {
                if (outputItem.isDirectory()) {
                    fs.rmSync(outputPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(outputPath);
                }
            }
        }

        // Process and copy files from input to output
        for (const inputItem of inputItems) {
            const inputPath = path.join(currentInputDir, inputItem.name);
            const outputPath = path.join(currentOutputDir, inputItem.name);

            if (inputItem.isDirectory() && !inputItem.name.startsWith("_")) {
                if (!fs.existsSync(outputPath)) {
                    fs.mkdirSync(outputPath, { recursive: true });
                }
                traverseAndProcess(inputPath, outputPath);
            } else if (inputItem.isFile() && !inputItem.name.startsWith("_")) {
                const inputStat = fs.statSync(inputPath);
                let outputStat: fs.Stats | null = null;

                try {
                    outputStat = fs.statSync(outputPath);
                } catch {
                    outputStat = null;
                }

                const isTextFile = (filePath: string): boolean => {
                    const ext = path.extname(filePath).toLowerCase();
                    return config.transformedExtensions.includes(ext);
                };

                if (callback && isTextFile(inputPath)) {
                    let content = fs.readFileSync(inputPath, "utf-8");
                    console.log(`${inputPath} > ${outputPath}`);
                    const context = { inputPath, content, outputPath };
                    content = callback(config, context);
                    fs.writeFileSync(context.outputPath, content, "utf8");
                } else {
                    if (!outputStat || inputStat.mtime > outputStat.mtime) {
                        console.log(`${inputPath} > ${outputPath}`);
                        const content = fs.readFileSync(inputPath);
                        fs.writeFileSync(outputPath, content);
                    }
                }
            }
        }
    };

    if (!fs.existsSync(config.outputPath)) {
        fs.mkdirSync(config.outputPath, { recursive: true });
    }
    traverseAndProcess(config.inputPath, config.outputPath);

    const deleteEmptyDirs = (dir: string) => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                deleteEmptyDirs(fullPath);
                try {
                    fs.rmdirSync(fullPath);
                } catch {}
            }
        }
    };
    deleteEmptyDirs(config.outputPath);
    console.log(`Took ${(performance.now() - start).toFixed(0)}ms`);
}

/** Transforms and copies files in {@link Config.inputPath} to {@link Config.outputPath}. The output directory is deleted
 * before processing starts. See {@link Config} for details. */
export function blargh(config: Config) {
    config.inputPath = path.resolve(config.inputPath);
    config.outputPath = path.resolve(config.outputPath);

    if (!fs.existsSync(config.inputPath)) {
        throw new Error(`Input path ${config.inputPath} does not exist.`);
    }
    if (!fs.lstatSync(config.inputPath).isDirectory()) {
        throw new Error(`Input path ${config.inputPath} is not a directory.`);
    }

    try {
        processFiles(config, transform);
    } catch (e) {}

    if (config.watch) {
        fs.watch(config.inputPath, { recursive: true }, () => {
            try {
                processFiles(config, transform);
                console.log();
            } catch (e) {}
        });
    }
}

if (require.main === module) {
    function parseArgs(): Config {
        const args = new Map<string, string>();
        const noValueArgs = new Set<string>(["--watch", "--debug"]);

        for (let i = 2; i < process.argv.length; ) {
            const arg = process.argv[i];
            if (!arg.startsWith("--")) throw new Error("Expect argument name, e.g. --in");
            if (noValueArgs.has(arg)) {
                args.set(arg, "");
                i++;
            } else {
                if (i + 1 == process.argv.length) throw new Error("Expected value for argument " + arg);
                const value = process.argv[i + 1];
                args.set(arg, value);
                i += 2;
            }
        }

        if (!args.has("--in")) {
            throw new Error("No input path specified via --in <path>");
        }

        if (!args.has("--out")) {
            throw new Error("No output path specified via --out <path>");
        }

        return {
            ...defaultConfig,
            inputPath: args.get("--in")!,
            outputPath: args.get("--out")!,
            watch: args.has("--watch"),
            debug: args.has("--debug"),
        };
    }

    try {
        let config = parseArgs();
        blargh(config);
    } catch (e) {
        console.error((e as Error).message);
    }
}
