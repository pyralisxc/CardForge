export const MARKETING_SCHEDULE_TIME_ZONE = 'America/Los_Angeles';

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const parseLocalDateTimeParts = (value: string): LocalDateTimeParts => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) throw new RangeError('Choose a valid Pacific date and time.');
  const parts = match.slice(1).map(Number);
  const [year, month, day, hour, minute] = parts;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
  ) throw new RangeError('Choose a valid Pacific date and time.');
  return { year, month, day, hour, minute };
};

const getPacificParts = (date: Date): LocalDateTimeParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKETING_SCHEDULE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
};

const asUtcMilliseconds = (parts: LocalDateTimeParts): number => (
  Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
);

const sameParts = (left: LocalDateTimeParts, right: LocalDateTimeParts): boolean => (
  left.year === right.year
  && left.month === right.month
  && left.day === right.day
  && left.hour === right.hour
  && left.minute === right.minute
);

export const parsePacificDateTimeLocal = (value: string): string => {
  const requested = parseLocalDateTimeParts(value);
  const wallClockAsUtc = asUtcMilliseconds(requested);
  const firstOffset = asUtcMilliseconds(getPacificParts(new Date(wallClockAsUtc))) - wallClockAsUtc;
  let instant = wallClockAsUtc - firstOffset;
  const secondOffset = asUtcMilliseconds(getPacificParts(new Date(instant))) - instant;
  instant = wallClockAsUtc - secondOffset;
  if (!sameParts(getPacificParts(new Date(instant)), requested)) {
    throw new RangeError('That Pacific time does not exist because the clock moves forward. Choose another time.');
  }
  return new Date(instant).toISOString();
};

export const formatPacificDateTimeLocal = (value: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Stored publish time is invalid.');
  const parts = getPacificParts(date);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
};
