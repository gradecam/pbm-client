
// import {DateTime} from 'luxon/src/datetime';
// import {Interval} from 'luxon/src/interval';

import { DateTime, Interval } from 'luxon';

import uniq from 'lodash/uniq';

interface toKeepConfig<K extends string> {
  dateField: K;
  years: number;
  months: number;
  weeks: number;
  days: number;
}

// Assumption: records is a sorted array from oldest to newest
export function whichToKeep<K extends string, RecordType extends Record<K, Date>>(config: toKeepConfig<K>, records: RecordType[]) {
  const now = new Date();
  const years: Record<string, RecordType> = {};
  const yearEntries: RecordType[] = [];
  const months: Record<string, RecordType> = {};
  const monthEntries: RecordType[] = [];
  const weeks: Record<string, RecordType> = {};
  const weekEntries: RecordType[] = [];
  const days: Record<string, RecordType> = {};
  const dayEntries: RecordType[] = [];

  const f = config.dateField;
  for (const record of records) {
    const dt = record[f];
    const duration = Interval.fromDateTimes(DateTime.fromJSDate(dt), DateTime.fromJSDate(now));
    const year = Math.floor(duration.length('years'));
    const month = Math.floor(duration.length('months'));
    const week = Math.floor(duration.length('weeks'));
    const day = Math.floor(duration.length('days'));
    
    // console.log(`year: ${year}, month: ${month}, week: ${week}, day: ${day}`);

    if (!(year in years)) {
      years[year] = record;
      yearEntries.push(record);
    }
    if (!(month in months)) {
      months[month] = record;
      monthEntries.push(record);
    }
    if (!(week in weeks)) {
      weeks[week] = record;
      weekEntries.push(record);
    }
    if (!(day in days)) {
      days[day] = record;
      dayEntries.push(record);
    }
  }

  // We keep the newest _n_ records from each group, where _n_ is the
  // number of records we want to keep for that group specified in the config
  // -- we add 1 because if we keep "2 years" that means to keep the previous two years,
  // which means we always need to keep the oldest one in the last year as well, etc etc
  const toKeep: RecordType[] = uniq([
    ...yearEntries.slice(-(config.years + 1)),
    ...monthEntries.slice(-(config.months + 1)),
    ...weekEntries.slice(-(config.weeks + 1)),
    ...dayEntries.slice(-(config.days + 1)),
  ]);

  return toKeep.sort((a, b) => {
    return a[f].getTime() - b[f].getTime();
  });
}