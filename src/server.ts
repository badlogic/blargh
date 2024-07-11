import express from 'express';
import path from 'path';
import fs from 'fs';
import { WebSocket, WebSocketServer } from "ws";

export function serve(directory: string, port: number = 8080): void {
    const app = express();

    app.use((req, res, next) => {
        let filePath = path.join(directory, req.path);

        // If the request is to a directory, serve the index.html file in that directory
        if (fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        if (path.extname(filePath) === '.html' && fs.existsSync(filePath)) {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    next(err);
                    return;
                }
                const injected = `<script>
                function liveReload() {
                    if (!location.host.includes("localhost") && !location.host.includes("127.0.0.1")) return;
                    var socket = new WebSocket("ws://" + location.hostname + ":${port}");
                    socket.onmessage = (ev) => {
                        location.reload();
                    };
                }
                liveReload();
                </script></body>`;
                const injectedData = data.replace('</body>', '<script src="/injected.js"></script></body>');
                res.send(data.replace('</body>', injected));
            });
        } else {
            next();
        }
    });

    app.use(express.static(path.resolve(directory)));

    const server = app.listen(port, '127.0.0.1', () => {
        console.log(`Serving static files from ${directory} on http://127.0.0.1:${port}`);
    });

    const wss = new WebSocketServer({ server });
    const clients: Set<WebSocket> = new Set();
    wss.on("connection", (ws: WebSocket) => {
        clients.add(ws);
        ws.on("close", () => {
            clients.delete(ws);
        });
    });

    fs.watch(directory, { recursive: true }, () => {
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(`File changed: ${path}`);
            }
        });
    });
}
