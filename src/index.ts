import * as path from "path";
import * as fs from "fs";
import { marked } from "marked";

export interface Config {
    textFileExtensions: string[];
    openTag: string;
    closeTag: string;
}

const defaultConfig: Config = {
    textFileExtensions: [".txt", ".html", ".css", ".js", ".json", ".md"],
    openTag: "<%",
    closeTag: "%>",
};

export interface State {
    inputPath: string;
    outputPath: string;
    watch: boolean;
    debug: boolean;
    config: Config;
}

export type Context = {
    inputPath: string;
    content: string;
    outputPath: string;
} & {
    [key: string]: any;
};

type Token = { type: "expression" | "content"; text: string };

export function tokenize(input: string, openTag: string, closeTag: string): Token[] {
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

export function compile(input: string, config: Config): string {
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

function parseArgs(): State {
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
        inputPath: args.get("--in")!,
        outputPath: args.get("--out")!,
        watch: args.has("--watch"),
        debug: args.has("--debug"),
        config: defaultConfig,
    };
}

function evalWithContext(program: string, context: Context): any {
    const func = new Function(`with (this) { return ${program}; }`);
    return func.call(context);
}

function transform(state: State, context: Context) {
    let { inputPath, outputPath, content } = context;
    const inputParentDir = path.resolve(inputPath, "..");
    const outputParentDir = path.resolve(outputPath, "..");
    try {
        const program = compile(content, state.config);
        if (state.debug) fs.writeFileSync(outputPath + ".js", program);

        context.readJson = (filePath: string) => {
            filePath = path.resolve(inputParentDir, filePath);
            return JSON.parse(fs.readFileSync(filePath, "utf-8"));
        };

        context.include = (filePath: string) => {
            const includeInputPath = path.resolve(inputParentDir, filePath);
            const includeOutputPath = path.resolve(outputParentDir, filePath);
            const includeContext = {
                ...context,
                ...{
                    inputPath: includeInputPath,
                    content: fs.readFileSync(includeInputPath, "utf-8"),
                    outputPath: includeOutputPath,
                },
            };
            return transform(state, includeContext);
        };

        context.require = (id: string) => {
            return require(id);
        };

        context.meta = (file: string = "meta.json") => {
            const metaFile = path.resolve(inputParentDir, file);
            const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
            Object.assign(context, meta);
        }

        let output = evalWithContext(program, context);

        if (inputPath.endsWith(".md")) {
            output = marked.parse(output);
            context.outputPath = context.outputPath.substring(0, context.outputPath.length - 3) + ".html";
        }

        return output;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

function processFiles(state: State, callback?: (state: State, context: Context) => string) {
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

            if (inputItem.isDirectory()) {
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
                    return state.config.textFileExtensions.includes(ext);
                };

                if (callback && isTextFile(inputPath)) {
                    let content = fs.readFileSync(inputPath, "utf-8");
                    console.log(`${inputPath} > ${outputPath}`);
                    const context = { inputPath, content, outputPath };
                    content = callback(state, context);
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

    if (!fs.existsSync(state.outputPath)) {
        fs.mkdirSync(state.outputPath, { recursive: true });
    }
    traverseAndProcess(state.inputPath, state.outputPath);

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
    deleteEmptyDirs(state.outputPath);
    console.log(`Took ${(performance.now() - start).toFixed(0)}ms`);
}

try {
    const state = parseArgs();
    state.inputPath = path.resolve(state.inputPath);
    state.outputPath = path.resolve(state.outputPath);

    if (!fs.existsSync(state.inputPath)) {
        throw new Error(`Input path ${state.inputPath} does not exist.`);
    }
    if (!fs.lstatSync(state.inputPath).isDirectory()) {
        throw new Error(`Input path ${state.inputPath} is not a directory.`);
    }

    if (fs.existsSync(state.inputPath + "/config.json")) {
        const config = JSON.parse(fs.readFileSync(state.inputPath + "/config.json", "utf-8"));
        state.config = { ...state.config, ...config };
    }

    try {
        processFiles(state, transform);
    } catch (e) {}

    if (state.watch) {
        fs.watch(state.inputPath, { recursive: true }, () => {
            try {
                processFiles(state, transform);
            } catch (e) {}
        });
    }
} catch (e) {
    console.error((e as Error).message);
}
