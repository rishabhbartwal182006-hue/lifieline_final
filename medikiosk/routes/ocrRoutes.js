const express = require("express");
const multer = require("multer");

const {
    extractText
} = require("../services/ocrService");

const {
    parseDocument
} = require("../services/documentParser");

const router = express.Router();


// =====================================================
// FILE UPLOAD CONFIGURATION
// =====================================================

const upload = multer({

    // Store uploaded file temporarily in memory
    storage: multer.memoryStorage(),

    // Maximum file size = 10 MB
    limits: {
        fileSize: 10 * 1024 * 1024
    },

    // Allowed image types
    fileFilter: (req, file, cb) => {

        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {

            return cb(
                new Error(
                    "Only JPG, JPEG, PNG and WEBP images are allowed."
                )
            );
        }

        cb(null, true);
    }

});


// =====================================================
// POST /api/v1/ocr
// =====================================================

router.post(
    "/",
    (req, res, next) => {
        upload.single("document")(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message || "File upload failed. Please upload a JPG or PNG image."
                });
            }
            next();
        });
    },
    async (req, res) => {

        try {

            // -------------------------------------------------
            // STEP 1: Check whether document was uploaded
            // -------------------------------------------------

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please upload a document."

                });

            }


            console.log(
                `[OCR] Received: ${req.file.originalname}`
            );


            // -------------------------------------------------
            // STEP 2: Perform OCR
            // -------------------------------------------------

            const result =
                await extractText(
                    req.file.buffer
                );


            console.log(
                `[OCR] Text extraction completed. Confidence: ${result.confidence}%`
            );


            // -------------------------------------------------
            // STEP 3: Parse OCR text
            // -------------------------------------------------

            const structuredData =
                parseDocument(
                    result.text
                );


            console.log(
                `[OCR] Document type: ${structuredData.documentType}`
            );


            // -------------------------------------------------
            // STEP 4: Create OCR document object
            // -------------------------------------------------

            const ocrDocument = {

                // Unique OCR document ID
                documentId:
                    `OCR-${Date.now()}-${Math.random()
                        .toString(36)
                        .substring(2, 8)}`,


                // Original uploaded file name
                fileName:
                    req.file.originalname,


                // File MIME type
                mimeType:
                    req.file.mimetype,


                // PRESCRIPTION / LAB_REPORT / UNKNOWN
                documentType:
                    structuredData.documentType,


                // Raw OCR output
                extractedText:
                    result.text,


                // Parsed medical information
                structuredData:
                    structuredData,


                // Convert 0-100 confidence to 0-1
                confidence:
                    result.confidence / 100,


                // Provenance information
                provenanceMeta: {

                    provenance:
                        "scanned-document",

                    confidence:
                        result.confidence / 100,

                    timestamp:
                        new Date()

                },


                // OCR information is not clinically verified yet
                verificationStatus:
                    "PROVISIONAL",


                // Doctor should verify OCR information
                requiresVerification:
                    true,


                // OCR processing timestamp
                processedAt:
                    new Date()

            };


            // -------------------------------------------------
            // STEP 5: Return OCR result to frontend
            // -------------------------------------------------

            return res.status(200).json({

                success: true,

                message:
                    "Document OCR completed successfully.",

                data:
                    ocrDocument

            });

        }


        // =====================================================
        // ERROR HANDLING
        // =====================================================

        catch (error) {

            console.error(
                "[OCR ERROR]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "OCR processing failed.",

                error:
                    error.message

            });

        }

    }

);


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;