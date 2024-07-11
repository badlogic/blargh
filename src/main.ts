import { blargh } from ".";
import { Config } from "./config";
import { DefaultContextExtender } from "./context";
import { MarkdownTransformer } from "./transform";

export const defaultConfig: Config = {
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

function parseArgs() {
    const args = new Map();
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
        inputPath: args.get("--in"),
        outputPath: args.get("--out"),
        watch: args.has("--watch"),
        debug: args.has("--debug"),
    };
}

try {
    let config = parseArgs();
    blargh(config);
} catch (e) {
    console.error((e as any).message ?? e);
}
