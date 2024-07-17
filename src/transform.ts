import * as fs from "fs";
import hljs from "highlight.js";
import { Marked, Tokens } from "marked";
import { markedHighlight } from "marked-highlight";
import * as path from "path";
import { Config } from "./config";
import { Context } from "./context";
import { compile, interpret } from "./interpreter";
import { serve } from "./server";
import cheerio from 'cheerio';

// Global Marked object with highlight.js support and disabling of indented code blocks.
const marked = new Marked(
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang, info) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            return hljs.highlight(code, { language }).value;
        },
    })
);

marked.use({
    // Taken and updated from https://github.com/markedjs/marked/issues/1696
    tokenizer: {
        code(src: string): Tokens.Code | undefined {
            const cap = this.rules.block.code.exec(src);
            if (cap) {
                const lastToken = this.lexer.tokens[this.lexer.tokens.length - 1];
            if (lastToken && lastToken.type === 'paragraph') {
                return {
                raw: cap[0],
                text: cap[0].trimRight()
                } as any;
            }
              return {
                type: 'html',
                raw: cap[0],
                text: cap[0]
              } as any;
            }
          }
    }
})

/** Transforms the given content and returns the transformed result. You can add transformers via {@link Config.transformers}. */
export type Transformer = (config: Config, context: Context, content: string) => Promise<string>;

/** Markdown transformer which also applies highlight.js to code sections. */
export const MarkdownTransformer: Transformer = async (config: Config, context: Context, output: string) => {
    if (context.inputPath.endsWith(".md")) {
        output = marked.parse(output) as string;
        context.outputPath = context.outputPath.substring(0, context.outputPath.length - 3) + ".html";
    }
    return output;
};

/** Table of contents transformer which will:
 * - Search for %%toc%% in .html output files
 * - Gather all headers from h3 through h4 and give them unique ids of the form toc_<index>
 * - Generate a <ul> from the headers with anchor links and replace %%toc%% with the table of contents
 */
export const TableOfContentTransformer: Transformer = async (config: Config, context: Context, output: string) => {
    if (context.outputPath.endsWith(".html") && output.includes("%%toc%%")) {
        const $ = cheerio.load(output);

        let toc = '<ul>';
        $('h3, h4, h5').each((index, element) => {
            const tag = $(element).get(0)?.tagName;
            const text = $(element).text();
            const id = `toc_${index}`;
            $(element).attr('id', id);
            toc += `<li class="${tag}"><a href="#${id}">${text}</a></li>`;
        });
        toc += '</ul>';

        output = $.html();
        output = output.replace("%%toc%%", toc);
    }
    return output;
};

/**
 * Adds target="_blank" to all <a> elements in HTML output, except for <a> elements with a href starting with "#".
 */
export const TargetBlankTransformer: Transformer = async (config: Config, context: Context, output: string) => {
    if (context.outputPath.endsWith(".html") && !context.isRendered) {
        const $ = cheerio.load(output, { xmlMode: false });

        $('a').each((_, elem) => {
            const href = $(elem).attr('href');
            if (href && !href.startsWith('#')) {
                $(elem).attr('target', '_blank');
            }
        });

        output = $.html()!;
    }
    return output;
}


export async function transform(config: Config, context: Context) {
    let { outputPath, content } = context;
    const outputParentDir = path.resolve(outputPath, "..");
    try {
        const program = compile(content, config.openTag, config.closeTag);
        if (config.debug) {
            if (!fs.existsSync(outputParentDir)) {
                fs.mkdirSync(outputParentDir);
            }
            fs.writeFileSync(outputPath + ".debug.js", program);
        }

        for (const extender of config.contextExtenders) {
            extender(config, context);
        }
        let output = await interpret(program, context);
        for (const transformer of config.transformers) {
            output = await transformer(config, context, output);
        }

        return output;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

async function processFiles(config: Config, callback?: (config: Config, context: Context) => Promise<string>) {
    const start = performance.now();
    const traverseAndProcess = async (currentInputDir: string, currentOutputDir: string) => {
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
                await traverseAndProcess(inputPath, outputPath);
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
                    const context = { inputPath, content, outputPath, isRendered: false};
                    content = await callback(config, context);
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
    await traverseAndProcess(config.inputPath, config.outputPath);

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
 * before processing starts. Optionally watches the input directory for changes, and serves the output directory.
 * See {@link Config} for details. */
export async function blargh(config: Config) {
    config.inputPath = path.resolve(config.inputPath);
    config.outputPath = path.resolve(config.outputPath);

    if (!fs.existsSync(config.inputPath)) {
        throw new Error(`Input path ${config.inputPath} does not exist.`);
    }
    if (!fs.lstatSync(config.inputPath).isDirectory()) {
        throw new Error(`Input path ${config.inputPath} is not a directory.`);
    }

    try {
        await processFiles(config, transform);
    } catch (e) {}

    if (config.watch) {
        fs.watch(config.inputPath, { recursive: true }, async () => {
            try {
                await processFiles(config, transform);
                console.log();
            } catch (e) {}
        });
    }

    if (config.serve) {
        serve(config.outputPath, config.servePort);
    }
}
