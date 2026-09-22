import { z } from 'zod';

/**
 * Questionnaire Answer Event Schema
 * 
 * Captures responses from dynamic clinical decision trees and red-flag screening batteries.
 */

export const QuestionTypeEnum = z.enum([
  'BOOLEAN',
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'NUMERIC',
  'FREE_TEXT'
]);

export const QuestionnaireCategoryEnum = z.enum([
  'RED_FLAG_SCREENING',
  'CARDIOVASCULAR',
  'RESPIRATORY',
  'NEUROLOGICAL',
  'TRAUMA_INJURY',
  'MEDICATION_HISTORY',
  'PAST_MEDICAL_HISTORY',
  'PREGNANCY_OBSTETRIC',
  'GENERAL'
]);

export const QuestionnairePayloadSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required').trim(),
  questionText: z.string().min(1, 'Question text is required').trim(),
  category: QuestionnaireCategoryEnum.default('GENERAL'),
  questionType: QuestionTypeEnum,
  answerValue: z.union([
    z.boolean(),
    z.string().min(1),
    z.number(),
    z.array(z.string().min(1))
  ]),
  responseLatencySeconds: z.number().nonnegative().optional()
}).superRefine((data, ctx) => {
  switch (data.questionType) {
    case 'BOOLEAN':
      if (typeof data.answerValue !== 'boolean') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `answerValue must be a boolean for questionType 'BOOLEAN', received ${typeof data.answerValue}`,
          path: ['answerValue']
        });
      }
      break;

    case 'SINGLE_CHOICE':
    case 'FREE_TEXT':
      if (typeof data.answerValue !== 'string') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `answerValue must be a string for questionType '${data.questionType}', received ${typeof data.answerValue}`,
          path: ['answerValue']
        });
      }
      break;

    case 'MULTI_CHOICE':
      if (!Array.isArray(data.answerValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `answerValue must be an array of strings for questionType 'MULTI_CHOICE'`,
          path: ['answerValue']
        });
      }
      break;

    case 'NUMERIC':
      if (typeof data.answerValue !== 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `answerValue must be a number for questionType 'NUMERIC', received ${typeof data.answerValue}`,
          path: ['answerValue']
        });
      }
      break;
  }
});

export type QuestionnairePayload = z.infer<typeof QuestionnairePayloadSchema>;
export type QuestionType = z.infer<typeof QuestionTypeEnum>;
export type QuestionnaireCategory = z.infer<typeof QuestionnaireCategoryEnum>;
