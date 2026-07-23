import { z } from 'zod';

const nullableInteger = z.number().int().nullable().optional().default(null);
const nullableText = z.string().nullable().optional().default(null);

export const dataGsmStudentSchema = z.object({
  id: z.union([z.string(), z.number().int()]),
  name: z.string().min(1),
  email: z.string().email(),
  grade: nullableInteger,
  classNum: nullableInteger,
  number: nullableInteger,
  studentNumber: nullableInteger,
  major: z
    .enum(['SW_DEVELOPMENT', 'SMART_IOT', 'AI'])
    .nullable()
    .optional()
    .default(null),
  specialty: nullableText,
  role: z.string().nullable().optional().default(null),
});

export type DataGsmStudent = z.infer<typeof dataGsmStudentSchema>;

export const dataGsmStudentsEnvelopeSchema = z.object({
  data: z.object({
    students: z.array(dataGsmStudentSchema),
  }),
});

export const dataGsmScheduleSchema = z.object({
  scheduleId: z.union([z.string(), z.number().int()]),
  schoolCode: z.string(),
  schoolName: z.string(),
  officeCode: z.string(),
  officeName: z.string(),
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  academicYear: z.union([z.string(), z.number().int()]),
  eventName: z.string().min(1),
  eventContent: nullableText,
  dayCategory: nullableText,
  schoolCourseType: nullableText,
  dayNightType: nullableText,
  targetGrades: z.array(z.number().int()).default([]),
});

export type DataGsmSchedule = z.infer<typeof dataGsmScheduleSchema>;

export const dataGsmSchedulesEnvelopeSchema = z.object({
  data: z.object({
    schedules: z.array(dataGsmScheduleSchema),
  }),
});
