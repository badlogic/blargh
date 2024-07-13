import { Context } from "./context";

/** A token, either a JavaScript expression, or a content text */
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

const prologue = `(async () => {
let __out = "";
`;

const epilogue = `\n\nreturn __out;
})()`;

function escapeString(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

/** Compiles the input string into a anonymous JavaScript function that evaluates expression tokens
 * and append content tokens to the output. */
export function compile(input: string, openTag: string, closeTag: string): string {
    const tokens = tokenize(input, openTag, closeTag);
    let program = prologue;
    for (const token of tokens) {
        if (token.type === "expression") {
            if (token.text.startsWith("=")) {
                program += `\n__out += await (${token.text.substring(1)})`;
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

// Runs the program with the given context. Properties from the context are
// accessible globally within the program.
export function interpret(program: string, context: Context): Promise<any> {
    const func = new Function(`with (this) { return ${program}; }`);
    return func.call(context);
}
