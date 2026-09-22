import { z } from 'zod';
/**
 * Questionnaire Answer Event Schema
 *
 * Captures responses from dynamic clinical decision trees and red-flag screening batteries.
 */
export declare const QuestionTypeEnum: z.ZodEnum<["BOOLEAN", "SINGLE_CHOICE", "MULTI_CHOICE", "NUMERIC", "FREE_TEXT"]>;
export declare const QuestionnaireCategoryEnum: z.ZodEnum<["RED_FLAG_SCREENING", "CARDIOVASCULAR", "RESPIRATORY", "NEUROLOGICAL", "TRAUMA_INJURY", "MEDICATION_HISTORY", "PAST_MEDICAL_HISTORY", "PREGNANCY_OBSTETRIC", "GENERAL"]>;
export declare const QuestionnairePayloadSchema: z.ZodEffects<z.ZodObject<{
    questionId: z.ZodString;
    questionText: z.ZodString;
    category: z.ZodDefault<z.ZodEnum<["RED_FLAG_SCREENING", "CARDIOVASCULAR", "RESPIRATORY", "NEUROLOGICAL", "TRAUMA_INJURY", "MEDICATION_HISTORY", "PAST_MEDICAL_HISTORY", "PREGNANCY_OBSTETRIC", "GENERAL"]>>;
    questionType: z.ZodEnum<["BOOLEAN", "SINGLE_CHOICE", "MULTI_CHOICE", "NUMERIC", "FREE_TEXT"]>;
    answerValue: z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString, "many">]>;
    responseLatencySeconds: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    questionId: string;
    questionText: string;
    category: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL";
    questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
    answerValue: string | number | boolean | string[];
    responseLatencySeconds?: number | undefined;
}, {
    questionId: string;
    questionText: string;
    questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
    answerValue: string | number | boolean | string[];
    category?: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL" | undefined;
    responseLatencySeconds?: number | undefined;
}>, {
    questionId: string;
    questionText: string;
    category: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL";
    questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
    answerValue: string | number | boolean | string[];
    responseLatencySeconds?: number | undefined;
}, {
    questionId: string;
    questionText: string;
    questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
    answerValue: string | number | boolean | string[];
    category?: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL" | undefined;
    responseLatencySeconds?: number | undefined;
}>;
export type QuestionnairePayload = z.infer<typeof QuestionnairePayloadSchema>;
export type QuestionType = z.infer<typeof QuestionTypeEnum>;
export type QuestionnaireCategory = z.infer<typeof QuestionnaireCategoryEnum>;
