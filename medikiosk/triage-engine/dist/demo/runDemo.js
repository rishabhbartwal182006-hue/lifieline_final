import { io as Client } from "socket.io-client";
import { createServerInstance } from "../server/httpServer.js";
import { SOCKET_EVENTS } from "../events/socketEvents.js";
import { DEMO_SCENARIOS } from "./scenarios.js";
function parseArgs() {
    const args = process.argv.slice(2);
    let selectedCase = "3";
    let port = 4000;
    for (const arg of args) {
        if (arg.startsWith("--case=")) {
            const val = arg.split("=")[1];
            if (val === "1" || val === "2" || val === "3" || val === "all") {
                selectedCase = val;
            }
        }
        if (arg.startsWith("--port=")) {
            port = Number(arg.split("=")[1]) || 4000;
        }
    }
    return {
        selectedCase,
        port,
    };
}
/**
 * Checks whether the MediKiosk backend is already running.
 *
 * This prevents the demo from attempting to start a second
 * server on the same port as the Doctor Dashboard.
 */
async function isServerRunning(port) {
    try {
        const response = await fetch(`http://localhost:${port}/api/health`);
        return response.ok;
    }
    catch {
        return false;
    }
}
async function playScenario(scenario, kioskSocket, serverUrl) {
    console.log("\n======================================================================");
    console.log(`🎬 DEMO PRESENTATION: ${scenario.title.toUpperCase()}`);
    console.log("======================================================================");
    console.log(`👤 Patient: ${scenario.patientName} | ABHA: ${scenario.abhaId}`);
    console.log(`🆔 Session ID: ${scenario.sessionId}`);
    console.log(`📋 Clinical Overview: ${scenario.clinicalSummary}`);
    console.log("----------------------------------------------------------------------\n");
    /**
     * Join the patient session.
     */
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Timed out while joining session ${scenario.sessionId}`));
        }, 10000);
        kioskSocket.emit(SOCKET_EVENTS.CLIENT.JOIN_SESSION, {
            sessionId: scenario.sessionId,
        }, (response) => {
            clearTimeout(timeout);
            if (response?.success === false) {
                reject(new Error(response.error || "Unable to join session"));
                return;
            }
            resolve();
        });
    });
    /**
     * Play each demo event.
     */
    for (const step of scenario.steps) {
        console.log(`\n[STEP ${step.stepNumber}/${scenario.steps.length}] ${step.label}`);
        console.log(`   📤 Emitting event: [${step.event.eventType}] (ID: ${step.event.id})`);
        kioskSocket.emit(SOCKET_EVENTS.CLIENT.PATIENT_EVENT_RECEIVED, step.event);
        await new Promise((resolve) => setTimeout(resolve, step.delayMs));
    }
    /**
     * Retrieve the explainability/audit report.
     */
    console.log("\n----------------------------------------------------------------------");
    console.log("📊 AUDIT TRAIL & EXPLAINABILITY REPORT (Doctor / Judge View):");
    console.log("----------------------------------------------------------------------");
    try {
        const encodedSessionId = encodeURIComponent(scenario.sessionId);
        const auditUrl = `${serverUrl}/api/events/session/${encodedSessionId}/audit`;
        const auditResponse = await fetch(auditUrl);
        if (!auditResponse.ok) {
            console.log(`Unable to retrieve audit trail. HTTP ${auditResponse.status}`);
        }
        else {
            const auditData = (await auditResponse.json());
            if (auditData.markdown) {
                console.log(auditData.markdown);
            }
            else {
                console.log("No audit records found.");
            }
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Unable to retrieve audit trail: ${message}`);
    }
    console.log("----------------------------------------------------------------------\n");
}
export async function runCliDemo() {
    const { selectedCase, port } = parseArgs();
    /**
     * IMPORTANT:
     * This URL is used by BOTH:
     * - the Socket.IO demo client
     * - the REST audit request
     */
    const serverUrl = `http://localhost:${port}`;
    let server = null;
    /**
     * Check whether the MediKiosk backend is already running.
     *
     * If it is already running, the demo connects to it instead
     * of starting another server on port 4000.
     */
    const alreadyRunning = await isServerRunning(port);
    if (alreadyRunning) {
        console.log(`\nℹ️  MediKiosk server already running on port ${port}.`);
        console.log("📡 Demo will connect to the existing server.");
    }
    else {
        console.log(`\n🏥 No server detected on port ${port}. Starting MediKiosk server...`);
        server = createServerInstance();
        await server.start(port);
    }
    /**
     * Create the kiosk Socket.IO client.
     */
    const kioskSocket = Client(serverUrl, {
        transports: ["websocket", "polling"],
    });
    /**
     * Wait for Socket.IO connection.
     */
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Unable to connect to MediKiosk server at ${serverUrl}`));
        }, 10000);
        kioskSocket.on("connect", () => {
            clearTimeout(timeout);
            console.log("📡 Demo kiosk connected to MediKiosk server");
            console.log(`🔌 Socket ID: ${kioskSocket.id}`);
            resolve();
        });
        kioskSocket.on("connect_error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
    /**
     * Listen for TRIAGE_UPDATED.
     *
     * This represents what the real Doctor Dashboard
     * would receive through its own Socket.IO connection.
     */
    kioskSocket.on(SOCKET_EVENTS.SERVER.TRIAGE_UPDATED, (payload) => {
        console.log(`   👨‍⚕️ [Doctor Dashboard] Live Update: Session "${payload.sessionId}" -> [${payload.triageResult.triageLevel}]`);
        console.log(`       Action: ${payload.triageResult.action}`);
    });
    /**
     * Listen for emergency escalation.
     */
    kioskSocket.on(SOCKET_EVENTS.SERVER.ESCALATION_REQUIRED, (payload) => {
        console.log("\n   🚨🚨🚨 [DOCTOR DASHBOARD] EMERGENCY ESCALATION 🚨🚨🚨");
        console.log(`       Patient: ${payload.patientId || "Unknown"}`);
        console.log(`       Session: ${payload.sessionId}`);
        console.log(`       Rules: ${payload.triggeredRules.join(", ")}`);
        console.log(`       Action: ${payload.action}`);
        console.log(`       Reason: ${payload.reason}`);
    });
    /**
     * Listen for questionnaire interruption.
     */
    kioskSocket.on(SOCKET_EVENTS.SERVER.QUESTIONNAIRE_INTERRUPTED, (payload) => {
        console.log("\n   🛑 [KIOSK] QUESTIONNAIRE INTERRUPTED");
        console.log(`       Clinical Priority: ${payload.triageLevel}`);
        console.log('       Guidance: "Please remain seated at the kiosk. Medical staff have been notified."');
    });
    /**
     * Listen for red flags.
     */
    kioskSocket.on(SOCKET_EVENTS.SERVER.RED_FLAG_DETECTED, (payload) => {
        console.log(`   ⚠️ [RED FLAG] ${payload.previousLevel} → ${payload.currentLevel}`);
    });
    /**
     * Execute requested scenario.
     */
    if (selectedCase === "all") {
        await playScenario(DEMO_SCENARIOS[1], kioskSocket, serverUrl);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await playScenario(DEMO_SCENARIOS[2], kioskSocket, serverUrl);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await playScenario(DEMO_SCENARIOS[3], kioskSocket, serverUrl);
    }
    else {
        const caseNum = Number(selectedCase);
        await playScenario(DEMO_SCENARIOS[caseNum], kioskSocket, serverUrl);
    }
    console.log("\n======================================================================");
    console.log("✅ Demo sequence successfully completed.");
    console.log("======================================================================\n");
    /**
     * Disconnect demo kiosk.
     */
    // -----------------------------------------------------------------------
    // CLEAN SHUTDOWN
    // -----------------------------------------------------------------------
    // Remove listeners before disconnecting so Socket.IO does not attempt
    // additional work while Node is shutting down.
    kioskSocket.removeAllListeners();
    // Disconnect the demo kiosk socket gracefully.
    if (kioskSocket.connected) {
        kioskSocket.disconnect();
    }
    // Give Engine.IO/Socket.IO time to release its underlying handles.
    // This is particularly important on Windows/Node.js.
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Only stop the server if this demo process actually started it.
    if (server) {
        try {
            await server.stop();
        }
        catch (error) {
            console.warn("⚠️ Warning while stopping MediKiosk server:", error instanceof Error ? error.message : error);
        }
    }
    // Give the HTTP/Socket.IO event loop time to finish closing.
    await new Promise((resolve) => setTimeout(resolve, 500));
}
/**
 * CLI entry point.
 */
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
    runCliDemo()
        .then(() => {
        console.log("Demo process finished cleanly.");
    })
        .catch((err) => {
        console.error("Demo run error:", err);
        process.exitCode = 1;
    });
}
