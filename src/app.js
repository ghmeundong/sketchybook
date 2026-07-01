import rough from "roughjs";
import paperTexture from "./img/paper-texture.jpg";

const startTitle = document.querySelector("[data-start-button]");
const startPage = document.querySelector(".page-start");
const selectionPage = document.querySelector(".page-selection");
const stageCards = Array.from(document.querySelectorAll(".stage-card"));

const body = document.body;
body.style.backgroundImage = `url(${paperTexture})`;
body.style.backgroundSize = "cover";
body.style.backgroundPosition = "center";
body.style.backgroundRepeat = "no-repeat";
body.style.backgroundAttachment = "fixed";

function drawRoughFrame(card) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.display = "block";
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "visible";

  const rc = rough.svg(svg);
  const shape = rc.rectangle(8, 8, 84, 84, {
    stroke: "#4f3b24",
    strokeWidth: 1.3,
    roughness: 1.6,
    bowing: 1.2,
    fill: "transparent",
  });

  svg.appendChild(shape);
  card.appendChild(svg);
}

if (startPage) {
  startPage.classList.add("is-active");
}

if (selectionPage) {
  selectionPage.classList.remove("is-active");
}

stageCards.forEach((card) => drawRoughFrame(card));

if (startTitle && startPage && selectionPage) {
  startTitle.addEventListener("click", () => {
    startTitle.textContent = "Loading...";

    window.setTimeout(() => {
      startPage.classList.remove("is-active");
      selectionPage.classList.add("is-active");
      startTitle.textContent = "Game Start";
    }, 800);
  });
}
stageCards.forEach((card, index) => {
  card.addEventListener("click", () => {
    const stageNumber = index + 1;
    window.location.href = `./game.html?stage=${stageNumber}`;
  });
});
