import express from "express";
import RateLimit from "express-rate-limit";
import {fileURLToPath} from "url";
import path, {dirname} from "path";
import http from "http";
import fs from "fs";
import multer from "multer";
import {randomUUID} from "crypto";

import FileStore from "./fileStore.js";

export default class BeamShareServer {

    constructor(conf) {
        const app = express();

        app.use(express.json());
        app.use(express.urlencoded({extended: true}));

        if (conf.rateLimit) {
            const limiter = RateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: 1000, // Limit each IP to 1000 requests per `window` (here, per 5 minutes)
                message: 'Too many requests from this IP Address, please try again after 5 minutes.',
                standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
                legacyHeaders: false, // Disable the `X-RateLimit-*` headers
            })

            app.use(limiter);
            // ensure correct client ip and not the ip of the reverse proxy is used for rate limiting
            // see https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues

            app.set('trust proxy', conf.rateLimit);

            if (!conf.debugMode) {
                console.log("Use DEBUG_MODE=true to find correct number for RATE_LIMIT.");
            }
        }

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        const publicPathAbs = path.join(__dirname, '../public');
        app.use(express.static(publicPathAbs));

        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, {recursive: true});
        }

        const fileStore = new FileStore(path.join(uploadsDir, 'metadata.json'));

        const storage = multer.diskStorage({
            destination: (_req, _file, cb) => {
                cb(null, uploadsDir);
            },
            filename: (_req, file, cb) => {
                const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
                const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizedOriginal}`;
                cb(null, uniqueName);
            }
        });

        const upload = multer({storage});

        const buildFileResponse = (entry) => {
            if (!entry) return null;
            const base = `/api/files/${entry.id}`;
            return {
                ...entry,
                downloadUrl: `${base}/download`,
                streamUrl: `${base}/stream`
            };
        };

        const filesRouter = express.Router();

        filesRouter.get('/', async (req, res) => {
            try {
                const visibilityFilter = req.query.visibility;
                let entries = await fileStore.getAll();
                if (visibilityFilter === 'public' || visibilityFilter === 'private') {
                    entries = entries.filter(entry => entry.visibility === visibilityFilter);
                }
                entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                res.json({files: entries.map(buildFileResponse)});
            } catch (error) {
                console.error('Failed to fetch files', error);
                res.status(500).json({message: 'Unable to fetch files'});
            }
        });

        filesRouter.get('/:id', async (req, res) => {
            try {
                const entry = await fileStore.getById(req.params.id);
                if (!entry) {
                    return res.status(404).json({message: 'File not found'});
                }
                res.json({file: buildFileResponse(entry)});
            } catch (error) {
                console.error('Failed to fetch file', error);
                res.status(500).json({message: 'Unable to fetch file'});
            }
        });

        filesRouter.post('/', upload.single('file'), async (req, res) => {
            if (!req.file) {
                return res.status(400).json({message: 'No file provided'});
            }

            try {
                const id = randomUUID();
                const timestamp = new Date().toISOString();
                const visibility = req.body.visibility === 'private' ? 'private' : 'public';

                const entry = {
                    id,
                    originalName: req.file.originalname,
                    storedName: req.file.filename,
                    mimeType: req.file.mimetype,
                    size: req.file.size,
                    visibility,
                    createdAt: timestamp,
                    updatedAt: timestamp
                };

                await fileStore.add(entry);

                res.status(201).json({file: buildFileResponse(entry)});
            } catch (error) {
                console.error('Failed to store file', error);
                res.status(500).json({message: 'Unable to store file'});
            }
        });

        filesRouter.patch('/:id', async (req, res) => {
            try {
                const updates = {};
                if (typeof req.body.visibility === 'string') {
                    updates.visibility = req.body.visibility === 'private' ? 'private' : 'public';
                }
                if (typeof req.body.originalName === 'string' && req.body.originalName.trim().length > 0) {
                    updates.originalName = req.body.originalName.trim();
                }
                updates.updatedAt = new Date().toISOString();

                const entry = await fileStore.update(req.params.id, updates);
                if (!entry) {
                    return res.status(404).json({message: 'File not found'});
                }

                res.json({file: buildFileResponse(entry)});
            } catch (error) {
                console.error('Failed to update file', error);
                res.status(500).json({message: 'Unable to update file'});
            }
        });

        filesRouter.delete('/:id', async (req, res) => {
            try {
                const entry = await fileStore.delete(req.params.id);
                if (!entry) {
                    return res.status(404).json({message: 'File not found'});
                }

                const filePath = path.join(uploadsDir, entry.storedName);
                fs.promises.unlink(filePath).catch(() => {
                    console.warn(`Failed to delete file on disk: ${filePath}`);
                });

                res.status(204).send();
            } catch (error) {
                console.error('Failed to delete file', error);
                res.status(500).json({message: 'Unable to delete file'});
            }
        });

        const streamFile = async (req, res, asAttachment) => {
            try {
                const entry = await fileStore.getById(req.params.id);
                if (!entry) {
                    return res.status(404).json({message: 'File not found'});
                }

                const filePath = path.join(uploadsDir, entry.storedName);
                if (!fs.existsSync(filePath)) {
                    return res.status(410).json({message: 'File has been removed from storage'});
                }

                const dispositionType = asAttachment ? 'attachment' : 'inline';
                res.setHeader('Content-Type', entry.mimeType || 'application/octet-stream');
                res.setHeader('Content-Length', entry.size);
                res.setHeader('Content-Disposition', `${dispositionType}; filename*=UTF-8''${encodeURIComponent(entry.originalName)}`);

                const stream = fs.createReadStream(filePath);
                stream.on('error', (error) => {
                    console.error('Stream error', error);
                    if (!res.headersSent) {
                        res.status(500).end();
                    }
                });
                stream.pipe(res);
            } catch (error) {
                console.error('Failed to stream file', error);
                if (!res.headersSent) {
                    res.status(500).json({message: 'Unable to stream file'});
                }
            }
        };

        filesRouter.get('/:id/download', (req, res) => {
            streamFile(req, res, true);
        });

        filesRouter.get('/:id/stream', (req, res) => {
            streamFile(req, res, false);
        });

        app.use('/api/files', filesRouter);

        if (conf.debugMode && conf.rateLimit) {
            console.debug("\n");
            console.debug("----DEBUG RATE_LIMIT----")
            console.debug("To find out the correct value for RATE_LIMIT go to '/ip' and ensure the returned IP-address is the IP-address of your client.")
            console.debug("See https://github.com/express-rate-limit/express-rate-limit#troubleshooting-proxy-issues for more info")
            app.get('/ip', (req, res) => {
                res.send(req.ip);
            })
        }

        // By default, clients connecting to your instance use the signaling server of your instance to connect to other devices.
        // By using `WS_SERVER`, you can host an instance that uses another signaling server.
        app.get('/config', (req, res) => {
            res.send({
                signalingServer: conf.signalingServer,
                buttons: conf.buttons
            });
        });

        app.get('/drive', (_req, res) => {
            res.sendFile(path.join(publicPathAbs, 'drive.html'));
        });

        app.get('/', (_req, res) => {
            res.sendFile('index.html', {root: publicPathAbs});
            console.log(`Serving client files from:\n${publicPathAbs}`)
        });

        app.use((req, res) => {
            res.redirect(301, '/');
        });

        const hostname = conf.localhostOnly ? '127.0.0.1' : null;
        const server = http.createServer(app);

        server.listen(conf.port, hostname);

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(err);
                console.info("Error EADDRINUSE received, exiting process without restarting process...");
                process.exit(1)
            }
        });

        this.server = server
    }
}