import { ContextExtender } from "./context";
import { Transformer } from "./transform";

/** Configuration to be passed to {@link blargh()}*/
export interface Config {
    /** Input path to process recursively */
    inputPath: string;
    /** Output path. All contents will be deleted before  */
    outputPath: string;
    /** Whether to watch the input directory for changes */
    watch: boolean;
    /** Whether to serve the output directory on http://localhost:<servePort> */
    serve: boolean;
    /** Port to serve the output directory on */
    servePort: number;
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
