export type ResponsePart =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'product-card';
      title: string;
      url: string;
      vendor?: string;
      productType?: string;
      price?: string;
      availability?: 'available' | 'unavailable';
      variantSummary?: string;
    }
  | {
      kind: 'collection-card';
      title: string;
      url: string;
      productCount?: number;
    }
  | {
      kind: 'variant-card';
      title: string;
      url: string;
      price?: string;
      availability?: 'available' | 'unavailable';
    }
  | {
      kind: 'source-card';
      title: string;
      url: string;
    }
  | {
      kind: 'cta';
      action: 'lead_capture';
      label: string;
      description?: string;
    };

type MessageSource = {
  title?: string;
  url?: string;
  score?: number;
  metadata?: unknown;
};

type ProductCard = {
  title: string;
  url: string;
  vendor?: string;
  productType?: string;
  priceMin?: string;
  priceMax?: string;
  currencyCode?: string;
  availableForSale?: boolean;
  variantSummary?: string;
  variants?: Array<{
    id: string;
    title: string;
    url: string;
    price?: string;
    currencyCode?: string;
    availableForSale?: boolean;
  }>;
};

type CollectionCard = {
  title: string;
  url: string;
  productCount?: number;
};

function formatPrice(priceMin?: string, priceMax?: string, currencyCode?: string) {
  if (!priceMin && !priceMax) {
    return undefined;
  }

  const currency = currencyCode || 'EUR';
  if (priceMin && priceMax && priceMin !== priceMax) {
    return `${priceMin} - ${priceMax} ${currency}`;
  }

  return `${priceMin || priceMax} ${currency}`;
}

function normalizeText(value: string) {
  return value.trim();
}

function shouldOfferLeadCapture(route: string, answer: string) {
  if (!['hybrid', 'advisor', 'agent'].includes(route)) {
    return false;
  }

  return /\b(kontakt|anfrage|termin|rueckruf|rückruf|gemeinsam anschauen|durchgehen|melden)\b/i.test(
    answer,
  );
}

export function buildResponseParts(input: {
  answer: string;
  route: string;
  sources?: MessageSource[];
  products?: ProductCard[];
  collections?: CollectionCard[];
  cta?: {
    action: 'lead_capture';
    label: string;
    description?: string;
  };
}) {
  const answer = normalizeText(input.answer);
  const parts: ResponsePart[] = [];

  if (answer) {
    parts.push({
      kind: 'text',
      text: answer,
    });
  }

  for (const product of input.products || []) {
    const url = typeof product.url === 'string' ? product.url.trim() : '';
    const title = typeof product.title === 'string' ? product.title.trim() : '';
    if (!url || !title) {
      continue;
    }

    parts.push({
      kind: 'product-card',
      title,
      url,
      vendor: typeof product.vendor === 'string' ? product.vendor.trim() || undefined : undefined,
      productType:
        typeof product.productType === 'string' ? product.productType.trim() || undefined : undefined,
      price: formatPrice(product.priceMin, product.priceMax, product.currencyCode),
      availability: product.availableForSale === false ? 'unavailable' : 'available',
      variantSummary:
        typeof product.variantSummary === 'string' ? product.variantSummary.trim() || undefined : undefined,
    });

    for (const variant of product.variants || []) {
      const variantUrl = typeof variant.url === 'string' ? variant.url.trim() : '';
      const variantTitle = typeof variant.title === 'string' ? variant.title.trim() : '';
      if (!variantUrl || !variantTitle) {
        continue;
      }

      parts.push({
        kind: 'variant-card',
        title: variantTitle,
        url: variantUrl,
        price: formatPrice(variant.price, undefined, variant.currencyCode),
        availability: variant.availableForSale === false ? 'unavailable' : 'available',
      });
    }
  }

  for (const collection of input.collections || []) {
    const url = typeof collection.url === 'string' ? collection.url.trim() : '';
    const title = typeof collection.title === 'string' ? collection.title.trim() : '';
    if (!url || !title) {
      continue;
    }

    parts.push({
      kind: 'collection-card',
      title,
      url,
      productCount:
        typeof collection.productCount === 'number' && Number.isFinite(collection.productCount)
          ? collection.productCount
          : undefined,
    });
  }

  const seen = new Set<string>();
  for (const source of input.sources || []) {
    const url = typeof source.url === 'string' ? source.url.trim() : '';
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    parts.push({
      kind: 'source-card',
      title:
        (typeof source.title === 'string' && source.title.trim()) || url,
      url,
    });
  }

  if (input.cta) {
    parts.push({
      kind: 'cta',
      action: input.cta.action,
      label: input.cta.label,
      description: input.cta.description,
    });
  } else if (shouldOfferLeadCapture(input.route, answer)) {
    parts.push({
      kind: 'cta',
      action: 'lead_capture',
      label: 'Kontaktdaten hinterlassen',
      description: 'Wir nehmen deine Anfrage direkt auf.',
    });
  }

  return parts;
}
