export class SiteEntity {
  id!: string;
  name!: string;
  siteKey!: string;
  domain!: string;
  companyName!: string;
  botName!: string;
  logoUrl?: string;
  brandColor!: string;
  accentColor!: string;
  fontFamily!: string;
  welcomeMessage!: string;
  privacyUrl!: string;
  isActive!: boolean;
}
