// ======================================================
// METAR.JS — EBLG Tower Glass PRO+++
// ======================================================

import { drawApproachCorridor, drawDepartureCorridor } from "./map.js";

const METAR_URL = "/api/metar";

let lastMetar = null;
let lastRunway = null;

// -----------------------------
// Init
// -----------------------------
export function initMetar() {
    loadMetar();
    setInterval(loadMetar, 5 * 60 * 1000);
}
// ======================================================
// SAFE LOAD METAR — PRO+++
// - Retry intelligent (3 tentatives)
// - Détection fallback
// - Détection METAR périmé
// - Logs cockpit IFR
// ======================================================
export async function safeLoadMetar() {
    const MAX_RETRY = 3;
    let attempt = 0;

    while (attempt < MAX_RETRY) {
        attempt++;

        try {
            const t0 = performance.now();
            const r = await fetch(METAR_URL);

            const dt = Math.round(performance.now() - t0);
            console.log(`[METAR] Tentative ${attempt}/${MAX_RETRY} (${dt} ms)`);

            if (!r.ok) throw new Error("HTTP " + r.status);

            let metar;
            const contentType = r.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                const json = await r.json();
                metar = json.metar || json.raw || "";
            } else {
                metar = await r.text();
            }

            if (!metar) throw new Error("METAR vide");

            // Mise à jour UI
            updateMetarUI(metar);

            // Détection piste active
            const activeRunway = detectActiveRunway(metar);
            lastRunway = activeRunway;
            updateRunwayUI(activeRunway);

            // Corridors IFR
            if (window.map) {
                drawApproachCorridor(activeRunway);
                drawDepartureCorridor(activeRunway);
            }

            // Détection METAR périmé
            detectMetarAge(metar);

            console.log("[METAR] Chargé avec succès");
            return;

        } catch (err) {
            console.error(`[METAR] Erreur tentative ${attempt}:`, err);

            // Attente progressive avant retry
            await new Promise(res => setTimeout(res, attempt * 800));
        }
    }

    console.error("[METAR] ÉCHEC après 3 tentatives");
    showMetarError();
}

function detectMetarAge(metar) {
    const box = document.getElementById("metar-age");
    if (!box) return;

    const m = metar.match(/(\d{2})(\d{2})(\d{2})Z/);
    if (!m) {
        box.textContent = "Âge METAR : inconnu";
        box.style.color = "#ccc";
        return;
    }

    const day = parseInt(m[1], 10);
    const hour = parseInt(m[2], 10);
    const min = parseInt(m[3], 10);

    const now = new Date();
    const metarDate = new Date(now.getFullYear(), now.getMonth(), day, hour, min);

    const diffMin = Math.round((now - metarDate) / 60000);

    box.textContent = `Âge METAR : ${diffMin} min`;

    if (diffMin <= 20) box.style.color = "#00ff88";   // vert IFR
    else if (diffMin <= 40) box.style.color = "#ffaa00"; // orange
    else box.style.color = "#ff4444"; // rouge (périmé)
}

function showMetarError() {
    const el = document.getElementById("metar");
    if (el) {
        el.textContent = "METAR indisponible";
        el.style.color = "#ff4444";
    }

    const box = document.getElementById("metar-age");
    if (box) {
        box.textContent = "Âge METAR : —";
        box.style.color = "#ff4444";
    }
}

// -----------------------------
// Fetch METAR
// -----------------------------
async function loadMetar() {
    try {
        const r = await fetch(METAR_URL);
        if (!r.ok) throw new Error("HTTP " + r.status);

        let metar;

        // Support JSON ou texte
        const contentType = r.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const json = await r.json();
            metar = json.metar || json.raw || "";
        } else {
            metar = await r.text();
        }

        if (!metar) return;

        lastMetar = metar;
        updateMetarUI(metar);

        const activeRunway = detectActiveRunway(metar);
        lastRunway = activeRunway;

        updateRunwayUI(activeRunway);

        // Corridors (uniquement si map initialisée)
        if (window.map) {
            drawApproachCorridor(activeRunway);
            drawDepartureCorridor(activeRunway);
        }

    } catch (e) {
        console.error("[METAR] Erreur chargement", e);
    }
}

// -----------------------------
// UI METAR
// -----------------------------
function updateMetarUI(metar) {
    const el = document.getElementById("metar");
    if (el) el.textContent = metar;
}

// -----------------------------
// Détection piste active
// -----------------------------
function detectActiveRunway(metar) {
    const m = metar.match(/ (\d{3})(\d{2})KT/);
    if (!m) return null;

    const windDir = parseInt(m[1], 10);

    const rwy04 = 40;
    const rwy22 = 220;

    const diff04 = angleDiff(windDir, rwy04);
    const diff22 = angleDiff(windDir, rwy22);

    return diff04 < diff22 ? "04" : "22";
}

function angleDiff(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

// -----------------------------
// UI RWY
// -----------------------------
function updateRunwayUI(rwy) {
    const box = document.getElementById("rwy-indicator");
    const panel = document.getElementById("runway-active");

    if (!rwy) {
        if (box) box.textContent = "RWY --";
        if (panel) panel.textContent = "Piste active : --";
        return;
    }

    if (box) box.textContent = `RWY ${rwy}`;
    if (panel) panel.textContent = `Piste active : RWY ${rwy}`;
}
