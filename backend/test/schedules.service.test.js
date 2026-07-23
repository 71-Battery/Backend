const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { SchedulesService } = require('../src/schedules.service');
const {
  seoulCurrentAndNextMonthRange,
} = require('../src/seoul-date.util');

test('uses today through the end of next month in Asia/Seoul', () => {
  assert.deepEqual(
    seoulCurrentAndNextMonthRange(new Date('2026-07-23T01:00:00.000Z')),
    {
      fromDate: '2026-07-23',
      toDate: '2026-08-31',
    },
  );
});

test('maps schedules and prioritizes the authenticated student grade', async () => {
  const dataGsm = {
    getSchedules: async () => [
      {
        scheduleId: 'school_20260725',
        schoolCode: '7430310',
        schoolName: '광주소프트웨어마이스터고등학교',
        officeCode: 'G10',
        officeName: '광주광역시교육청',
        scheduleDate: '2026-07-25',
        academicYear: '2026',
        eventName: '실무프로젝트 중간보고서 제출',
        eventContent: '중간보고서 제출 일정',
        dayCategory: '학사일정',
        schoolCourseType: '고등학교',
        dayNightType: '주간',
        targetGrades: [2],
      },
      {
        scheduleId: 'school_20260724',
        schoolCode: '7430310',
        schoolName: '광주소프트웨어마이스터고등학교',
        officeCode: 'G10',
        officeName: '광주광역시교육청',
        scheduleDate: '2026-07-24',
        academicYear: '2026',
        eventName: '1학년 행사',
        eventContent: null,
        dayCategory: null,
        schoolCourseType: '고등학교',
        dayNightType: '주간',
        targetGrades: [1],
      },
    ],
  };
  const profiles = {
    resolve: async () => ({
      profile: { grade: 2 },
      meta: { fallback: false },
    }),
  };
  const service = new SchedulesService(dataGsm, profiles);

  const result = await service.list(
    { id: 'user-id', email: 'student@gsm.hs.kr' },
    '2026-07-01',
    '2026-07-31',
  );

  assert.equal(result.schedules[0].id, 'school_20260725');
  assert.equal(result.schedules[0].importance, 'HIGH');
  assert.equal(result.schedules[0].target, '2학년');
  assert.equal(result.schedules[0].source, 'DATA_GSM');
  assert.equal(result.meta.timezone, 'Asia/Seoul');
});
