#!/usr/bin/env node

// Default retension policy -- override it using the environment variables:
//   PBM_RETENTION_DAYS - how many days to keep
//   PBM_RETENTION_WEEKS - how many weeks to keep
//   PBM_RETENTION_MONTHS - how many months to keep
//   PBM_RETENTION_YEARS - how many years to keep

const defaultKeepDays = process.env.PBM_KEEP_DAYS ? parseInt(process.env.PBM_KEEP_DAYS, 10) : 7;
const defaultKeepWeeks = process.env.PBM_KEEP_WEEKS ? parseInt(process.env.PBM_KEEP_WEEKS, 10) : 5;
const defaultKeepMonths = process.env.PBM_KEEP_MONTHS ? parseInt(process.env.PBM_KEEP_MONTHS, 10) : 3;
const defaultKeepYears = process.env.PBM_KEEP_YEARS ? parseInt(process.env.PBM_KEEP_YEARS, 10) : 2;

import { Command } from 'commander';

const program = new Command();

import * as pbm from './pbm';
import { whichToKeep } from './retention';

program
  .option('-d, --days <days>', 'how many days to keep', String(defaultKeepDays))
  .option('-w, --weeks <weeks>', 'how many weeks to keep', String(defaultKeepWeeks))
  .option('-m, --months <months>', 'how many months to keep', String(defaultKeepMonths))
  .option('-y, --years <years>', 'how many years to keep', String(defaultKeepYears))
  .option('-v, --verbose', 'verbose output')
  .option('-f, --force', `Actually delete the snapshots (without this flag it is a dry run)`)
  .parse(process.argv);

const options = program.opts();

const keepDays = parseInt(options.days, 10);
const keepWeeks = parseInt(options.weeks, 10);
const keepMonths = parseInt(options.months, 10);
const keepYears = parseInt(options.years, 10);

const isVerbose = !!options.verbose;
const isDryRun = !options.force;

main().catch((err) => {
  console.error(`Unhandled error: `, err);
  process.exit(1);
});

async function main() {

  if (isVerbose) {
    // Print out the retention policy:
    console.log(`Retention policy:
  days: ${keepDays}
  weeks: ${keepWeeks}
  months: ${keepMonths}
  years: ${keepYears}`);
  }

  let curStatus: pbm.PBMStatus;
  try {
    curStatus = await pbm.status();
  } catch (err) {
    console.error(`Error getting PBM status: `, err);
    console.error(`Is the PBM_MONGODB_URI set correctly?`);
    process.exit(1);
  }

  const pendingSnapshot = curStatus.backups.snapshot.find((s) => s.status === 'running');
  if (isVerbose && pendingSnapshot) {
    console.warn("There is a current backup running. It will not be included.", pendingSnapshot);
  }

  const curList = await pbm.list();
  const snapshotList = curList.snapshots;
  snapshotList.sort((a, b) => a.restoreTo - b.restoreTo);

  const keepList = whichToKeep({
    dateField: 'restoreDate',
    days: keepDays,
    weeks: keepWeeks,
    months: keepMonths,
    years: keepYears,
  }, snapshotList);

  const toDelete = snapshotList.filter((s) => !keepList.includes(s));

  console.log(`Keeping ${keepList.length} snapshots out of ${snapshotList.length} total.`);
  if (isVerbose) {
    for (const s of keepList) {
      console.log(`  - ${s.name} ${s.restoreDate}`);
    }
  }
  console.log(`Deleting ${toDelete.length} snapshots:`);
  if (isVerbose) {
    for (const s of toDelete) {
      console.log(`  - ${s.name} / ${s.restoreDate}`);
    }
  }
  if (!toDelete.length) {
    console.log(`Nothing to do.`);
    return;
  }

  // Find the most recent snapshot that is not in the keep list:
  const mostRecentToDelete = toDelete.reduce((acc, cur) => {
    if (acc === null) { return cur; }
    if (cur.restoreTo > acc.restoreTo) { return cur; }
    return acc;
  }, null);

  // Find the next snapshot after the most recent one to delete:
  const nextSnapshot = snapshotList.find((s) => s.restoreTo > mostRecentToDelete.restoreTo);
  if (!nextSnapshot) {
    throw new Error("Could not find the next snapshot after the most recent one to delete.");
  }

  // Before we can delete any snapshots we will have to delete the PITR chunks which depend on
  // the snapshots we are deleting. We will delete all chunks older than the "nextSnapshot"
  // (which is the snapshot after the most recent one we are deleting).
  if (isVerbose) {
    console.log("Plan to delete PITR chunks older than", nextSnapshot.restoreDate);
  }

  if (!isDryRun) {

    let res = await pbm.deletePITR({force: true, "older-than": nextSnapshot.restoreDate});
    console.log("Deleted PITR chunks: ", res.split("\n").filter(Boolean)[0]);

    for (const s of toDelete) {
      try {
        console.log(`Deleting ${s.name}...`);
        res = await pbm.deleteBackup({name: s.name, force: true});
        console.log(`${res.split("\n").filter(Boolean)[0]} - Deleted ${s.name}.`);
      } catch (err) {
        console.error(`Error deleting snapshot ${s.name}: `, err);
      }
    }
  }
}
