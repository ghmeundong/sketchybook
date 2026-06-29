import "./style.css";

console.log("Template project loaded");

const root = document.querySelector("main");
if (root) {
  const note = document.createElement("p");
  note.textContent = "This is a starter template. Replace this with your app code.";
  root.appendChild(note);
}
