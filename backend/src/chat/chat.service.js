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
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const embedding_service_1 = require("../vector/embedding.service");
const vector_service_1 = require("../vector/vector.service");
const llm_service_1 = require("../vector/llm.service");
const sites_service_1 = require("../sites/sites.service");
const cors_1 = require("../utils/cors");
const prompt_1 = require("./prompt");
let ChatService = class ChatService {
    constructor(embedder, vector, llm, sites) {
        this.embedder = embedder;
        this.vector = vector;
        this.llm = llm;
        this.sites = sites;
    }
    async reply(dto, origin) {
        const site = await this.sites.getSite(dto.siteId);
        if (!site)
            throw new Error('Invalid siteId');
        const mode = process.env.SITE_DOMAIN_ALLOWLIST_MODE || 'strict';
        if (mode === 'strict') {
            const allowed = site.allowed_domains || [];
            if (!(0, cors_1.isDomainAllowed)(origin, allowed)) {
                throw new Error('Origin not allowed for this siteId');
            }
        }
        const qEmbedding = await this.embedder.embed(dto.message);
        const hits = await this.vector.search(dto.siteId, qEmbedding, 6);
        const context = hits
            .map((h, idx) => {
            const src = h.source_url ? `URL: ${h.source_url}` : `Titel: ${h.title || 'Unbekannt'}`;
            return `# Kontext ${idx + 1} (score ${Number(h.score).toFixed(3)})\n${src}\n${h.content}`;
        })
            .join('\n\n');
        const userPrompt = `
Nutzerfrage:
${dto.message}

Kontext:
${context || '(kein Kontext gefunden)'}
`.trim();
        const answer = await this.llm.answer((0, prompt_1.buildSystemPrompt)(), userPrompt);
        const sources = hits.map((h) => ({
            title: h.title,
            url: h.source_url,
            score: Number(h.score),
            metadata: h.metadata,
        }));
        return { answer, sources };
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [embedding_service_1.EmbeddingService,
        vector_service_1.VectorService,
        llm_service_1.LlmService,
        sites_service_1.SitesService])
], ChatService);
