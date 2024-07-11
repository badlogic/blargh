import { blargh } from ".";
import { Config } from "./config";
import { DefaultContextExtender } from "./context";
import { MarkdownTransformer } from "./transform";

export const defaultConfig: Config = {
    inputPath: "",
    outputPath: "",
    watch: false,
    serve: false,
    servePort: 8080,
    debug: false,
    openTag: "<%",
    closeTag: "%>",
    transformedExtensions: [".txt", ".html", ".css", ".js", ".json", ".md"],
    transformers: [MarkdownTransformer],
    contextExtenders: [DefaultContextExtender],
};

function printHelp() {
    console.log(
        `
Arguments:
    --in <path>     Input directory (required)
    --out <path>    Output director (required)
    --watch         Watch input directory for changes
    --debug         Generate debug.js files next to output files
    --serve <port>? Serves the output directory on http://localhost:<port>
    `.trim()
    );
}

function parseArgs(): Config {
    const args = new Map();
    const noValueArgs = new Set<string>(["--watch", "--debug"]);

    for (let i = 2; i < process.argv.length; ) {
        const arg = process.argv[i];
        if (!arg.startsWith("--")) throw new Error("Expect argument name, e.g. --in");
        if (noValueArgs.has(arg)) {
            args.set(arg, "");
            i++;
        } else {
            if (arg == "--serve" && (i + 1 == process.argv.length || process.argv[i + 1].startsWith("--"))) {
                args.set(arg, 8080);
            } else {
                if (i + 1 == process.argv.length) throw new Error("Expected value for argument " + arg);
                const value = process.argv[i + 1];
                args.set(arg, value);
                i += 2;
            }
        }
    }

    if (!args.has("--in")) {
        throw new Error("No input path specified via --in <path>");
    }

    if (!args.has("--out")) {
        throw new Error("No output path specified via --out <path>");
    }

    if (args.has("--serve")) {
        const port = args.get("--serve");
        if (!/^\d+$/.test(port)) throw new Error(`Server port ${port} must be a number`);
        args.set("--serve", parseInt(port));
    }

    return {
        ...defaultConfig,
        inputPath: args.get("--in"),
        outputPath: args.get("--out"),
        watch: args.has("--watch"),
        serve: args.has("--serve"),
        servePort: args.get("--serve"),
        debug: args.has("--debug"),
    };
}

try {
    let config = parseArgs();
    blargh(config);
} catch (e) {
    console.error("Error: " + (e as any).message ?? e);
    console.log();
    printHelp();
}
