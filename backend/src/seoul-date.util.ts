import { ApiException } from './common/api-exception';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateDate(value: string, fieldName: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new ApiException(
      'INVALID_DATE_RANGE',
      `${fieldName}는 YYYY-MM-DD 형식이어야 합니다.`,
      400,
    );
  }
  const [year, month, day] = value.split('-').map(Number);
  const epoch = Date.UTC(year, month - 1, day);
  const restored = new Date(epoch);
  if (
    restored.getUTCFullYear() !== year ||
    restored.getUTCMonth() + 1 !== month ||
    restored.getUTCDate() !== day
  ) {
    throw new ApiException(
      'INVALID_DATE_RANGE',
      '유효한 날짜 범위를 입력해 주세요.',
      400,
    );
  }
  return { year, month, day, epoch };
}

export function seoulToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function calendarDayDifference(
  targetDate: string,
  baseDate = seoulToday(),
) {
  const target = validateDate(targetDate, 'scheduleDate');
  const base = validateDate(baseDate, 'today');
  return Math.round((target.epoch - base.epoch) / 86_400_000);
}

export function addCalendarDays(date: string, days: number) {
  const parsed = validateDate(date, 'date');
  const result = new Date(parsed.epoch + days * 86_400_000);
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

export function seoulUpcomingScheduleRange(now = new Date()) {
  const fromDate = seoulToday(now);
  return {
    fromDate,
    toDate: addCalendarDays(fromDate, 89),
  };
}
