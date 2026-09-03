import { useRef, useState } from "react";
import CreditCardVisual from "./CreditCardVisual";
import CardActionsMenu from "./CardActionsMenu";
import type { CreditCard } from "../../types/finance";

interface CardCarouselProps {
  cards: CreditCard[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onEdit: (card: CreditCard) => void;
  onViewDetails: (card: CreditCard) => void;
  onViewInvoices: (card: CreditCard) => void;
  onViewInstallments: (card: CreditCard) => void;
  onArchive: (card: CreditCard) => void;
  onReactivate: (card: CreditCard) => void;
  onDelete: (card: CreditCard) => void;
}

export default function CardCarousel({
  cards,
  selectedId,
  onSelect,
  onEdit,
  onViewDetails,
  onViewInvoices,
  onViewInstallments,
  onArchive,
  onReactivate,
  onDelete,
}: CardCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.min(index, cards.length - 1));
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:snap-none sm:overflow-visible sm:px-0"
      >
        {cards.map((card) => (
          <div key={card.id} className="relative w-[82vw] max-w-xs shrink-0 snap-center sm:w-auto">
            <button
              onClick={() => onSelect(card.id)}
              className={`block w-full rounded-2xl text-left ${selectedId === card.id ? "ring-2 ring-brand-500" : ""} ${
                card.archived ? "opacity-60" : ""
              }`}
            >
              <CreditCardVisual card={card} />
            </button>
            <CardActionsMenu
              card={card}
              onEdit={() => onEdit(card)}
              onViewDetails={() => onViewDetails(card)}
              onViewInvoices={() => onViewInvoices(card)}
              onViewInstallments={() => onViewInstallments(card)}
              onArchive={() => onArchive(card)}
              onReactivate={() => onReactivate(card)}
              onDelete={() => onDelete(card)}
            />
          </div>
        ))}
      </div>

      {cards.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5 sm:hidden">
          {cards.map((card, i) => (
            <span
              key={card.id}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex ? "w-5 bg-brand-600" : "w-1.5 bg-ink-100"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
