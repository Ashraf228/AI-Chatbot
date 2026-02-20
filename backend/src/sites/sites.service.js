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
exports.SitesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../db/prisma.service");
let SitesService = class SitesService {
    constructor(db) {
        this.db = db;
    }
    async createSite(id, name, allowedDomains, config = {}) {
        await this.db.query(`INSERT INTO sites(id, name, allowed_domains, config)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, allowed_domains=EXCLUDED.allowed_domains, config=EXCLUDED.config`, [id, name, allowedDomains, config]);
        return this.getSite(id);
    }
    async getSite(id) {
        const res = await this.db.query(`SELECT * FROM sites WHERE id=$1`, [id]);
        return res.rows[0] || null;
    }
    async listSites() {
        const res = await this.db.query(`SELECT * FROM sites ORDER BY created_at DESC`);
        return res.rows;
    }
};
exports.SitesService = SitesService;
exports.SitesService = SitesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SitesService);
