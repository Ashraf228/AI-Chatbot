import type { ChatMessagePart } from "../../types/chat";

type MessageRichContentProps = {
  parts: ChatMessagePart[];
  onLeadCapture?: () => void | Promise<void>;
};

function renderInlinePart(part: ChatMessagePart, key: string) {
  if (part.kind === "text") {
    return <span key={key}>{part.text}</span>;
  }

  if (part.kind === "link") {
    return (
      <a
        key={key}
        className="ssb-inline-link"
        href={part.url}
        target="_blank"
        rel="noreferrer"
      >
        {part.text}
      </a>
    );
  }

  return null;
}

export function MessageRichContent({ parts, onLeadCapture }: MessageRichContentProps) {
  const inlineParts = parts.filter(
    (part): part is Extract<ChatMessagePart, { kind: "text" | "link" }> =>
      part.kind === "text" || part.kind === "link",
  );
  const cards = parts.filter(
    (part): part is Extract<ChatMessagePart, { kind: "source-card" }> =>
      part.kind === "source-card",
  );
  const productCards = parts.filter(
    (part): part is Extract<ChatMessagePart, { kind: "product-card" }> =>
      part.kind === "product-card",
  );
  const collectionCards = parts.filter(
    (part): part is Extract<ChatMessagePart, { kind: "collection-card" }> =>
      part.kind === "collection-card",
  );
  const variantCards = parts.filter(
    (part): part is Extract<ChatMessagePart, { kind: "variant-card" }> =>
      part.kind === "variant-card",
  );
  const ctas = parts.filter(
    (part): part is Extract<ChatMessagePart, { kind: "cta" }> => part.kind === "cta",
  );

  return (
    <div className="ssb-rich-message">
      <div className="ssb-rich-message__text">
        {inlineParts.map((part, index) => renderInlinePart(part, `${part.kind}-${index}`))}
      </div>
      {cards.length > 0 ? (
        <div className="ssb-rich-message__cards">
          {cards.map((card, index) => (
            <a
              key={`${card.url}-${index}`}
              className="ssb-source-card"
              href={card.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="ssb-source-card__eyebrow">Link</span>
              <strong className="ssb-source-card__title">{card.title}</strong>
              <span className="ssb-source-card__url">{card.url}</span>
            </a>
          ))}
        </div>
      ) : null}
      {productCards.length > 0 ? (
        <div className="ssb-rich-message__cards">
          {productCards.map((card, index) => (
            <a
              key={`${card.url}-${index}`}
              className="ssb-product-card"
              href={card.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="ssb-product-card__eyebrow">Produkt</span>
              <strong className="ssb-product-card__title">{card.title}</strong>
              {card.price ? <span className="ssb-product-card__price">{card.price}</span> : null}
              {card.vendor || card.productType ? (
                <span className="ssb-product-card__meta">
                  {[card.vendor, card.productType].filter(Boolean).join(" · ")}
                </span>
              ) : null}
              {card.variantSummary ? (
                <span className="ssb-product-card__meta">{card.variantSummary}</span>
              ) : null}
              {card.availability ? (
                <span
                  className={`ssb-product-card__availability ssb-product-card__availability--${card.availability}`}
                >
                  {card.availability === "available" ? "Verfuegbar" : "Derzeit nicht verfuegbar"}
                </span>
              ) : null}
              <span className="ssb-product-card__url">{card.url}</span>
            </a>
          ))}
        </div>
      ) : null}
      {collectionCards.length > 0 ? (
        <div className="ssb-rich-message__cards">
          {collectionCards.map((card, index) => (
            <a
              key={`${card.url}-${index}`}
              className="ssb-source-card"
              href={card.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="ssb-source-card__eyebrow">Kategorie</span>
              <strong className="ssb-source-card__title">{card.title}</strong>
              {typeof card.productCount === "number" ? (
                <span className="ssb-source-card__url">{card.productCount} Produkte</span>
              ) : null}
              <span className="ssb-source-card__url">{card.url}</span>
            </a>
          ))}
        </div>
      ) : null}
      {variantCards.length > 0 ? (
        <div className="ssb-rich-message__cards">
          {variantCards.map((card, index) => (
            <a
              key={`${card.url}-${index}`}
              className="ssb-variant-card"
              href={card.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="ssb-variant-card__eyebrow">Variante</span>
              <strong className="ssb-variant-card__title">{card.title}</strong>
              {card.price ? <span className="ssb-variant-card__price">{card.price}</span> : null}
              {card.availability ? (
                <span
                  className={`ssb-variant-card__availability ssb-variant-card__availability--${card.availability}`}
                >
                  {card.availability === "available" ? "Verfuegbar" : "Derzeit nicht verfuegbar"}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}
      {ctas.length > 0 ? (
        <div className="ssb-rich-message__ctas">
          {ctas.map((cta, index) => (
            <button
              key={`${cta.action}-${index}`}
              type="button"
              className="ssb-rich-cta"
              onClick={() => void onLeadCapture?.()}
            >
              <span className="ssb-rich-cta__label">{cta.label}</span>
              {cta.description ? (
                <span className="ssb-rich-cta__description">{cta.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
