
require('source-map-support').install();

import { PBMPITRRange, PBMSnapshot } from './pbm';
import { whichToKeep } from './retention';
import hsData from './testData/exampleList';

function processSnapshot(snapshot: PBMSnapshot): PBMSnapshot {
  if (snapshot.restoreTo) {
    snapshot.restoreDate = new Date(snapshot.restoreTo * 1000);
  }
  return snapshot;
}
function processPITRRange(range: PBMPITRRange): PBMPITRRange {
  const { start, end } = range.range;
  return {range: {
    start,
    startDate: new Date(start * 1000),
    end,
    endDate: new Date(end * 1000),
  }};
}

hsData.pitr.ranges = hsData.pitr.ranges.map(processPITRRange);
hsData.snapshots = hsData.snapshots.map(processSnapshot);


test("hs data should exist and parse", async () => {
  expect(hsData.snapshots.length).toBeGreaterThan(1);
});

test("retension calculation should work", async () => {
  const snapshots = hsData.snapshots as PBMSnapshot[];
  const keepList = whichToKeep({
    dateField: 'restoreDate',
    days: 7,
    weeks: 3,
    months: 2,
    years: 2,
  }, snapshots);

  expect(keepList.length).toBe(16);
});
