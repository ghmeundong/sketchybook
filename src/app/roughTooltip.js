import rough from "roughjs";
import { drawRoughFrameRect } from "../game/ui/roughFrame.js";

const TOOLTIP_ID = "rough-tooltip";
let tooltip = null;
let tooltipLabel = null;
let activeTarget = null;
let activePointerPosition = null;

function resolveTooltipTarget(target) {
  return target instanceof Element ? target.closest("[data-tooltip]") : null;
}

function createTooltip() {
  if (tooltip) return tooltip;

  tooltip = document.createElement("div");
  tooltip.id = TOOLTIP_ID;
  tooltip.className = "rough-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 220 82");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const frame = drawRoughFrameRect(rough.svg(svg), 8, 8, 202, 66, {
    strokeWidth: 2,
    roughness: 2,
    fill: "rgba(250, 244, 216, 0.96)",
  });
  svg.appendChild(frame);

  tooltipLabel = document.createElement("span");
  tooltipLabel.className = "rough-tooltip-label";
  tooltip.append(svg, tooltipLabel);
  document.body.appendChild(tooltip);
  return tooltip;
}

function positionTooltip(event, target = activeTarget) {
  if (!tooltip || !target) return;

  const targetRect = target.getBoundingClientRect();
  const mouseX = event?.clientX ?? targetRect.left + targetRect.width / 2;
  const mouseY = event?.clientY ?? targetRect.top + targetRect.height / 2;
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 12;
  const offset = 18;
  let left = mouseX + offset;
  let top = mouseY + offset;

  if (left + tooltipRect.width > window.innerWidth - margin) {
    left = mouseX - tooltipRect.width - offset;
  }
  if (top + tooltipRect.height > window.innerHeight - margin) {
    top = mouseY - tooltipRect.height - offset;
  }

  tooltip.style.left = `${Math.max(margin, left)}px`;
  tooltip.style.top = `${Math.max(margin, top)}px`;
}

function showTooltip(target, event) {
  const message = target?.dataset.tooltip?.trim();
  if (!message) {
    hideTooltip();
    return;
  }

  if (activeTarget && activeTarget !== target) hideTooltip();
  createTooltip();
  activeTarget = target;
  activePointerPosition = event ? { clientX: event.clientX, clientY: event.clientY } : null;
  tooltipLabel.textContent = message;
  target.setAttribute("aria-describedby", TOOLTIP_ID);
  tooltip.setAttribute("aria-hidden", "false");
  positionTooltip(event, target);
  tooltip.classList.add("is-visible");
}

function hideTooltip() {
  if (!activeTarget) return;
  if (activeTarget.getAttribute("aria-describedby") === TOOLTIP_ID) {
    activeTarget.removeAttribute("aria-describedby");
  }
  activeTarget = null;
  activePointerPosition = null;
  tooltip?.classList.remove("is-visible");
  tooltip?.setAttribute("aria-hidden", "true");
}

export function initializeRoughTooltips() {
  document.addEventListener("pointerover", (event) => {
    const target = resolveTooltipTarget(event.target);
    if (!target || target.contains(event.relatedTarget)) return;
    showTooltip(target, event);
  });
  document.addEventListener("pointermove", (event) => {
    const target = resolveTooltipTarget(event.target);
    if (target && target !== activeTarget) {
      showTooltip(target, event);
    } else if (target === activeTarget) {
      activePointerPosition = { clientX: event.clientX, clientY: event.clientY };
      positionTooltip(event, activeTarget);
    }
  });
  document.addEventListener("pointerout", (event) => {
    if (
      activeTarget &&
      resolveTooltipTarget(event.target) === activeTarget &&
      !activeTarget.contains(event.relatedTarget)
    ) {
      hideTooltip();
    }
  });
  document.addEventListener("focusin", (event) => {
    const target = resolveTooltipTarget(event.target);
    if (target) showTooltip(target);
  });
  document.addEventListener("focusout", (event) => {
    if (resolveTooltipTarget(event.target) === activeTarget) hideTooltip();
  });
  const tooltipObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.target === activeTarget)) {
      showTooltip(activeTarget, activePointerPosition);
    }
  });
  tooltipObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-tooltip"],
    subtree: true,
  });
}
