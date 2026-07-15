"use client";

import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 560px)";
const TABLET_QUERY = "(max-width: 900px)";

type ViewportMode = {
  name: "desktop" | "tablet" | "mobile";
  pageSize: number;
};

function getViewportMode(): ViewportMode {
  if (window.matchMedia(MOBILE_QUERY).matches) {
    return { name: "mobile", pageSize: 6 };
  }

  if (window.matchMedia(TABLET_QUERY).matches) {
    return { name: "tablet", pageSize: 9 };
  }

  return { name: "desktop", pageSize: 15 };
}

function createButton(label: string, className: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  return button;
}

export default function ArchivePaginationFeature() {
  useEffect(() => {
    let disposed = false;
    let currentGrid: HTMLElement | null = null;
    let currentCabinetSpace: HTMLElement | null = null;
    let currentController: HTMLElement | null = null;
    let currentPage = 0;
    let currentMode = getViewportMode();
    let scheduledFrame: number | null = null;

    const cleanupCurrentHost = () => {
      currentController?.remove();
      currentController = null;

      currentCabinetSpace?.classList.remove(
        "has-archive-pagination",
        "archive-mode-desktop",
        "archive-mode-tablet",
        "archive-mode-mobile",
      );

      currentGrid
        ?.querySelectorAll<HTMLElement>(":scope > .bottle-button")
        .forEach((button) => {
          button.hidden = false;
          button.removeAttribute("aria-hidden");
          button.classList.remove("archive-page-item", "is-page-visible");
          button.style.removeProperty("--archive-item-order");
        });

      currentGrid = null;
      currentCabinetSpace = null;
    };

    const renderPage = () => {
      if (!currentGrid || !currentCabinetSpace || !currentController) return;

      currentMode = getViewportMode();

      currentCabinetSpace.classList.remove(
        "archive-mode-desktop",
        "archive-mode-tablet",
        "archive-mode-mobile",
      );
      currentCabinetSpace.classList.add(
        "has-archive-pagination",
        `archive-mode-${currentMode.name}`,
      );

      const allButtons = Array.from(
        currentGrid.querySelectorAll<HTMLElement>(":scope > .bottle-button"),
      );

      const addButton =
        allButtons.find((button) => button.querySelector(".ghost-bottle")) ?? null;
      const memoryButtons = allButtons.filter((button) => button !== addButton);

      const totalPages = Math.max(
        1,
        Math.ceil(memoryButtons.length / currentMode.pageSize),
      );
      currentPage = Math.min(currentPage, totalPages - 1);

      const startIndex = currentPage * currentMode.pageSize;
      const endIndex = Math.min(
        startIndex + currentMode.pageSize,
        memoryButtons.length,
      );
      const visibleButtons = new Set(
        memoryButtons.slice(startIndex, endIndex),
      );

      memoryButtons.forEach((button, index) => {
        const visible = visibleButtons.has(button);
        button.hidden = !visible;
        button.setAttribute("aria-hidden", String(!visible));
        button.classList.toggle("archive-page-item", visible);
        button.classList.toggle("is-page-visible", visible);

        if (visible) {
          button.style.setProperty(
            "--archive-item-order",
            String(index - startIndex),
          );
        } else {
          button.style.removeProperty("--archive-item-order");
        }
      });

      if (addButton) {
        addButton.hidden = true;
        addButton.setAttribute("aria-hidden", "true");
      }

      const previous = currentController.querySelector<HTMLButtonElement>(
        ".archive-pagination-previous",
      );
      const next = currentController.querySelector<HTMLButtonElement>(
        ".archive-pagination-next",
      );
      const pageLabel = currentController.querySelector<HTMLElement>(
        ".archive-pagination-page",
      );
      const rangeLabel = currentController.querySelector<HTMLElement>(
        ".archive-pagination-range",
      );

      if (previous) previous.disabled = currentPage === 0;
      if (next) next.disabled = currentPage >= totalPages - 1;

      if (pageLabel) {
        pageLabel.textContent = `CABINET ${String(currentPage + 1).padStart(
          2,
          "0",
        )} / ${String(totalPages).padStart(2, "0")}`;
      }

      if (rangeLabel) {
        rangeLabel.textContent =
          memoryButtons.length === 0
            ? "EMPTY CABINET"
            : `MEMORIES ${String(startIndex + 1).padStart(3, "0")}—${String(
                endIndex,
              ).padStart(3, "0")}`;
      }
    };

    const mountController = (
      grid: HTMLElement,
      cabinetSpace: HTMLElement,
      shell: HTMLElement,
    ) => {
      currentGrid = grid;
      currentCabinetSpace = cabinetSpace;
      currentPage = 0;

      const controller = document.createElement("nav");
      controller.className = "archive-pagination";
      controller.setAttribute("aria-label", "Archive cabinet pages");

      const previous = createButton(
        "← PREVIOUS",
        "archive-pagination-button archive-pagination-previous",
      );
      const next = createButton(
        "NEXT →",
        "archive-pagination-button archive-pagination-next",
      );
      const add = createButton(
        "＋ DISTILL A MEMORY",
        "archive-pagination-button archive-pagination-add",
      );

      const status = document.createElement("div");
      status.className = "archive-pagination-status";

      const pageLabel = document.createElement("b");
      pageLabel.className = "archive-pagination-page";

      const rangeLabel = document.createElement("span");
      rangeLabel.className = "archive-pagination-range";
      rangeLabel.setAttribute("aria-live", "polite");

      status.append(pageLabel, rangeLabel);
      controller.append(previous, status, next, add);
      shell.insertAdjacentElement("afterend", controller);
      currentController = controller;

      previous.addEventListener("click", () => {
        currentPage = Math.max(0, currentPage - 1);
        renderPage();
        shell.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      next.addEventListener("click", () => {
        currentPage += 1;
        renderPage();
        shell.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      add.addEventListener("click", () => {
        const ghostButton = currentGrid?.querySelector<HTMLButtonElement>(
          ":scope > .bottle-button .ghost-bottle",
        )?.closest<HTMLButtonElement>(".bottle-button");

        ghostButton?.click();
      });

      renderPage();
    };

    const syncHost = () => {
      if (disposed) return;

      const nextGrid = document.querySelector<HTMLElement>(".bottle-grid");
      const nextShell = nextGrid?.closest<HTMLElement>(".cabinet-shell") ?? null;
      const nextCabinetSpace =
        nextGrid?.closest<HTMLElement>(".cabinet-space") ?? null;

      if (!nextGrid || !nextShell || !nextCabinetSpace) {
        if (currentGrid) cleanupCurrentHost();
        return;
      }

      if (
        nextGrid !== currentGrid ||
        nextCabinetSpace !== currentCabinetSpace ||
        !currentController?.isConnected
      ) {
        cleanupCurrentHost();
        mountController(nextGrid, nextCabinetSpace, nextShell);
        return;
      }

      renderPage();
    };

    const scheduleSync = () => {
      if (scheduledFrame !== null) return;

      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = null;
        syncHost();
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const handleResize = () => {
      const nextMode = getViewportMode();

      if (
        nextMode.name !== currentMode.name ||
        nextMode.pageSize !== currentMode.pageSize
      ) {
        currentPage = 0;
        currentMode = nextMode;
      }

      renderPage();
    };

    window.addEventListener("resize", handleResize);
    syncHost();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", handleResize);

      if (scheduledFrame !== null) {
        window.cancelAnimationFrame(scheduledFrame);
      }

      cleanupCurrentHost();
    };
  }, []);

  return null;
}
