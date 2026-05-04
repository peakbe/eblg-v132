import { API_BASE } from "./config.js";

const livePanel = document.getElementById("logs-live");
const liveLogs = [];

// ------------------------------------------------------
// Ajout d'une entrée LIVE
// ------------------------------------------------------
function addLiveLog(status, message) {
    const entry = {
        status,
        message,
        time: new Date().toLocaleTimeString()
    };

    liveLogs.unshift(entry);
    if (liveLogs.length > 40) liveLogs.pop();

    renderLiveLogs();
}

// ------------------------------------------------------
// Rendu du panneau LIVE
// ------------------------------------------------------
function renderLiveLogs() {
    livePanel.innerHTML = liveLogs.map(log => `
        <div class="log-live-entry log-live-${log.status}">
            <span class="log-live-time">${log.time}</span>
            ${log.message}
        </div>
    `).join("");
}

// ------------------------------------------------------
// Probe générique
// ------------------------------------------------------
async function probe(name, endpoint) {
    try {
        const res = await fetch(`${API_BASE}/${endpoint}`);
        const json = await res.json();

        if (json.fallback) {
            addLiveLog("warn", `${name} → fallback`);
        } else {
            addLiveLog("ok", `${name} → OK`);
        }

    } catch (err) {
        addLiveLog("error", `${name} → erreur`);
    }
}

// ------------------------------------------------------
// Démarrage du streaming LIVE
// ------------------------------------------------------
export function startLiveLogs() {
    // Premier tick immédiat
    probe("METAR", "metar");
    probe("TAF", "taf");
    probe("FIDS", "fids");
    probe("Backend", "sonos");

    // Streaming toutes les 5 secondes
    setInterval(() => {
        probe("METAR", "metar");
        probe("TAF", "taf");
        probe("FIDS", "fids");
        probe("Backend", "sonos");
    }, 5000);
}
