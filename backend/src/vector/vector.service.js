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
exports.VectorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../db/prisma.service");
let VectorService = class VectorService {
    constructor(db) {
        this.db = db;
    }
    async upsertChunk(params) {
        // Skip duplicates by content_hash per document
        const exists = await this.db.query(`SELECT id FROM chunks WHERE document_id=$1 AND content_hash=$2 LIMIT 1`, [params.documentId, params.contentHash]);
        if (exists.rows[0])
            return { id: exists.rows[0].id, skipped: true };
        await this.db.query(`INSERT INTO chunks(id, site_id, document_id, content, metadata, content_hash, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [params.id, params.siteId, params.documentId, params.content, params.metadata, params.contentHash, params.embedding]);
        return { id: params.id, skipped: false };
    }
    async search(siteId, embedding, k = 6) {
        const res = await this.db.query(`
      SELECT
        c.id,
        c.content,
        c.metadata,
        d.title,
        d.source_url,
        (1 - (c.embedding <=> $2::vector)) AS score
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE c.site_id = $1 AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $2::vector
      LIMIT $3
      `, [siteId, embedding, k]);
        return res.rows;
    }
};
exports.VectorService = VectorService;
exports.VectorService = VectorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VectorService);
