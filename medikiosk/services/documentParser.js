/**
 * Clean OCR text
 */
function normalizeText(text) {
    return text
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


/**
 * Identify whether document is:
 * PRESCRIPTION
 * LAB_REPORT
 * UNKNOWN
 */
function classifyDocument(text) {

    const normalizedText = text.toLowerCase();

    const prescriptionKeywords = [
        "prescription",
        "rx",
        "medicine",
        "medication",
        "tablet",
        "tab",
        "capsule",
        "cap",
        "syrup",
        "dosage",
        "dose",
        "doctor",
        "dr.",
        "mg",
        "ml"
    ];

    const labKeywords = [
        "laboratory",
        "laboratory report",
        "lab report",
        "pathology",
        "blood test",
        "test report",
        "reference range",
        "normal range",
        "hemoglobin",
        "haemoglobin",
        "glucose",
        "cholesterol",
        "platelet",
        "creatinine"
    ];


    let prescriptionScore = 0;
    let labScore = 0;


    for (const keyword of prescriptionKeywords) {

        if (normalizedText.includes(keyword)) {
            prescriptionScore++;
        }

    }


    for (const keyword of labKeywords) {

        if (normalizedText.includes(keyword)) {
            labScore++;
        }

    }


    if (
        labScore >= 2 &&
        labScore > prescriptionScore
    ) {
        return "LAB_REPORT";
    }


    if (prescriptionScore >= 2) {
        return "PRESCRIPTION";
    }


    return "UNKNOWN";
}


/**
 * Extract patient name.
 *
 * Examples:
 * Patient Name: Rahul Kumar
 * Patient: Rahul Kumar
 * Name: Rahul Kumar
 */
function extractPatientName(text) {

    const patterns = [

        /(?:patient\s*name|pt\s*name|patient)\s*[:\-]\s*([^\n\r]+?)(?=\s+(?:age|sex|gender|date|dob|dr\.)\b|[\r\n]|$)/i,

        /\bname\s*[:\-]\s*([^\n\r]+?)(?=\s+(?:age|sex|gender|date|dob|dr\.)\b|[\r\n]|$)/i,

        /(?:patient\s*name|pt\s*name|patient)\s*[:\-]\s*([^\n\r,;]+)/i,

        /\bname\s*[:\-]\s*([^\n\r,;]+)/i

    ];


    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {

            const cleaned = cleanValue(match[1]);

            if (cleaned && cleaned.length >= 2 && !/^(name|patient|age|date|doctor)$/i.test(cleaned)) {
                return cleaned;
            }

        }

    }

    return null;
}


/**
 * Extract age.
 *
 * Examples:
 * Age: 17
 * Age 17 Years
 * 17 Y
 * Age/Sex: 29/F
 */
function extractAge(text) {

    const patterns = [

        /age\s*[\/|\\]\s*(?:sex|gender)?\s*[:\-]?\s*(\d{1,3})/i,

        /age\s*[:\-]?\s*(\d{1,3})\s*(?:years?|yrs?|y)?/i,

        /\b(\d{1,3})\s*(?:years?|yrs?|y(?:\/|rs?))\b/i,

        /\b(\d{1,3})\s*[\/|\\]\s*(?:male|female|m|f|other)\b/i

    ];


    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {

            const age = Number(match[1]);

            if (age >= 0 && age <= 120) {
                return age;
            }

        }

    }


    return null;
}


/**
 * Extract gender.
 *
 * Examples:
 * Sex: Male
 * Gender: Female
 * Age/Sex: 29/F
 * 34 Yrs / Male
 */
function extractGender(text) {

    const m1 = text.match(/age\s*[\/|\\]\s*(?:sex|gender)?\s*[:\-]?\s*\d{1,3}\s*[\/|\\]\s*(male|female|m|f|other)/i);
    if (m1) {
        const val = m1[1].toLowerCase();
        return (val === "m" || val === "male") ? "Male" : (val === "f" || val === "female") ? "Female" : "Other";
    }

    const m2 = text.match(/\b\d{1,3}\s*(?:years?|yrs?|y)?\s*[\/|\\]\s*(male|female|m|f|other)\b/i);
    if (m2) {
        const val = m2[1].toLowerCase();
        return (val === "m" || val === "male") ? "Male" : (val === "f" || val === "female") ? "Female" : "Other";
    }

    const match = text.match(
        /(?:sex|gender)\s*[:\-]?\s*(male|female|m|f|other)\b/i
    );

    if (match) {
        const value = match[1].toLowerCase();

        if (
            value === "male" ||
            value === "m"
        ) {
            return "Male";
        }

        if (
            value === "female" ||
            value === "f"
        ) {
            return "Female";
        }

        return "Other";
    }

    const m4 = text.match(/\b(male|female)\b/i);
    if (m4) {
        const val = m4[1].toLowerCase();
        return val === "male" ? "Male" : "Female";
    }

    return null;
}


/**
 * Extract doctor name.
 */
function extractDoctorName(text) {

    const patterns = [

        /doctor\s*[:\-]\s*([^\n]+)/i,

        /physician\s*[:\-]\s*([^\n]+)/i,

        /dr\.?\s+([A-Za-z][A-Za-z .]+)/i

    ];


    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {

            return cleanValue(match[1]);

        }

    }


    return null;
}


/**
 * Extract date.
 *
 * Supports:
 * 28/03/2024
 * 28-03-2024
 * 28/03/24
 */
function extractDate(text) {

    const patterns = [

        /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,

        /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\b/,

        /\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/

    ];


    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {
            return match[1];
        }

    }


    return null;
}


/**
 * Extract medicines from prescription.
 *
 * Examples:
 *
 * Tab Paracetamol 500 mg
 * Paracetamol 500mg
 * Capsule Amoxicillin 250 mg
 */
function extractMedications(text) {

    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    const medications = [];


    for (const line of lines) {

        /*
         * Look for common medicine indicators.
         */
        const medicineMatch = line.match(
            /(?:tab(?:let)?\.?|cap(?:sule)?\.?|syp(?:rup)?\.?|drop|ointment|cream)\s+(.+)/i
        );


        if (!medicineMatch) {
            continue;
        }


        let medicineText =
            medicineMatch[1].trim();


        /*
         * Find dosage.
         *
         * Examples:
         * 500 mg
         * 250mg
         * 665 mg
         * 10 ml
         */
        const dosageMatch =
            medicineText.match(
                /(\d+(?:\.\d+)?\s*(?:mg|ml|g|mcg|iu))\b/i
            );


        let dosage = null;


        if (dosageMatch) {

            dosage =
                dosageMatch[1].trim();

        }


        /*
         * Remove dosage from medicine name.
         */
        let name = medicineText;


        if (dosageMatch) {

            name =
                medicineText
                    .substring(
                        0,
                        dosageMatch.index
                    )
                    .trim();

        }


        /*
         * Extract frequency.
         */
        const frequency =
            extractFrequency(line);


        /*
         * Clean common OCR characters.
         */
        name = name
            .replace(/[|]/g, "")
            .replace(/\s+/g, " ")
            .trim();


        if (name.length < 2) {
            continue;
        }


        medications.push({

            name,

            dosage,

            frequency

        });

    }


    return medications;
}


/**
 * Extract medicine frequency.
 *
 * Examples:
 * 1-0-1
 * 1-1-1
 * once daily
 * twice daily
 */
function extractFrequency(text) {

    const patterns = [

        /\b(\d-\d-\d)\b/i,

        /\b(\d-\d-\d-\d)\b/i,

        /\b(once\s+daily)\b/i,

        /\b(twice\s+daily)\b/i,

        /\b(thrice\s+daily)\b/i,

        /\b(once\s+a\s+day)\b/i,

        /\b(twice\s+a\s+day)\b/i

    ];


    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (match) {

            return match[1];

        }

    }


    return null;
}


/**
 * Extract laboratory results.
 *
 * Examples:
 *
 * Hemoglobin 13.5 g/dL
 * Glucose 98 mg/dL
 * Cholesterol 180 mg/dL
 */
function extractLabResults(text) {

    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);


    const results = [];


    for (const line of lines) {

        const match = line.match(
            /^([A-Za-z][A-Za-z0-9 ()\/-]{2,})\s+(\d+(?:\.\d+)?)\s*([A-Za-z/%µ]+)?/i
        );


        if (!match) {
            continue;
        }


        const testName =
            cleanValue(match[1]);

        const value =
            match[2];

        const unit =
            match[3] || null;


        if (
            testName.length < 3 ||
            testName.length > 50
        ) {
            continue;
        }


        results.push({

            testName: testName,

            value: value,

            unit: unit

        });

    }


    return results;
}


/**
 * Parse complete document.
 */
function parseDocument(text) {

    const cleanedText =
        normalizeText(text);


    const documentType =
        classifyDocument(cleanedText);


    const result = {

        documentType: documentType,

        patientName:
            extractPatientName(cleanedText),

        age:
            extractAge(cleanedText),

        gender:
            extractGender(cleanedText),

        doctorName:
            extractDoctorName(cleanedText),

        date:
            extractDate(cleanedText),

        symptoms:
            extractSymptoms(cleanedText)

    };


    /*
     * If prescription
     */
    if (
        documentType === "PRESCRIPTION"
    ) {

        result.medications =
            extractMedications(
                cleanedText
            );

    }


    /*
     * If lab report
     */
    if (
        documentType === "LAB_REPORT"
    ) {

        result.labResults =
            extractLabResults(
                cleanedText
            );

    }


    return result;
}


/**
 * Extract symptoms mentioned in the document.
 */
function extractSymptoms(text) {
    const lower = text.toLowerCase();
    const symptomsMap = [
        { label: "Cold / Runny nose", keys: ["cold", "runny nose", "rhinorrhea", "coryza"] },
        { label: "Chest discomfort", keys: ["chest pain", "chest discomfort", "angina", "chest pressure"] },
        { label: "Breathing difficulty", keys: ["breathing difficulty", "shortness of breath", "dyspnea", "breathlessness"] },
        { label: "Fever", keys: ["fever", "pyrexia", "high temp", "chills"] },
        { label: "Headache", keys: ["headache", "cephalalgia", "migraine"] },
        { label: "Cough", keys: ["cough", "dry cough", "wet cough"] },
        { label: "Stomach pain", keys: ["stomach pain", "abdominal pain", "gastritis", "cramps"] },
        { label: "Nausea", keys: ["nausea", "vomiting", "emesis"] }
    ];

    const detected = [];
    for (const item of symptomsMap) {
        for (const key of item.keys) {
            if (lower.includes(key)) {
                detected.push(item.label);
                break;
            }
        }
    }
    return detected;
}


/**
 * Clean extracted values.
 */
function cleanValue(value) {

    return value
        .replace(/\s+/g, " ")
        .replace(/^[:\-]+/, "")
        .trim();

}


module.exports = {

    normalizeText,

    classifyDocument,

    extractPatientName,

    extractAge,

    extractGender,

    extractDoctorName,

    extractDate,

    extractMedications,

    extractLabResults,

    parseDocument

};