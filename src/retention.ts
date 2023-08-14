
// import {DateTime} from 'luxon/src/datetime';
// import {Interval} from 'luxon/src/interval';

import { DateTime, Interval } from 'luxon';

import uniq from 'lodash/uniq';

interface toKeepConfig<dateField extends string, nameField extends string, parentField extends string> {
  dateField: dateField;
  nameField: nameField;
  parentField: parentField;
  years: number;
  months: number;
  weeks: number;
  days: number;
}

type KeepRecord<dateField extends string, nameField extends string, parentField extends string>
  = Record<dateField, Date> & Record<nameField, string> & Record<parentField, string>;

function isBetterEntry<dateField extends string,
  nameField extends string,
  parentField extends string,
  RecordType extends KeepRecord<dateField, nameField, parentField>>(map: Record<string, RecordType>, entry: RecordType, key: string | number, parentField: parentField) {
    
  // If there is no current entry then this is the best option so far
  if (!(key in map)) {
    return true;
  }
  // If the entry in the map has a parent and this one does not, then this is the best option so far
  if (map[key][parentField] && !entry[parentField]) {
    return true;
  }
  // Otherwise this is not a better option
  return false; 
}

// Assumption: records is a sorted array from oldest to newest
export function whichToKeep<dateField extends string,
                            nameField extends string,
                            parentField extends string,
                            RecordType extends KeepRecord<dateField, nameField, parentField>>(config: toKeepConfig<dateField, nameField, parentField>, records: RecordType[]) {
  const now = new Date();
  const years: Record<string, RecordType> = {};
  const yearEntries: RecordType[] = [];
  const months: Record<string, RecordType> = {};
  const monthEntries: RecordType[] = [];
  const weeks: Record<string, RecordType> = {};
  const weekEntries: RecordType[] = [];
  const days: Record<string, RecordType> = {};
  const dayEntries: RecordType[] = [];

  const allRecords: Record<string, RecordType> = {};

  // We first need a map of all records by name so we can check for parents
  for (const record of records) {
    allRecords[record[config.nameField]] = record;
  }

  function hasParentTree(parentName: string): boolean {
    if (!parentName) return true; // this is the top of the "tree"
    const parent = allRecords[parentName];
    return parent && hasParentTree(parent[config.parentField]);
  }

  // filter records and drop any which don't have a full parent tree (that the ultimate parent is missing)
  records = records.filter(r => hasParentTree(r[config.parentField]));

  const f = config.dateField;
  for (const record of records) {
    const dt = record[f];
    const duration = Interval.fromDateTimes(DateTime.fromJSDate(dt), DateTime.fromJSDate(now));
    const year = Math.floor(duration.length('years'));
    const month = Math.floor(duration.length('months'));
    const week = Math.floor(duration.length('weeks'));
    const day = Math.floor(duration.length('days'));
    
    if (isBetterEntry(years, record, year, config.parentField)) {
      years[year] = record;
      yearEntries.push(record);
    }
    if (isBetterEntry(months, record, month, config.parentField)) {
      months[month] = record;
      monthEntries.push(record);
    }
    if (isBetterEntry(weeks, record, week, config.parentField)) {
      weeks[week] = record;
      weekEntries.push(record);
    }
    if (isBetterEntry(days, record, day, config.parentField)) {
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

  // If any of the records we need to keep have parents then we have to keep the parents as well
  let searchAgain = true;
  while (searchAgain) {
    searchAgain = false;
    for (const record of toKeep) {
      if (record[config.parentField] && !toKeep.includes(allRecords[record[config.parentField]])) {
        toKeep.push(allRecords[record[config.parentField]]);
        searchAgain = true;
      }
    }
  }

  return toKeep.sort((a, b) => {
    return a[f].getTime() - b[f].getTime();
  });
}