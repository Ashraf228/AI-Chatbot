"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../db/prisma.service");
const embedding_service_1 = require("../vector/embedding.service");
const vector_service_1 = require("../vector/vector.service");
const chunk_1 = require("../utils/chunk");
const hash_1 = require("../utils/hash");
const crypto_1 = require("crypto");
const pdf_parse_1 = require("pdf-parse");
let IngestService = class IngestService {
    constructor(db, embedder, vector) {
        this.db = db;
        this.embedder = embedder;
        this.vector = vector;
    }
    async ingestFaq(siteId, title, items) {
        if (!siteId)
            throw new Error('siteId missing');
        const docId = (0, crypto_1.randomUUID)();
        await this.db.query(`INSERT INTO documents(id, site_id, type, title) VALUES ($1,$2,$3,$4)`, [docId, siteId, 'faq', title]);
        let inserted = 0;
        for (const it of items) {
            const content = `Frage: ${it.q}\nAntwort: ${it.a}`.trim();
            if (!content)
                continue;
            const embedding = await this.embedder.embed(content);
            const chId = (0, crypto_1.randomUUID)();
            const res = await this.vector.upsertChunk({
                id: chId,
                siteId,
                documentId: docId,
                content,
                metadata: { kind: 'faq', q: it.q },
                contentHash: (0, hash_1.sha256)(content),
                embedding,
            });
            if (!res.skipped)
                inserted++;
        }
        return { documentId: docId, inserted };
    }
    async ingestPdf(siteId, file) {
        if (!siteId)
            throw new Error('siteId missing');
        if (!file?.buffer)
            throw new Error('file missing');
        const parsed = await (0, pdf_parse_1.default)(file.buffer);
        const text = (parsed.text || '').trim();
        if (!text)
            throw new Error('PDF has no extractable text');
        const docId = (0, crypto_1.randomUUID)();
        await this.db.query(`INSERT INTO documents(id, site_id, type, title) VALUES ($1,$2,$3,$4)`, [docId, siteId, 'pdf', file.originalname]);
        const chunks = (0, chunk_1.chunkText)(text, 1400, 250);
        let inserted = 0;
        for (let i = 0; i < chunks.length; i++) {
            const content = chunks[i];
            const embedding = await this.embedder.embed(content);
            const chId = (0, crypto_1.randomUUID)();
            const res = await this.vector.upsertChunk({
                id: chId,
                siteId,
                documentId: docId,
                content,
                metadata: { kind: 'pdf', filename: file.originalname, chunkIndex: i },
                contentHash: (0, hash_1.sha256)(content),
                embedding,
            });
            if (!res.skipped)
                inserted++;
        }
        return { documentId: docId, chunks: chunks.length, inserted };
    }
};
exports.IngestService = IngestService;
exports.IngestService = IngestService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        embedding_service_1.EmbeddingService,
        vector_service_1.VectorService])
], IngestService);
