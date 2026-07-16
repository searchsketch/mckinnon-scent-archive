"use client";

import {
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowLeft,
  ArrowRight,
  DownloadSimple,
  PencilSimple,
  Plus,
  Star,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import {
  createMemory,
  memoryStorage,
  type FavoriteBottleStyle,
  type PerformanceMemory,
} from "@/lib/memory-storage";

const SWATCHES = ["#8A9BA8", "#A69AAE", "#9AA797", "#A99188", "#7E8A9C", "#AAA68F", "#988F92"];
const CHARACTER_SUGGESTIONS = [
  "Macbeth",
  "Lady Macbeth",
  "Macduff",
  "Lady Macduff",
  "Banquo",
  "Malcolm",
  "Duncan",
  "Boy Witch",
  "Bald Witch",
  "Sexy Witch",
  "Hecate",
  "Bride",
  "Husband",
  "Fulton",
  "Taxidermist",
  "Speakeasy",
  "Porter",
  "Agnes",
  "Danvers",
  "Green Snake",
  "Nurse",
  "Matron",
];

const COLLECTION_BOTTLES: Array<{
  id: FavoriteBottleStyle;
  name: string;
  image: string;
}> = [
  {
    id: "ivory-seal",
    name: "THE IVORY SEAL",
    image: "/assets/collection-v4/ivory-seal-cutout-v4.png",
  },
  {
    id: "raven",
    name: "THE RAVEN",
    image: "/assets/collection-v4/raven-cutout-v4.png",
  },
  {
    id: "serpent",
    name: "THE SERPENT",
    image: "/assets/collection-v4/serpent-cutout-v4.png",
  },
  {
    id: "stag",
    name: "THE STAG",
    image: "/assets/collection-v4/stag-cutout-v4.png",
  },
  {
    id: "moon",
    name: "THE MOON",
    image: "/assets/collection-v4/moon-cutout-v4.png",
  },
  {
    id: "white-mask",
    name: "THE WHITE MASK",
    image: "/assets/collection-v4/white-mask-cutout-v4.png",
  },
];

const collectionBottle = (style: FavoriteBottleStyle | null) =>
  COLLECTION_BOTTLES.find((bottle) => bottle.id === style) ?? COLLECTION_BOTTLES[0];

type Draft = {
  date: string;
  moodColor: string;
  hadOneOnOne: boolean | null;
  oneOnOneWith: string[];
  mostMemorableCharacter: string;
  memoryText: string;
};

const emptyDraft = (): Draft => ({
  date: "",
  moodColor: SWATCHES[0],
  hadOneOnOne: null,
  oneOnOneWith: [],
  mostMemorableCharacter: "",
  memoryText: "",
});

const pad = (n: number) => String(n).padStart(3, "0");
const newestMemoryFirst = (a: PerformanceMemory, b: PerformanceMemory) =>
  b.date.localeCompare(a.date) ||
  b.createdAt.localeCompare(a.createdAt) ||
  b.id.localeCompare(a.id);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

type MaskLipSticker = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

const MASK_LIPS_STORAGE_KEY = "mckinnon-mask-lips-v1";
const MAX_MASK_LIPS = 10;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isMaskLipSticker = (value: unknown): value is MaskLipSticker => {
  if (!value || typeof value !== "object") return false;
  const sticker = value as Partial<MaskLipSticker>;
  return (
    typeof sticker.id === "string" &&
    typeof sticker.x === "number" &&
    Number.isFinite(sticker.x) &&
    typeof sticker.y === "number" &&
    Number.isFinite(sticker.y) &&
    typeof sticker.rotation === "number" &&
    Number.isFinite(sticker.rotation) &&
    typeof sticker.scale === "number" &&
    Number.isFinite(sticker.scale)
  );
};

function MaskPortal({ count }: { count: number }) {
  const root = useRef<HTMLElement>(null);
  const mask = useRef<HTMLDivElement>(null);
  const lipLayer = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLImageElement>(null);
  const left = useRef<HTMLImageElement>(null);
  const right = useRef<HTMLImageElement>(null);
  const hint = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const angle = useRef(0);
  const velocity = useRef(0);
  const raf = useRef<number | null>(null);
  const lipDrag = useRef<{
    id: string;
    mode: "move" | "transform";
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originScale: number;
    originRotation: number;
    centerX: number;
    centerY: number;
    startDistance: number;
    startAngle: number;
  } | null>(null);
  const [sourceGhost, setSourceGhost] = useState<{ x: number; y: number } | null>(null);
  const [lipStickers, setLipStickers] = useState<MaskLipSticker[]>([]);
  const [selectedLipId, setSelectedLipId] = useState<string | null>(null);
  const [lipStorageReady, setLipStorageReady] = useState(false);
  const [lipStatus, setLipStatus] = useState("");
  const reducedMotion = useReducedMotion();

  const paint = useCallback(() => {
    const a = Math.max(-34, Math.min(34, angle.current));
    if (!mask.current || !front.current || !left.current || !right.current) return;
    mask.current.style.setProperty("--mask-turn", `${a * 0.28}deg`);
    mask.current.style.setProperty("--mask-shift", `${a * 0.16}px`);
    const frontOpacity = 1 - Math.min(1, Math.abs(a) / 28);
    front.current.style.opacity = String(frontOpacity);
    if (lipLayer.current) {
      lipLayer.current.style.opacity = String(frontOpacity);
      lipLayer.current.classList.toggle("is-hidden", frontOpacity <= 0.55);
    }
    left.current.style.opacity = String(a < 0 ? Math.min(1, -a / 26) : 0);
    right.current.style.opacity = String(a > 0 ? Math.min(1, a / 26) : 0);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(MASK_LIPS_STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setLipStickers(
              parsed.filter(isMaskLipSticker).slice(0, MAX_MASK_LIPS).map((sticker) => ({
                ...sticker,
                x: clamp(sticker.x, 18, 82),
                y: clamp(sticker.y, 20, 83),
                rotation: clamp(sticker.rotation, -180, 180),
                scale: clamp(sticker.scale, 0.65, 1.8),
              })),
            );
          }
        }
      } catch {
        window.localStorage.removeItem(MASK_LIPS_STORAGE_KEY);
      } finally {
        setLipStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!lipStorageReady) return;
    try {
      window.localStorage.setItem(MASK_LIPS_STORAGE_KEY, JSON.stringify(lipStickers));
    } catch {
      // The DIY controls remain usable when storage is unavailable.
    }
  }, [lipStickers, lipStorageReady]);

  const updateLip = (id: string, update: (sticker: MaskLipSticker) => MaskLipSticker) => {
    setLipStickers((current) =>
      current.map((sticker) => (sticker.id === id ? update(sticker) : sticker)),
    );
  };

  const addLipAt = (clientX: number, clientY: number) => {
    if (lipStickers.length >= MAX_MASK_LIPS) {
      return;
    }
    const bounds = mask.current?.getBoundingClientRect();
    if (!bounds) return;
    const insideMask =
      clientX >= bounds.left &&
      clientX <= bounds.right &&
      clientY >= bounds.top &&
      clientY <= bounds.bottom;
    if (!insideMask) {
      setLipStatus("Drag the kiss mark onto the mask.");
      return;
    }
    const id = crypto.randomUUID();
    const next: MaskLipSticker = {
      id,
      x: clamp(((clientX - bounds.left) / bounds.width) * 100, 18, 82),
      y: clamp(((clientY - bounds.top) / bounds.height) * 100, 20, 83),
      rotation: 0,
      scale: 1,
    };
    setLipStickers((current) => [...current, next]);
    setSelectedLipId(id);
    setLipStatus("Kiss mark placed on the mask.");
  };

  const removeLip = (id: string) => {
    setLipStickers((current) => current.filter((sticker) => sticker.id !== id));
    setSelectedLipId(null);
    setLipStatus("Kiss mark removed.");
  };

  const onLipPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    sticker: MaskLipSticker,
  ) => {
    event.stopPropagation();
    setSelectedLipId(sticker.id);
    lipDrag.current = {
      id: sticker.id,
      mode: "move",
      startX: event.clientX,
      startY: event.clientY,
      originX: sticker.x,
      originY: sticker.y,
      originScale: sticker.scale,
      originRotation: sticker.rotation,
      centerX: 0,
      centerY: 0,
      startDistance: 0,
      startAngle: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onLipPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const drag = lipDrag.current;
    if (!drag || !mask.current) return;
    if (drag.mode === "move") {
      const bounds = mask.current.getBoundingClientRect();
      const x = clamp(drag.originX + ((event.clientX - drag.startX) / bounds.width) * 100, 18, 82);
      const y = clamp(drag.originY + ((event.clientY - drag.startY) / bounds.height) * 100, 20, 83);
      updateLip(drag.id, (sticker) => ({ ...sticker, x, y }));
      return;
    }
    const distance = Math.hypot(event.clientX - drag.centerX, event.clientY - drag.centerY);
    const pointerAngle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX);
    updateLip(drag.id, (sticker) => ({
      ...sticker,
      scale: clamp(drag.originScale * (distance / drag.startDistance), 0.65, 1.8),
      rotation: drag.originRotation + ((pointerAngle - drag.startAngle) * 180) / Math.PI,
    }));
  };

  const onLipPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (lipDrag.current) setLipStatus("Kiss mark placed.");
    lipDrag.current = null;
  };

  const onLipTransformPointerDown = (
    event: React.PointerEvent<HTMLSpanElement>,
    sticker: MaskLipSticker,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!mask.current) return;
    const bounds = mask.current.getBoundingClientRect();
    const centerX = bounds.left + (sticker.x / 100) * bounds.width;
    const centerY = bounds.top + (sticker.y / 100) * bounds.height;
    lipDrag.current = {
      id: sticker.id,
      mode: "transform",
      startX: event.clientX,
      startY: event.clientY,
      originX: sticker.x,
      originY: sticker.y,
      originScale: sticker.scale,
      originRotation: sticker.rotation,
      centerX,
      centerY,
      startDistance: Math.max(12, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onSourcePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (lipStickers.length >= MAX_MASK_LIPS) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSourceGhost({ x: event.clientX, y: event.clientY });
  };

  const onSourcePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!sourceGhost) return;
    event.preventDefault();
    event.stopPropagation();
    setSourceGhost({ x: event.clientX, y: event.clientY });
  };

  const onSourcePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!sourceGhost) return;
    event.preventDefault();
    event.stopPropagation();
    setSourceGhost(null);
    addLipAt(event.clientX, event.clientY);
  };

  useEffect(() => {
    angle.current = -18;
    paint();
    const entrance = window.setTimeout(() => {
      gsap.to(angle, {
        current: 0,
        duration: reducedMotion ? 0 : 1.7,
        ease: "power3.out",
        onUpdate: paint,
      });
    }, 350);
    return () => window.clearTimeout(entrance);
  }, [paint, reducedMotion]);

  useLayoutEffect(() => {
    if (!root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(".eye-aperture", { clipPath: "polygon(0 0,100% 0,100% 100%,0 100%)", opacity: 0 });
        return;
      }
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=220%",
          scrub: 1.05,
          pin: ".portal-stage",
          anticipatePin: 1,
        },
      });
      timeline
        .to(angle, { current: 0, duration: 0.18, onUpdate: paint }, 0)
        .to(".portal-copy", { opacity: 0, y: -18, duration: 0.18 }, 0.12)
        .to(".mask-object", { scale: 1.32, filter: "brightness(.88) contrast(1.08)", duration: 0.3 }, 0.2)
        .to(".mask-object", { scale: 5.9, xPercent: -15, yPercent: 3, duration: 0.38, ease: "power2.in" }, 0.45)
        .fromTo(
          ".eye-aperture",
          { opacity: 0, clipPath: "polygon(54% 43%,65% 43%,67% 51%,64% 58%,55% 58%,52% 51%)" },
          { opacity: 1, clipPath: "polygon(-15% -20%,115% -10%,120% 120%,-20% 110%)", duration: 0.23, ease: "power2.in" },
          0.57,
        )
        .to(".portal-blackout", { opacity: 1, duration: 0.1 }, 0.77)
        .to(".cabinet-glint", { opacity: 0.36, duration: 0.16 }, 0.86);
    }, root);
    return () => context.revert();
  }, [paint, reducedMotion]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    dragging.current = true;
    startX.current = event.clientX;
    velocity.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (hint.current) hint.current.style.opacity = "0";
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = event.clientX - startX.current;
    startX.current = event.clientX;
    velocity.current = delta * 0.55;
    angle.current += velocity.current;
    paint();
  };

  const onPointerUp = () => {
    dragging.current = false;
    const coast = () => {
      velocity.current *= 0.88;
      angle.current += velocity.current;
      if (angle.current > 34 || angle.current < -34) velocity.current *= -0.35;
      paint();
      if (Math.abs(velocity.current) > 0.08) raf.current = requestAnimationFrame(coast);
    };
    raf.current = requestAnimationFrame(coast);
  };

  return (
    <section ref={root} className="portal-sequence" aria-label="Mask portal">
      <div className="portal-stage">
        <div className="mask-light" aria-hidden="true" />
        <div
          ref={mask}
          className="mask-object"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="group"
          aria-label="Interactive porcelain mask. Drag horizontally to turn it, or decorate it with movable kiss marks."
          tabIndex={0}
        >
          <img ref={front} className="mask-view mask-front" src="/assets/mask-front-clean-v2.png" alt="" draggable={false} />
          <img ref={left} className="mask-view mask-left" src="/assets/mask-left-clean-v2.png" alt="" draggable={false} />
          <img ref={right} className="mask-view mask-right" src="/assets/mask-right-clean-v2.png" alt="" draggable={false} />
          <div ref={lipLayer} className="mask-lip-layer">
            {lipStickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                className={`mask-lip-sticker ${selectedLipId === sticker.id ? "is-selected" : ""}`}
                style={
                  {
                    "--lip-x": `${sticker.x}%`,
                    "--lip-y": `${sticker.y}%`,
                    "--lip-rotation": `${sticker.rotation}deg`,
                    "--lip-scale": sticker.scale,
                  } as CSSProperties
                }
                aria-label="Movable kiss mark. Use arrow keys to reposition it, or Delete to remove it."
                onPointerDown={(event) => onLipPointerDown(event, sticker)}
                onPointerMove={onLipPointerMove}
                onPointerUp={onLipPointerUp}
                onPointerCancel={onLipPointerUp}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  removeLip(sticker.id);
                }}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 4 : 1;
                  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(event.key)) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                  if (event.key === "ArrowLeft") updateLip(sticker.id, (item) => ({ ...item, x: clamp(item.x - step, 18, 82) }));
                  if (event.key === "ArrowRight") updateLip(sticker.id, (item) => ({ ...item, x: clamp(item.x + step, 18, 82) }));
                  if (event.key === "ArrowUp") updateLip(sticker.id, (item) => ({ ...item, y: clamp(item.y - step, 20, 83) }));
                  if (event.key === "ArrowDown") updateLip(sticker.id, (item) => ({ ...item, y: clamp(item.y + step, 20, 83) }));
                  if (event.key === "Delete" || event.key === "Backspace") removeLip(sticker.id);
                }}
              >
                <img src="/assets/mask-kiss-sticker.png" alt="" draggable={false} />
                {selectedLipId === sticker.id && (
                  <span
                    className="mask-lip-transform-handle"
                    aria-hidden="true"
                    onPointerDown={(event) => onLipTransformPointerDown(event, sticker)}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
        {lipStickers.length < MAX_MASK_LIPS && (
          <button
            type="button"
            className="mask-kiss-source portal-copy"
            aria-label="Drag a kiss mark onto the mask"
            onPointerDown={onSourcePointerDown}
            onPointerMove={onSourcePointerMove}
            onPointerUp={onSourcePointerUp}
            onPointerCancel={() => setSourceGhost(null)}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && mask.current) {
                event.preventDefault();
                const bounds = mask.current.getBoundingClientRect();
                addLipAt(bounds.left + bounds.width * 0.62, bounds.top + bounds.height * 0.64);
              }
            }}
          >
            <img src="/assets/mask-kiss-sticker.png" alt="" draggable={false} />
          </button>
        )}
        {sourceGhost && (
          <img
            className="mask-kiss-drag-ghost"
            src="/assets/mask-kiss-sticker.png"
            alt=""
            draggable={false}
            style={{ left: sourceGhost.x, top: sourceGhost.y }}
          />
        )}
        <p className="sr-only" aria-live="polite">{lipStatus}</p>
        <span ref={hint} className="drag-hint portal-copy">DRAG TO TURN</span>
        <div className="portal-copy portal-bottom-left">
          <span>A SCENT ARCHIVE</span>
          <span className="portal-rule" />
          <span>PRIVATE / 01</span>
        </div>
        <div className="portal-copy portal-bottom-right">
          <span>MEMORIES / {pad(count)}</span>
          <span>SCROLL TO ENTER</span>
        </div>
        <div className="eye-aperture" aria-hidden="true" />
        <div className="portal-blackout" aria-hidden="true" />
        <div className="cabinet-glint" aria-hidden="true" />
      </div>
    </section>
  );
}

function MemoryBottle({
  memory,
  index,
  onOpen,
  preview = false,
  draggable = false,
  dragging = false,
  onDragStart,
  onDragEnd,
}: {
  memory?: PerformanceMemory;
  index: number;
  onOpen?: () => void;
  preview?: boolean;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
}) {
  const color = memory?.moodColor ?? "#8A9BA8";
  const level = 42 + ((memory?.id ?? String(index)).split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) % 24);
  const label = memory ? `${pad(index + 1)} / ${memory.date}` : "DISTILL A MEMORY";
  const content = (
    <motion.div
      className={`bottle ${preview ? "bottle-preview" : ""} ${memory ? "" : "ghost-bottle"}`}
      layoutId={memory ? `bottle-${memory.id}` : undefined}
      style={{ "--liquid": color, "--liquid-level": `${level}%` } as CSSProperties}
    >
      <span className="realistic-bottle-body">
        <span className="bottle-liquid" />
        <span className="liquid-caustic" />
        <span className="liquid-bubbles" aria-hidden="true"><i /><i /><i /></span>
      </span>
      <span className="bottle-render" aria-hidden="true">
        <img src="/assets/realistic-dropper-bottle-transparent.png" alt="" draggable={false} />
      </span>
      <span className="bottle-pipette-tint" aria-hidden="true" />
      <span className="bottle-shine" aria-hidden="true" />
      <span className="bottle-label">
        <b>{memory ? pad(index + 1) : "NEW"}</b>
        <small>{memory ? memory.date : "EMPTY"}</small>
        <em>{memory ? initials(memory.mostMemorableCharacter) : "—"}</em>
      </span>
      <span className="bottle-caption">{label}</span>
    </motion.div>
  );

  if (!onOpen) return content;
  return (
    <button
      className={`bottle-button ${dragging ? "is-dragging" : ""}`}
      onClick={onOpen}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-describedby={draggable ? "bottle-drag-instruction" : undefined}
      aria-label={`Open memory ${index + 1}, ${memory?.date ?? "new memory"}`}
    >
      {content}
      {memory && (
        <span className="bottle-hover-copy">
          <b>{memory.date}</b>
          <small>{memory.mostMemorableCharacter}</small>
        </span>
      )}
    </button>
  );
}

function DigitCount({ count }: { count: number }) {
  const digits = pad(count).split("");
  return (
    <div className="memory-count" aria-label={`${count} memories`}>
      <span aria-hidden="true">MEMORIES / </span>
      <span className="count-digits" aria-hidden="true">
        {digits.map((digit, position) => (
          <span className="digit-window" key={position}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.i
                key={`${position}-${digit}`}
                initial={{ y: 9, opacity: 0, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0)" }}
                exit={{ y: -9, opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.38 + position * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >{digit}</motion.i>
            </AnimatePresence>
          </span>
        ))}
      </span>
      <span className="sr-only" aria-live="polite">{count} memories</span>
    </div>
  );
}

function CollectionShelf({
  memories,
  onOpen,
  dragActive,
  dragOver,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  memories: PerformanceMemory[];
  onOpen: (memory: PerformanceMemory) => void;
  dragActive: boolean;
  dragOver: boolean;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
  const favorites = memories.filter((memory) => memory.isFavorite).slice().sort(newestMemoryFirst);

  return (
    <section
      className={`collection-shelf ${dragActive ? "is-drag-active" : ""} ${dragOver ? "is-drag-over" : ""}`}
      aria-labelledby="collection-title"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <header className="collection-header">
        <div>
          <p>PRIVATE COLLECTION / 01</p>
          <h3 id="collection-title">THE TREASURED SHELF</h3>
        </div>
        <span>{dragOver ? "RELEASE TO DISTILL" : `TREASURED / ${pad(favorites.length)}`}</span>
      </header>
      <div className={`collection-rail ${favorites.length === 0 ? "is-empty" : ""}`}>
        {favorites.length === 0 ? (
          <div className="collection-empty">
            <Star size={15} weight="thin" />
            <span>NO TREASURE SELECTED</span>
            <small>{dragActive ? "Drag the bottle here and release." : "Open or drag a memory to place its bottle here."}</small>
          </div>
        ) : (
          favorites.map((memory) => {
            const bottle = collectionBottle(memory.favoriteBottleStyle);
            const index = memories.findIndex((item) => item.id === memory.id);
            return (
              <motion.button
                layout
                key={memory.id}
                className="collection-item"
                onClick={() => onOpen(memory)}
                style={{ "--liquid": memory.moodColor } as CSSProperties}
                aria-label={`Open treasured memory ${index + 1}, ${bottle.name}`}
              >
                <span className="collection-image-wrap">
                  <img src={bottle.image} alt={`${bottle.name} vessel`} />
                </span>
                <span className="collection-item-copy">
                  <b>{pad(index + 1)}</b>
                  <small>{memory.date}</small>
                  <em>{bottle.name}</em>
                </span>
              </motion.button>
            );
          })
        )}
      </div>
    </section>
  );
}

function Cabinet({ memories, onOpen, onAdd, onCollectDrop }: { memories: PerformanceMemory[]; onOpen: (memory: PerformanceMemory) => void; onAdd: () => void; onCollectDrop: (memory: PerformanceMemory) => void }) {
  const root = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [shelfOver, setShelfOver] = useState(false);

  useLayoutEffect(() => {
    if (!root.current || reducedMotion) return;
    const context = gsap.context(() => {
      gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 80%", end: "45% 45%", scrub: 1 } })
        .fromTo(".cabinet-shell", { scale: 0.78, rotateX: 2 }, { scale: 1.035, rotateX: 0, ease: "none" })
        .fromTo(".cabinet-door", { rotateY: 0 }, { rotateY: -7, ease: "none" }, 0)
        .fromTo(".shelf-light", { opacity: 0.15 }, { opacity: 0.65, stagger: 0.07 }, 0.28);
    }, root);
    return () => context.revert();
  }, [reducedMotion]);

  return (
    <section ref={root} id="cabinet" className="cabinet-space" aria-labelledby="cabinet-title">
      <header className="cabinet-heading">
        <p>02 / THE CABINET</p>
        <h2 id="cabinet-title">Every performance<br />leaves a scent.</h2>
        <DigitCount count={memories.length} />
      </header>
      <CollectionShelf
        memories={memories}
        onOpen={onOpen}
        dragActive={draggedId !== null}
        dragOver={shelfOver}
        onDragEnter={(event) => { event.preventDefault(); if (draggedId) setShelfOver(true); }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShelfOver(false);
        }}
        onDragOver={(event) => { if (draggedId) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
        onDrop={(event) => {
          event.preventDefault();
          const memory = memories.find((item) => item.id === draggedId);
          setShelfOver(false); setDraggedId(null);
          if (memory) onCollectDrop(memory);
        }}
      />
      <div className="cabinet-shell">
        <div className="cabinet-topline"><span>ARCHIVE / PRIVATE</span><span>MCK / {new Date().getFullYear()}</span></div>
        <div className="cabinet-door" aria-hidden="true" />
        <div className="cabinet-interior">
          {[0, 1, 2].map((shelf) => <span key={shelf} className={`shelf-line shelf-${shelf + 1}`}><i className="shelf-light" /></span>)}
          <div className="bottle-grid">
            {memories.filter((memory) => !memory.isFavorite).slice().sort(newestMemoryFirst).map((memory) => {
              const index = memories.findIndex((item) => item.id === memory.id);
              return (
                <MemoryBottle
                  key={memory.id}
                  memory={memory}
                  index={index}
                  onOpen={() => onOpen(memory)}
                  draggable
                  dragging={draggedId === memory.id}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", memory.id);
                    setDraggedId(memory.id);
                  }}
                  onDragEnd={() => { setDraggedId(null); setShelfOver(false); }}
                />
              );
            })}
            <MemoryBottle index={memories.length} onOpen={onAdd} />
          </div>
        </div>
      </div>
      <p id="bottle-drag-instruction" className="sr-only">Drag this memory bottle to the treasured shelf to choose a collectible vessel.</p>
      {memories.length === 0 && (
        <p className="empty-whisper">The cabinet is waiting. Distill the first memory.</p>
      )}
    </section>
  );
}

function Distiller({
  editing,
  onClose,
  onSeal,
}: {
  editing: PerformanceMemory | null;
  onClose: () => void;
  onSeal: (draft: Draft, editing: PerformanceMemory | null) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() =>
    editing
      ? {
          date: editing.date,
          moodColor: editing.moodColor,
          hadOneOnOne: editing.hadOneOnOne,
          oneOnOneWith: editing.oneOnOneWith,
          mostMemorableCharacter: editing.mostMemorableCharacter,
          memoryText: editing.memoryText,
        }
      : emptyDraft(),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [customOneOnOne, setCustomOneOnOne] = useState("");

  const toggleOneOnOne = (name: string) => {
    setDraft((current) => ({
      ...current,
      oneOnOneWith: current.oneOnOneWith.includes(name)
        ? current.oneOnOneWith.filter((item) => item !== name)
        : [...current.oneOnOneWith, name],
    }));
  };

  const addCustomOneOnOne = () => {
    const name = customOneOnOne.trim();
    if (!name) return;
    setDraft((current) => ({
      ...current,
      oneOnOneWith: current.oneOnOneWith.includes(name)
        ? current.oneOnOneWith
        : [...current.oneOnOneWith, name],
    }));
    setCustomOneOnOne("");
  };

  const valid = [
    Boolean(draft.date),
    /^#[0-9A-Fa-f]{6}$/.test(draft.moodColor),
    draft.hadOneOnOne !== null && (!draft.hadOneOnOne || draft.oneOnOneWith.length > 0) && draft.mostMemorableCharacter.trim().length > 0,
    draft.memoryText.trim().length > 0,
  ][step];

  const next = () => {
    if (!valid) {
      setError("Complete this field before continuing.");
      return;
    }
    setError("");
    setStep((value) => Math.min(3, value + 1));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return setError("Write the memory before sealing it.");
    setSaving(true);
    setError("");
    try {
      await onSeal(draft, editing);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The memory could not be saved. Try again.");
      setSaving(false);
    }
  };

  return (
    <motion.div className="overlay distiller" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={editing ? "Edit memory" : "Distill a memory"}>
      <button className="icon-button overlay-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
      <div className="distill-progress" aria-label={`Step ${step + 1} of 4`}>
        {[0, 1, 2, 3].map((item) => <span key={item} className={item <= step ? "active" : ""} />)}
      </div>
      <form className="distill-layout" onSubmit={submit}>
        <AnimatePresence mode="wait">
          <motion.div className="question-panel" key={step} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.28 }}>
            <p className="step-label">0{step + 1} / 04</p>
            {step === 0 && (
              <>
                <h2>When did it happen?</h2>
                <label htmlFor="memory-date">观剧日期</label>
                <input id="memory-date" type="date" required value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </>
            )}
            {step === 1 && (
              <>
                <h2>Choose the liquid.</h2>
                <label>象征本场心情的颜色</label>
                <div className="swatches" role="radiogroup" aria-label="Mood color">
                  {SWATCHES.map((color) => (
                    <button key={color} type="button" role="radio" aria-checked={draft.moodColor === color} className={draft.moodColor === color ? "selected" : ""} style={{ "--swatch": color } as CSSProperties} onClick={() => setDraft({ ...draft, moodColor: color })}><span /></button>
                  ))}
                </div>
                <label htmlFor="custom-color" className="minor-label">CUSTOM HEX</label>
                <div className="color-field"><input id="custom-color" type="color" value={draft.moodColor} onChange={(e) => setDraft({ ...draft, moodColor: e.target.value.toUpperCase() })} /><output>{draft.moodColor.toUpperCase()}</output></div>
              </>
            )}
            {step === 2 && (
              <>
                <h2>Who entered the frame?</h2>
                <label>本场是否有 1v1 互动</label>
                <div className="binary-choice">
                  {[true, false].map((value) => <button key={String(value)} type="button" className={draft.hadOneOnOne === value ? "active" : ""} onClick={() => setDraft({ ...draft, hadOneOnOne: value, oneOnOneWith: value ? draft.oneOnOneWith : [] })}>{value ? "YES" : "NO"}</button>)}
                </div>
                <AnimatePresence initial={false}>
                  {draft.hadOneOnOne && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="conditional-field">
                      <label>和谁（可多选）</label>
                      <div className="role-options" role="group" aria-label="选择所有 1v1 角色">
                        {CHARACTER_SUGGESTIONS.map((name) => (
                          <button
                            key={name}
                            type="button"
                            className={draft.oneOnOneWith.includes(name) ? "selected" : ""}
                            aria-pressed={draft.oneOnOneWith.includes(name)}
                            onClick={() => toggleOneOnOne(name)}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      <label htmlFor="one-with-custom" className="minor-label">添加其他角色</label>
                      <div className="multi-entry">
                        <input
                          id="one-with-custom"
                          value={customOneOnOne}
                          onChange={(event) => setCustomOneOnOne(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addCustomOneOnOne();
                            }
                          }}
                        />
                        <button type="button" onClick={addCustomOneOnOne}>ADD</button>
                      </div>
                      {draft.oneOnOneWith.length > 0 && (
                        <p className="selection-count">SELECTED / {pad(draft.oneOnOneWith.length)}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <label htmlFor="memorable-character">印象最深刻的人物</label>
                <input id="memorable-character" list="characters" required value={draft.mostMemorableCharacter} onChange={(e) => setDraft({ ...draft, mostMemorableCharacter: e.target.value })} />
                <datalist id="characters">{CHARACTER_SUGGESTIONS.map((name) => <option value={name} key={name} />)}</datalist>
              </>
            )}
            {step === 3 && (
              <>
                <h2>What remains?</h2>
                <label htmlFor="memory-text">本场记忆</label>
                <textarea id="memory-text" required rows={9} value={draft.memoryText} onChange={(e) => setDraft({ ...draft, memoryText: e.target.value })} />
                <span className="char-count">{draft.memoryText.length.toLocaleString()} CHARACTERS</span>
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              {step > 0 && <button type="button" className="text-button" onClick={() => { setError(""); setStep(step - 1); }}><ArrowLeft size={16} /> BACK</button>}
              {step < 3 ? <button type="button" className="primary-action" onClick={next}>CONTINUE <ArrowRight size={16} /></button> : <button className="primary-action" disabled={saving}>{saving ? "SEALING…" : editing ? "RESEAL MEMORY" : "SEAL THE MEMORY"}</button>}
            </div>
          </motion.div>
        </AnimatePresence>
        <div className={`live-bottle ${saving ? "is-sealing" : ""}`}>
          <p>LIVE DISTILLATION</p>
          <MemoryBottle index={0} preview memory={{ id: "preview", date: draft.date || "0000-00-00", moodColor: draft.moodColor, hadOneOnOne: Boolean(draft.hadOneOnOne), oneOnOneWith: draft.oneOnOneWith, mostMemorableCharacter: draft.mostMemorableCharacter || "—", memoryText: draft.memoryText || "—", isFavorite: false, favoriteBottleStyle: null, createdAt: "", updatedAt: "" }} />
          <span className="color-readout">LIQUID / {draft.moodColor.toUpperCase()} / 18%</span>
        </div>
      </form>
    </motion.div>
  );
}

function CollectionChooser({
  memory,
  index,
  onClose,
  onChoose,
}: {
  memory: PerformanceMemory;
  index: number;
  onClose: () => void;
  onChoose: (style: FavoriteBottleStyle) => void;
}) {
  return (
    <motion.div
      className="overlay collection-chooser-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drag-collection-title"
    >
      <button className="icon-button overlay-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
      <div className="collection-chooser-memory" style={{ "--liquid": memory.moodColor } as CSSProperties}>
        <p>DROPPED MEMORY / {pad(index + 1)}</p>
        <MemoryBottle memory={memory} index={index} preview />
        <span>{memory.date} / {memory.mostMemorableCharacter}</span>
      </div>
      <section className="collection-chooser-stage">
        <p>THE TREASURED SHELF</p>
        <h2 id="drag-collection-title">Choose its final vessel.</h2>
        <div className="collection-chooser-options" role="radiogroup" aria-label="Choose collectible bottle style">
          {COLLECTION_BOTTLES.map((bottle, position) => (
            <motion.button
              key={bottle.id}
              type="button"
              role="radio"
              aria-checked="false"
              onClick={() => onChoose(bottle.id)}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + position * 0.045 }}
            >
              <span className="chooser-bottle-image"><img src={bottle.image} alt="" /></span>
              <b>0{position + 1}</b>
              <span>{bottle.name}</span>
            </motion.button>
          ))}
        </div>
        <p className="chooser-note">Select one vessel to complete the transfer. Close to return it to the ordinary cabinet.</p>
      </section>
    </motion.div>
  );
}

function MemoryDetail({
  memory,
  index,
  total,
  onClose,
  onPrevious,
  onNext,
  onEdit,
  onDelete,
  onCollectionChange,
}: {
  memory: PerformanceMemory;
  index: number;
  total: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCollectionChange: (style: FavoriteBottleStyle | null) => void;
}) {
  const selectedBottle = memory.isFavorite ? collectionBottle(memory.favoriteBottleStyle) : null;

  return (
    <motion.div className="overlay detail-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={`Memory ${index + 1}`}>
      <button className="icon-button overlay-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
      <div className={`detail-bottle-halo ${selectedBottle ? "has-collection-bottle" : ""}`} style={{ "--liquid": memory.moodColor } as CSSProperties}>
        {selectedBottle ? (
          <motion.img
            key={selectedBottle.id}
            className="detail-collection-bottle"
            src={selectedBottle.image}
            alt={`${selectedBottle.name} collectible perfume bottle`}
            initial={{ opacity: 0, scale: 0.88, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          />
        ) : (
          <MemoryBottle memory={memory} index={index} preview />
        )}
      </div>
      <article className="memory-record">
        <p className="record-kicker">MEMORY NO. / {pad(index + 1)}</p>
        <h2>{memory.date}</h2>
        <dl>
          <div><dt>1:1 / 人物</dt><dd>{memory.hadOneOnOne ? memory.oneOnOneWith.join(" / ") : "NO"}</dd></div>
          <div><dt>印象最深刻的人物</dt><dd>{memory.mostMemorableCharacter}</dd></div>
        </dl>
        <p className="record-text">{memory.memoryText}</p>
        <section className="collection-picker" aria-labelledby="collection-picker-title">
          <div className="collection-picker-heading">
            <div>
              <p>PRIVATE COLLECTION</p>
              <h3 id="collection-picker-title">Choose its treasured vessel.</h3>
            </div>
            {memory.isFavorite && (
              <button className="text-button" type="button" onClick={() => onCollectionChange(null)}>
                <X size={14} /> REMOVE
              </button>
            )}
          </div>
          <div className="collection-options" role="radiogroup" aria-label="Collectible bottle style">
            {COLLECTION_BOTTLES.map((bottle) => {
              const selected = memory.isFavorite && memory.favoriteBottleStyle === bottle.id;
              return (
                <button
                  key={bottle.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "selected" : ""}
                  onClick={() => onCollectionChange(bottle.id)}
                >
                  <span className="collection-option-image"><img src={bottle.image} alt="" /></span>
                  <span>{bottle.name}</span>
                </button>
              );
            })}
          </div>
        </section>
        <div className="record-actions">
          <button className="text-button" onClick={onPrevious} disabled={index === 0}><ArrowLeft size={16} /> PREVIOUS</button>
          <button className="text-button" onClick={onNext} disabled={index === total - 1}>NEXT <ArrowRight size={16} /></button>
          <span />
          <button className="text-button" onClick={onEdit}><PencilSimple size={16} /> EDIT</button>
          <button className="text-button danger" onClick={onDelete}><Trash size={16} /> DELETE</button>
        </div>
      </article>
    </motion.div>
  );
}

function IndexOverlay({ memories, onClose, onOpen, onExport, onImport }: { memories: PerformanceMemory[]; onClose: () => void; onOpen: (memory: PerformanceMemory) => void; onExport: () => void; onImport: (file: File) => void }) {
  const years = useMemo(() => Array.from(new Set(memories.map((m) => m.date.slice(0, 4)))).sort().reverse(), [memories]);
  const [year, setYear] = useState("ALL");
  const visible = memories.filter((m) => year === "ALL" || m.date.startsWith(year)).slice().sort((a, b) => b.date.localeCompare(a.date));
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <motion.div className="overlay index-overlay" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }} role="dialog" aria-modal="true" aria-label="Memory index">
      <button className="icon-button overlay-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
      <header className="index-header"><p>ARCHIVE INDEX</p><h2>{pad(memories.length)}<br />MEMORIES</h2></header>
      <div className="index-tools">
        <div className="year-filter"><button className={year === "ALL" ? "active" : ""} onClick={() => setYear("ALL")}>ALL</button>{years.map((item) => <button className={year === item ? "active" : ""} onClick={() => setYear(item)} key={item}>{item}</button>)}</div>
        <div className="transfer-tools"><button onClick={onExport}><DownloadSimple size={16} /> EXPORT JSON</button><button onClick={() => fileRef.current?.click()}><UploadSimple size={16} /> IMPORT JSON</button><input ref={fileRef} className="sr-only" type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} /></div>
      </div>
      <div className="index-list">
        {visible.map((memory) => {
          const number = memories.findIndex((m) => m.id === memory.id) + 1;
          return <button key={memory.id} onClick={() => onOpen(memory)}><span>{pad(number)}</span><time>{memory.date}</time><span>{memory.hadOneOnOne ? memory.oneOnOneWith.join(", ") : "—"}</span><strong>{memory.mostMemorableCharacter}</strong><ArrowRight size={16} /></button>;
        })}
        {visible.length === 0 && <p className="index-empty">{memories.length === 0 ? "NO MEMORIES SEALED" : "NO MEMORIES IN THIS YEAR"}</p>}
      </div>
    </motion.div>
  );
}

export default function MckinnonArchive() {
  const [memories, setMemories] = useState<PerformanceMemory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [detail, setDetail] = useState<PerformanceMemory | null>(null);
  const [distilling, setDistilling] = useState(false);
  const [editing, setEditing] = useState<PerformanceMemory | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [collectionCandidate, setCollectionCandidate] = useState<PerformanceMemory | null>(null);
  const [sealed, setSealed] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try { setMemories(memoryStorage.load()); }
      catch { setStorageError("The local archive could not be read. Export a backup before retrying."); }
    }, 0);
    const reveal = window.setTimeout(() => setLoaded(true), 900);
    return () => { window.clearTimeout(hydrate); window.clearTimeout(reveal); };
  }, []);

  useEffect(() => {
    if (!detail && !distilling && !indexOpen && !collectionCandidate) return;
    const moveFocus = window.setTimeout(() => {
      document.querySelector<HTMLElement>(".overlay input, .overlay textarea, .overlay button")?.focus();
    }, 60);
    return () => window.clearTimeout(moveFocus);
  }, [detail, distilling, indexOpen, collectionCandidate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDetail(null); setDistilling(false); setEditing(null); setIndexOpen(false); setCollectionCandidate(null);
    };
    const onPop = () => { setDetail(null); setDistilling(false); setEditing(null); setIndexOpen(false); setCollectionCandidate(null); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("popstate", onPop); };
  }, []);

  const openDetail = (memory: PerformanceMemory) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setIndexOpen(false); setDetail(memory); window.history.pushState({ overlay: "detail" }, "");
  };
  const openAdd = () => { returnFocus.current = document.activeElement as HTMLElement; setEditing(null); setDistilling(true); window.history.pushState({ overlay: "add" }, ""); };
  const openIndex = () => { returnFocus.current = document.activeElement as HTMLElement; setIndexOpen(true); window.history.pushState({ overlay: "index" }, ""); };
  const openCollectionChooser = (memory: PerformanceMemory) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setCollectionCandidate(memory);
    window.history.pushState({ overlay: "collection" }, "");
  };
  const closeOverlay = () => {
    setDetail(null); setDistilling(false); setEditing(null); setIndexOpen(false); setCollectionCandidate(null);
    window.setTimeout(() => returnFocus.current?.focus(), 30);
  };

  const sealMemory = async (draft: Draft, current: PerformanceMemory | null) => {
    const fields = {
      date: draft.date,
      moodColor: draft.moodColor.toUpperCase(),
      hadOneOnOne: Boolean(draft.hadOneOnOne),
      oneOnOneWith: draft.hadOneOnOne ? draft.oneOnOneWith : [],
      mostMemorableCharacter: draft.mostMemorableCharacter.trim(),
      memoryText: draft.memoryText.trim(),
      isFavorite: current?.isFavorite ?? false,
      favoriteBottleStyle: current?.favoriteBottleStyle ?? null,
    };
    const next = current
      ? memories.map((item) => item.id === current.id ? { ...item, ...fields, updatedAt: new Date().toISOString() } : item)
      : [...memories, createMemory(fields)];
    memoryStorage.save(next);
    setMemories(next);
    setSealed(true);
    await new Promise((resolve) => window.setTimeout(resolve, 820));
    setDistilling(false); setEditing(null); setDetail(null);
    window.setTimeout(() => setSealed(false), 900);
  };

  const updateCollectionRecord = (memory: PerformanceMemory, style: FavoriteBottleStyle | null) => {
    try {
      const updated = {
        ...memory,
        isFavorite: style !== null,
        favoriteBottleStyle: style,
        updatedAt: new Date().toISOString(),
      };
      const next = memories.map((item) => item.id === updated.id ? updated : item);
      memoryStorage.save(next);
      setMemories(next);
      if (detail?.id === updated.id) setDetail(updated);
      setStorageError("");
      return true;
    } catch {
      setStorageError("The treasured shelf could not be updated. Try again.");
      return false;
    }
  };

  const updateCollection = (style: FavoriteBottleStyle | null) => {
    if (detail) updateCollectionRecord(detail, style);
  };

  const deleteMemory = () => {
    if (!detail || !window.confirm("Delete this memory permanently? This cannot be undone.")) return;
    try {
      const next = memories.filter((item) => item.id !== detail.id);
      memoryStorage.save(next); setMemories(next); setDetail(null);
    } catch { setStorageError("Delete failed. The memory is still in the cabinet."); }
  };

  const exportJson = () => {
    const blob = new Blob([memoryStorage.export(memories)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href; anchor.download = `mckinnon-archive-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(href);
  };

  const importJson = async (file: File) => {
    try {
      const incoming = memoryStorage.import(await file.text());
      const overwrite = memories.length === 0 || window.confirm("OK replaces the current archive. Cancel merges by record ID.");
      const next = overwrite ? incoming : [...memories, ...incoming.filter((item) => !memories.some((existing) => existing.id === item.id))];
      memoryStorage.save(next); setMemories(next); setStorageError("");
    } catch (reason) { setStorageError(reason instanceof Error ? reason.message : "Import failed validation."); }
  };

  const detailIndex = detail ? memories.findIndex((item) => item.id === detail.id) : -1;

  return (
    <main>
      <AnimatePresence>{!loaded && <motion.div className="threshold" exit={{ opacity: 0 }} transition={{ duration: 0.65 }}><div className="threshold-mask" /><p>MCKINNON / ACCESSING PRIVATE ARCHIVE</p><span><i /></span></motion.div>}</AnimatePresence>
      <nav className="site-nav" aria-label="Primary"><button className="wordmark" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>MCKINNON</button><div><button onClick={openIndex}>INDEX</button><button onClick={openAdd}>ADD <Plus size={14} /></button></div></nav>
      {!detail && !distilling && !indexOpen && !collectionCandidate && (
  <button
    type="button"
    className="quick-add-memory"
    onClick={openAdd}
    aria-label="Add a new performance memory"
  >
    <Plus size={18} weight="light" />
    <span>ADD MEMORY</span>
  </button>
)}
      {storageError && <div className="storage-error" role="alert">{storageError}<button onClick={() => setStorageError("")} aria-label="Dismiss"><X size={15} /></button></div>}
      <MaskPortal count={memories.length} />
      <Cabinet memories={memories} onOpen={openDetail} onAdd={openAdd} onCollectDrop={openCollectionChooser} />
      <footer><span>MCKINNON / A SCENT ARCHIVE</span><span>LOCAL &amp; PRIVATE / {pad(memories.length)}</span></footer>

      <AnimatePresence>
        {detail && !editing && (
          <MemoryDetail
            memory={detail}
            index={detailIndex}
            total={memories.length}
            onClose={closeOverlay}
            onPrevious={() => setDetail(memories[Math.max(0, detailIndex - 1)])}
            onNext={() => setDetail(memories[Math.min(memories.length - 1, detailIndex + 1)])}
            onEdit={() => { setEditing(detail); setDistilling(true); }}
            onDelete={deleteMemory}
            onCollectionChange={updateCollection}
          />
        )}
        {distilling && <Distiller editing={editing} onClose={closeOverlay} onSeal={sealMemory} />}
        {collectionCandidate && (
          <CollectionChooser
            memory={collectionCandidate}
            index={memories.findIndex((item) => item.id === collectionCandidate.id)}
            onClose={closeOverlay}
            onChoose={(style) => {
              if (updateCollectionRecord(collectionCandidate, style)) {
                setCollectionCandidate(null);
                window.setTimeout(() => returnFocus.current?.focus(), 30);
              }
            }}
          />
        )}
        {indexOpen && <IndexOverlay memories={memories} onClose={closeOverlay} onOpen={openDetail} onExport={exportJson} onImport={importJson} />}
        {sealed && <motion.div className="sealed-toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>MEMORY SEALED</motion.div>}
      </AnimatePresence>
    </main>
  );
}
