"use client";

import {
  type CSSProperties,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "mckinnon.memory-archive.v1";

type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";

type PlayingCard = {
  id: string;
  rank: Rank;
  suit: Suit;
  x: number;
  y: number;
  rotate: number;
};

type StoredPlayingCard = Pick<PlayingCard, "rank" | "suit">;

type ArchiveMemory = {
  id: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  playingCard?: StoredPlayingCard | null;
  [key: string]: unknown;
};

type Archive = {
  schemaVersion?: number;
  memories?: ArchiveMemory[];
};

type CardStage = {
  form: HTMLFormElement;
  editingId: string | null;
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const CARDS: PlayingCard[] = [
  { id: "A-hearts", rank: "A", suit: "hearts", x: 1, y: 4, rotate: -8 },
  { id: "2-diamonds", rank: "2", suit: "diamonds", x: 19, y: 1, rotate: 1 },
  { id: "3-clubs", rank: "3", suit: "clubs", x: 38, y: 3, rotate: 7 },
  { id: "4-spades", rank: "4", suit: "spades", x: 57, y: 7, rotate: 10 },
  { id: "5-hearts", rank: "5", suit: "hearts", x: 0, y: 47, rotate: -4 },
  { id: "6-clubs", rank: "6", suit: "clubs", x: 16, y: 45, rotate: 2 },
  { id: "7-diamonds", rank: "7", suit: "diamonds", x: 32, y: 46, rotate: 4 },
  { id: "8-spades", rank: "8", suit: "spades", x: 48, y: 47, rotate: 7 },
  { id: "9-hearts", rank: "9", suit: "hearts", x: 64, y: 48, rotate: 4 },
  { id: "10-clubs", rank: "10", suit: "clubs", x: 80, y: 49, rotate: 5 },
];

const rankCount = (rank: Rank) => (rank === "A" ? 1 : Number(rank));

const cardId = (card: StoredPlayingCard) => `${card.rank}-${card.suit}`;

const parseArchive = (raw: string | null): Archive => {
  if (!raw) return { schemaVersion: 3, memories: [] };
  try {
    const parsed = JSON.parse(raw) as Archive;
    return Array.isArray(parsed.memories)
      ? parsed
      : { schemaVersion: 3, memories: [] };
  } catch {
    return { schemaVersion: 3, memories: [] };
  }
};

const isPlayingCard = (value: unknown): value is StoredPlayingCard => {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<StoredPlayingCard>;
  return (
    typeof card.rank === "string" &&
    ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"].includes(card.rank) &&
    typeof card.suit === "string" &&
    ["hearts", "diamonds", "clubs", "spades"].includes(card.suit)
  );
};

function CardFace({
  card,
  compact = false,
}: {
  card: PlayingCard | StoredPlayingCard;
  compact?: boolean;
}) {
  const symbol = SUIT_SYMBOLS[card.suit];
  const pips = Array.from({ length: rankCount(card.rank) });
  return (
    <span
      className={`mck-playing-card-face suit-${card.suit} ${compact ? "is-compact" : ""}`}
      aria-hidden="true"
    >
      <span className="mck-card-corner mck-card-corner-top">
        <b>{card.rank}</b>
        <i>{symbol}</i>
      </span>
      {!compact && (
        <span
          className={`mck-card-pips pips-${card.rank === "A" ? "ace" : card.rank}`}
        >
          {pips.map((_, index) => (
            <i key={index}>{symbol}</i>
          ))}
        </span>
      )}
      {compact && <span className="mck-card-compact-symbol">{symbol}</span>}
      <span className="mck-card-corner mck-card-corner-bottom">
        <b>{card.rank}</b>
        <i>{symbol}</i>
      </span>
    </span>
  );
}

function PlayingCardStage({
  stage,
  initialCard,
  onBack,
  onSeal,
}: {
  stage: CardStage;
  initialCard: StoredPlayingCard | null;
  onBack: () => void;
  onSeal: (card: StoredPlayingCard) => void;
}) {
  const [selectedId, setSelectedId] = useState(
    initialCard ? cardId(initialCard) : "",
  );
  const [appliedId, setAppliedId] = useState(
    initialCard ? cardId(initialCard) : "",
  );
  const [draggingId, setDraggingId] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const bottleMount = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => CARDS.find((card) => card.id === selectedId) ?? null,
    [selectedId],
  );
  const applied = useMemo(
    () => CARDS.find((card) => card.id === appliedId) ?? null,
    [appliedId],
  );

  const mountBottle = useCallback(() => {
    if (!bottleMount.current) return;
    const source =
      stage.form.querySelector<HTMLElement>(".live-bottle .bottle") ??
      document.querySelector<HTMLElement>(".live-bottle .bottle");
    if (!source) return;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.classList.add("mck-card-stage-bottle");
    clone
      .querySelectorAll(".mck-card-sticker")
      .forEach((node) => node.remove());
    bottleMount.current.replaceChildren(clone);
  }, [stage.form]);

  useEffect(() => {
    mountBottle();
  }, [mountBottle]);

  useEffect(() => {
    const bottle = bottleMount.current?.querySelector<HTMLElement>(
      ".mck-card-stage-bottle",
    );
    if (!bottle) return;
    bottle
      .querySelectorAll(".mck-card-sticker")
      .forEach((node) => node.remove());
    if (!applied) return;
    bottle.append(createStickerNode(applied, "preview"));
  }, [applied]);

  const applySelected = () => {
    if (!selected) return;
    setAppliedId(selected.id);
    setDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const droppedId =
      event.dataTransfer.getData("application/x-mckinnon-card") || draggingId;
    if (!CARDS.some((card) => card.id === droppedId)) return;
    setSelectedId(droppedId);
    setAppliedId(droppedId);
    setDraggingId("");
    setDropActive(false);
  };

  return (
    <div
      className="mck-card-stage"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mck-card-stage-title"
    >
      <div className="mck-card-progress" aria-label="Step 5 of 5">
        {[0, 1, 2, 3, 4].map((item) => (
          <span key={item} className="active" />
        ))}
      </div>
      <button
        className="mck-card-stage-close"
        type="button"
        onClick={onBack}
        aria-label="Return to memory text"
      >
        ×
      </button>

      <section className="mck-card-deck-panel">
        <p className="mck-card-kicker">05 / 05 · THE FINAL MARK</p>
        <h2 id="mck-card-stage-title">
          Choose what
          <br />
          the bottle keeps.
        </h2>
        <p className="mck-card-instruction">
          选择一张牌，拖到瓶身上。手机端可先点牌，再点瓶子。
        </p>
        <div
          className="mck-card-pile"
          role="radiogroup"
          aria-label="Choose one playing card from Ace to ten"
        >
          {CARDS.map((card, index) => (
            <button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={selectedId === card.id}
              aria-label={`${card.rank} of ${card.suit}`}
              className={`mck-card-option ${selectedId === card.id ? "is-selected" : ""} ${draggingId === card.id ? "is-dragging" : ""}`}
              style={
                {
                  "--card-x": `${card.x}%`,
                  "--card-y": `${card.y}%`,
                  "--card-rotate": `${card.rotate}deg`,
                  "--card-order": index,
                } as CSSProperties
              }
              draggable
              onClick={() => {
                setSelectedId(card.id);
                if (window.matchMedia("(pointer: coarse)").matches)
                  setAppliedId("");
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(
                  "application/x-mckinnon-card",
                  card.id,
                );
                event.dataTransfer.setData("text/plain", card.id);
                setSelectedId(card.id);
                setDraggingId(card.id);
              }}
              onDragEnd={() => {
                setDraggingId("");
                setDropActive(false);
              }}
            >
              <CardFace card={card} />
            </button>
          ))}
        </div>
      </section>

      <section className="mck-card-bottle-panel">
        <p>LIVE DISTILLATION / FINAL LABEL</p>
        <button
          type="button"
          className={`mck-card-bottle-target ${dropActive ? "is-drop-active" : ""} ${applied ? "has-card" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDropActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDropActive(true);
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDropActive(false);
          }}
          onDrop={handleDrop}
          onClick={applySelected}
          aria-label={
            selected
              ? `Attach ${selected.rank} of ${selected.suit} to the bottle`
              : "Select a card first"
          }
        >
          <span className="mck-card-drop-copy">
            {dropActive
              ? "RELEASE TO ATTACH"
              : applied
                ? `${applied.rank} ${SUIT_SYMBOLS[applied.suit]} ATTACHED`
                : selected
                  ? "TAP OR DROP ON THE GLASS"
                  : "SELECT A CARD"}
          </span>
          <span
            ref={bottleMount}
            className="mck-card-bottle-mount"
            aria-hidden="true"
          />
        </button>
        <div className="mck-card-stage-actions">
          <button type="button" className="mck-card-back" onClick={onBack}>
            ← BACK
          </button>
          <button
            type="button"
            className="mck-card-seal"
            disabled={!applied}
            onClick={() =>
              applied && onSeal({ rank: applied.rank, suit: applied.suit })
            }
          >
            SEAL THE MEMORY
          </button>
        </div>
      </section>
    </div>
  );
}

function createStickerNode(
  card: StoredPlayingCard,
  context: "bottle" | "collection" | "detail" | "preview",
) {
  const sticker = document.createElement("span");
  sticker.className = `mck-card-sticker mck-card-sticker-${context} suit-${card.suit}`;
  sticker.dataset.cardId = cardId(card);
  sticker.setAttribute("aria-hidden", "true");
  const symbol = SUIT_SYMBOLS[card.suit];
  sticker.innerHTML = `<b>${card.rank}</b><i>${symbol}</i><em>${symbol}</em><span>${card.rank}</span>`;
  return sticker;
}

function getMemoryByDisplayNumber(
  archive: Archive,
  text: string | null | undefined,
) {
  const number = Number((text ?? "").match(/\d+/)?.[0]);
  if (!Number.isFinite(number) || number < 1) return null;
  return archive.memories?.[number - 1] ?? null;
}

export default function PlayingCardFeature() {
  const [stage, setStage] = useState<CardStage | null>(null);
  const [initialCard, setInitialCard] = useState<StoredPlayingCard | null>(
    null,
  );
  const pendingCard = useRef<StoredPlayingCard | null>(null);
  const activeEditingId = useRef<string | null>(null);
  const allowSubmit = useRef(false);
  const refreshTimer = useRef<number | null>(null);

  const refreshStickers = useCallback(() => {
    const archive = parseArchive(window.localStorage.getItem(STORAGE_KEY));

    const attach = (
      host: HTMLElement,
      memory: ArchiveMemory | null,
      context: "bottle" | "collection" | "detail",
    ) => {
      const existing = host.querySelector<HTMLElement>(
        `:scope > .mck-card-sticker-${context}`,
      );
      const card = memory?.playingCard;
      if (!isPlayingCard(card)) {
        existing?.remove();
        return;
      }
      const id = cardId(card);
      if (existing?.dataset.cardId === id) return;
      existing?.remove();
      host.append(createStickerNode(card, context));
    };

    document
      .querySelectorAll<HTMLElement>(
        ".bottle:not(.ghost-bottle):not(.mck-card-stage-bottle)",
      )
      .forEach((bottle) => {
        if (bottle.closest(".live-bottle")) return;
        const memory = getMemoryByDisplayNumber(
          archive,
          bottle.querySelector(".bottle-label b")?.textContent,
        );
        attach(bottle, memory, "bottle");
      });

    document
      .querySelectorAll<HTMLElement>(".collection-item")
      .forEach((item) => {
        const memory = getMemoryByDisplayNumber(
          archive,
          item.querySelector(".collection-item-copy b")?.textContent,
        );
        const host = item.querySelector<HTMLElement>(".collection-image-wrap");
        if (host) attach(host, memory, "collection");
      });

    const detailNumber = document.querySelector(".record-kicker")?.textContent;
    const detailMemory = getMemoryByDisplayNumber(archive, detailNumber);
    const detailHost = document.querySelector<HTMLElement>(
      ".detail-bottle-halo.has-collection-bottle",
    );
    if (detailHost) attach(detailHost, detailMemory, "detail");
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null)
      window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(refreshStickers, 40);
  }, [refreshStickers]);

  useEffect(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(
      key: string,
      value: string,
    ) {
      if (this === window.localStorage && key === STORAGE_KEY) {
        try {
          const previous = parseArchive(
            window.localStorage.getItem(STORAGE_KEY),
          );
          const incoming = parseArchive(value);
          const previousById = new Map(
            (previous.memories ?? []).map((memory) => [memory.id, memory]),
          );
          const previousIds = new Set(previousById.keys());

          incoming.memories = (incoming.memories ?? []).map((memory) => {
            const priorCard = previousById.get(memory.id)?.playingCard;
            return isPlayingCard(priorCard) &&
              !isPlayingCard(memory.playingCard)
              ? { ...memory, playingCard: priorCard }
              : memory;
          });

          if (pendingCard.current) {
            const target = activeEditingId.current
              ? incoming.memories.find(
                  (memory) => memory.id === activeEditingId.current,
                )
              : (incoming.memories.find(
                  (memory) => !previousIds.has(memory.id),
                ) ??
                incoming.memories
                  .slice()
                  .sort((a, b) =>
                    String(b.updatedAt ?? b.createdAt ?? "").localeCompare(
                      String(a.updatedAt ?? a.createdAt ?? ""),
                    ),
                  )[0]);
            if (target) target.playingCard = pendingCard.current;
          }

          value = JSON.stringify(incoming);
          pendingCard.current = null;
          activeEditingId.current = null;
        } catch {
          // Preserve the archive write if enhancement metadata cannot be merged.
        }
      }
      const result = originalSetItem.call(this, key, value);
      if (this === window.localStorage && key === STORAGE_KEY) {
        window.dispatchEvent(new CustomEvent("mckinnon-card-storage-changed"));
      }
      return result;
    };

    return () => {
      Storage.prototype.setItem = originalSetItem;
    };
  }, []);

  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (
        !(form instanceof HTMLFormElement) ||
        !form.matches(".distill-layout")
      )
        return;
      if (allowSubmit.current) {
        allowSubmit.current = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const archive = parseArchive(window.localStorage.getItem(STORAGE_KEY));
      const editingMemory = activeEditingId.current
        ? (archive.memories?.find(
            (memory) => memory.id === activeEditingId.current,
          ) ?? null)
        : null;
      setInitialCard(
        isPlayingCard(editingMemory?.playingCard)
          ? editingMemory.playingCard
          : null,
      );
      setStage({ form, editingId: activeEditingId.current });
    };

    const onClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest("button") : null;
      if (!target) return;

      if (
        target.closest(".detail-overlay") &&
        /\bEDIT\b/.test(target.textContent ?? "")
      ) {
        const archive = parseArchive(window.localStorage.getItem(STORAGE_KEY));
        activeEditingId.current =
          getMemoryByDisplayNumber(
            archive,
            document.querySelector(".record-kicker")?.textContent,
          )?.id ?? null;
      }

      if (
        target.closest(".site-nav") &&
        /\bADD\b/.test(target.textContent ?? "")
      )
        activeEditingId.current = null;
      if (
        target.querySelector(".ghost-bottle") ||
        target.closest(".bottle-button")?.querySelector(".ghost-bottle")
      )
        activeEditingId.current = null;

      if (/EXPORT JSON/.test(target.textContent ?? "")) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const raw =
          window.localStorage.getItem(STORAGE_KEY) ??
          JSON.stringify({ schemaVersion: 3, memories: [] }, null, 2);
        const pretty = JSON.stringify(JSON.parse(raw), null, 2);
        const blob = new Blob([pretty], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = `mckinnon-archive-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(href);
      }
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    scheduleRefresh();
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("mckinnon-card-storage-changed", scheduleRefresh);
    window.addEventListener("storage", scheduleRefresh);
    return () => {
      observer.disconnect();
      window.removeEventListener(
        "mckinnon-card-storage-changed",
        scheduleRefresh,
      );
      window.removeEventListener("storage", scheduleRefresh);
      if (refreshTimer.current !== null)
        window.clearTimeout(refreshTimer.current);
    };
  }, [scheduleRefresh]);

  const sealWithCard = (card: StoredPlayingCard) => {
    if (!stage) return;
    pendingCard.current = card;
    activeEditingId.current = stage.editingId;
    allowSubmit.current = true;
    const form = stage.form;
    setStage(null);
    window.setTimeout(() => form.requestSubmit(), 20);
  };

  return (
    <>
      {stage && (
        <PlayingCardStage
          key={`${stage.editingId ?? "new"}-${initialCard ? cardId(initialCard) : "empty"}`}
          stage={stage}
          initialCard={initialCard}
          onBack={() => setStage(null)}
          onSeal={sealWithCard}
        />
      )}
    </>
  );
}
