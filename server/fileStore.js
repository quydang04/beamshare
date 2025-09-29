import fs from 'fs';
import path from 'path';

export default class FileStore {
    constructor(storePath) {
        this.storePath = storePath;
        this._lock = Promise.resolve();

        const dir = path.dirname(this.storePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }

        if (!fs.existsSync(this.storePath)) {
            fs.writeFileSync(this.storePath, '[]', 'utf8');
        }
    }

    async _withLock(task) {
        const run = this._lock.then(task);
        this._lock = run.then(() => Promise.resolve(), () => Promise.resolve());
        return run;
    }

    async _readAll() {
        const raw = await fs.promises.readFile(this.storePath, 'utf8');
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return [];
        } catch (error) {
            console.error('Failed to parse metadata store. Recreating file.', error);
            await fs.promises.writeFile(this.storePath, '[]', 'utf8');
            return [];
        }
    }

    async _writeAll(entries) {
        await fs.promises.writeFile(this.storePath, JSON.stringify(entries, null, 2), 'utf8');
    }

    async getAll() {
        return this._withLock(async () => {
            const entries = await this._readAll();
            return entries;
        });
    }

    async getById(id) {
        return this._withLock(async () => {
            const entries = await this._readAll();
            return entries.find(entry => entry.id === id) || null;
        });
    }

    async add(entry) {
        return this._withLock(async () => {
            const entries = await this._readAll();
            entries.push(entry);
            await this._writeAll(entries);
            return entry;
        });
    }

    async update(id, updates) {
        return this._withLock(async () => {
            const entries = await this._readAll();
            const index = entries.findIndex(entry => entry.id === id);
            if (index === -1) {
                return null;
            }
            const updatedEntry = {
                ...entries[index],
                ...updates,
                updatedAt: updates.updatedAt || new Date().toISOString()
            };
            entries[index] = updatedEntry;
            await this._writeAll(entries);
            return updatedEntry;
        });
    }

    async delete(id) {
        return this._withLock(async () => {
            const entries = await this._readAll();
            const index = entries.findIndex(entry => entry.id === id);
            if (index === -1) {
                return null;
            }
            const [removed] = entries.splice(index, 1);
            await this._writeAll(entries);
            return removed;
        });
    }
}
