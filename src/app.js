import paperTexture from "./img/paper-texture.jpg";

const startTitle = document.querySelector("[data-start-button]");
const body = document.body;

body.style.backgroundImage = `url(${paperTexture})`;
body.style.backgroundSize = "cover";
body.style.backgroundPosition = "center";
body.style.backgroundRepeat = "no-repeat";
body.style.backgroundAttachment = "fixed";

if (startTitle) {
  startTitle.addEventListener("click", () => {
    window.location.href = "./game.html";
  });
}
