import * as path from "path";
import * as fs from "fs";
import { blargh } from ".";
import { Config, defaultConfig } from "./config";

function printHelp() {
    console.log(
        `
Arguments:
    --in <path>     Input directory (required)
    --out <path>    Output director (required)
    --watch         Watch input directory for changes
    --debug         Generate debug.js files next to output files
    --serve <port>? Serves the output directory on http://localhost:<port>
    --extension     File extension to be transformed by the templating engine.
    --version       Outputs the version
    `.trim()
    );
}

function parseArgs(): Config {
    const args = new Map();
    const noValueArgs = new Set<string>(["--watch", "--debug", "--version"]);

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

    if (args.has("--version")) {
        const packageJsonPath = path.resolve(__dirname, '../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        console.log(packageJson.version);
        if (args.size == 1) process.exit(0);
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

    const extensions = [];
    for (const entry of args.entries()) {
        if (entry[0] == "--extension") {
            extensions.push(entry[1]);
        }
    }

    return {
        ...defaultConfig,
        inputPath: args.get("--in"),
        outputPath: args.get("--out"),
        watch: args.has("--watch"),
        serve: args.has("--serve"),
        servePort: args.get("--serve"),
        debug: args.has("--debug"),
        transformedExtensions: [...defaultConfig.transformedExtensions, ...extensions]
    };
}

try {
    let config = parseArgs();
    blargh(config);
} catch (e) {
    console.error("Error: ", e);
    console.log();
    printHelp();
}
