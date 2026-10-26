import "./style.css";
import "./app/app.js";
import { initializeModeSelection } from "./app/modeSelection.js";
import "./game/main.js";
import "./app/uiSounds.js";
import "./app/pageLoader.js";
import { initGoogleAuth } from "./services/googleAuthUi.js";

initializeModeSelection();
initGoogleAuth();
