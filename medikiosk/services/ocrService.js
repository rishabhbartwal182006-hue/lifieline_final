const { createWorker } = require("tesseract.js");

let worker = null;

/**
 * Create OCR worker only once
 */
async function getWorker() {
    if (!worker) {
        console.log("[OCR] Starting Tesseract worker...");

        worker = await createWorker("eng");

        console.log("[OCR] Tesseract worker ready.");
    }

    return worker;
}


/**
 * Extract text from an image
 */
async function extractText(imageBuffer) {

    const ocrWorker = await getWorker();

    console.log("[OCR] Processing document...");

    const result = await ocrWorker.recognize(
        imageBuffer
    );

    return {
        text: result.data.text || "",
        confidence: result.data.confidence || 0
    };
}


/**
 * Stop OCR worker
 */
async function closeWorker() {

    if (worker) {

        await worker.terminate();

        worker = null;

        console.log("[OCR] Worker stopped.");
    }
}


module.exports = {
    getWorker,
    extractText,
    closeWorker
};