import * as fs from "fs";
import path from "path";
import { Config } from "./config";
import { RssChannel, RssItem, toRssXml } from "./rss";
import { transform } from "./transform";

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

/** Adds additional properties, like utility functions, to the context object. You can add
 * additional extenders via {@link Config.contextExtenders}. */
export type ContextExtender = (config: Config, context: Context) => void;

/**
 * Default utility functions added to every context object.
 *
 * * `readDir(filePath: string) => { file: string, isDirectory: boolean }[]`: returns a list of files in the given directory
 * * `fileExists(filePath: string) => boolean`: returns true if the file exists, false otherwise
 * * `render(filePath: string, context?: any) => string`: reads the given file, transforms it via the {@link Transformer}s in {@link Config.transformers},
 *    and returns the resulting output string. The optional `context` will be merged with the context from the file in which `render()` was called.
 * * `require(id: string) => any`: pass through to Node.js' `require()`. Allows you to load any module in your template.
 * * `meta(filePath: string) => void`: reads the given JSON file and merges its content with the current context. If omitted, `filePath` defaults to
 *   `./meta.json`.
 * * `metas(dirPath: string) => { directory: string, data: any }[]`: recursively finds all `meta.json` files in the subdirectories of the given `directory`.
 * * `rss(filePath: string, channel: {title: string, description: string, link: string}, items: {title: string, description: string, link: string, pubdate: string}[])`:
 *    writes RSS XML based on the channel and items to the file path.
 */
export const DefaultContextExtender: ContextExtender = (config: Config, context: Context) => {
    const inputParentDir = path.resolve(context.inputPath, "..");
    const outputParentDir = path.resolve(context.outputPath, "..");

    const parentContext = context;
    context.render = (filePath: string, context: any) => {
        const includeInputPath = path.resolve(inputParentDir, filePath);
        const includeOutputPath = path.resolve(outputParentDir, filePath);
        const includeContext = {
            ...parentContext,
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

    context.metas = (dirPath: string = "") => {
        dirPath = path.resolve(inputParentDir, dirPath);

        const findMetas = (dir: string): any[] => {
            let metas: any[] = [];
            const files = fs.readdirSync(dir);

            for (const file of files) {
                const fullPath = path.resolve(dir, file);
                const metaPath = path.resolve(fullPath, "meta.json");

                if (fs.existsSync(metaPath)) {
                    metas.push({
                        directory: path.relative(dirPath, fullPath),
                        meta: JSON.parse(fs.readFileSync(metaPath, "utf-8")),
                    });
                } else if (fs.lstatSync(fullPath).isDirectory()) {
                    metas = metas.concat(findMetas(fullPath));
                }
            }

            return metas;
        };

        return findMetas(dirPath);
    };

    context.rss = (filePath: string, channel: RssChannel, items: RssItem[]) => {
        filePath = path.resolve(outputParentDir, filePath);
        const xml = toRssXml(channel, items);
        fs.writeFileSync(filePath, xml, "utf-8");
    };
};
