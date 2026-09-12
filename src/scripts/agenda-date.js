const OVERNIGHT_END_MINUTES = 5 * 60;

export function getAgendaDate(date, startTime) {
  const dateKey = String(date || '');
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(startTime || ''));
  if (!dateMatch || !timeMatch) return dateKey;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const timeInMinutes = hour * 60 + minute;
  if (hour > 23 || minute > 59 || timeInMinutes > OVERNIGHT_END_MINUTES) return dateKey;

  const dateValue = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== dateKey) return dateKey;

  dateValue.setUTCDate(dateValue.getUTCDate() - 1);
  return dateValue.toISOString().slice(0, 10);
}
