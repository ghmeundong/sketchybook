import "./style.css";
import { initializeLocalization } from "./app/localization.js";
import "./app/app.js";
import { initializeModeSelection } from "./app/modeSelection.js";
import "./game/main.js";
import "./app/uiSounds.js";
import "./app/pageLoader.js";
import { initGoogleAuth } from "./services/googleAuthUi.js";
import { initializeRoughTooltips } from "./app/roughTooltip.js";
import { initializeMapEditor } from "./app/mapEditor.js";

initializeLocalization();
initializeRoughTooltips();
initializeModeSelection();
initializeMapEditor();
initGoogleAuth();
