
import exec from './processExec';
import which from 'which';

let pbmBin = process.env.PBM_BIN || '';

// <none>/<gzip>/<snappy>/<lz4>/<s2>/<pgzip>/<zstd>
export type PBMCompressionType = 'none' | 'gzip' | 'snappy' | 'lz4' | 's2' | 'pgzip' | 'zstd';

export interface PBMCommandOptions {
  'mongodb-uri'?: string;
}
export interface PBMBackupOptions extends PBMCommandOptions {
  compression?: PBMCompressionType;
  type?: 'logical' | 'physical';
  'compression-level'?: number;
}

export interface PBMDeleteBackupBaseOptions extends PBMCommandOptions {
  force?: true;
}
export interface PBMDeleteBackupAllOptions extends PBMDeleteBackupBaseOptions {
  all: true;
};
export interface PBMDeleteBackupByNameOptions extends PBMDeleteBackupBaseOptions {
  name: string;
};
export interface PBMDeleteBackupBeforeDateOptions extends PBMDeleteBackupBaseOptions {
  'older-than': Date;
}

export type PBMDeleteBackupOptions = PBMDeleteBackupByNameOptions | PBMDeleteBackupBeforeDateOptions;
export type PBMDeletePITROptions = PBMDeleteBackupAllOptions | PBMDeleteBackupBeforeDateOptions;
export interface PBMLogEntry {
  ts: number;
  s: number;
  rs: string;
  node: string;
  e: string;
  eobj: string;
  ep: {
    T: number;
    I: number;
  };
  msg: string;
}
export interface PBMVersion {
  Version: string;
  Platform: string;
  GitCommit: string;
  BuildTime: string;
  GitBranch: string;
  GoVersion: string;
};
export interface PBMSnapshot {
  name: string;
  status: string;
  completeTS: number;
  completeDate: Date;
  pbmVersion: string;
  type: string;
};
function processSnapshot(snapshot: PBMSnapshot): PBMSnapshot {
  if (snapshot.completeTS) {
    snapshot.completeDate = new Date(snapshot.completeTS * 1000);
  }
  return snapshot;
}
export interface PBMPITRRange {
  range: {
    start: number;
    startDate: Date;
    end: number;
    endDate: Date;
  };
};
function processPITRRange(range: PBMPITRRange): PBMPITRRange {
  const { start, end } = range.range;
  return {range: {
    start,
    startDate: new Date(start * 1000),
    end,
    endDate: new Date(end * 1000),
  }};
}
export interface PBMList {
  snapshots: PBMSnapshot[];
  pitr: {
    on: boolean;
    ranges: PBMPITRRange[];
  }
}
export interface PBMResponse {
  msg: string;
}

async function _getBinPath(name: string) {
  if (pbmBin) { return pbmBin; }
  pbmBin = await which(name);
  return pbmBin;
}

const specialKeys = ['name'];
function prepareOptions<T extends PBMCommandOptions>(opts: T): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(opts)) {
    if (specialKeys.includes(key)) continue;
    if (value === true) {
      args.push(`--${key}`);
    } else {
      args.push(`--${key}`, String(value));
    }
  }

  if (opts['name']) {
    args.push(opts['name']);
  }
  return args;
}

export async function pbm<T extends Record<string, any>>(command: string, ...args: string[]) {
  const bin = await _getBinPath('pbm');
  const json = await exec(bin, [
    '-o', 'json',
    command,
    ...args,
  ]);

  const obj = JSON.parse(json);
  return obj as T;
}

export async function version() {
  return pbm<PBMVersion>('version');
}

export async function list(opts: PBMCommandOptions = {}) {
  const args = prepareOptions(opts);
  const list = await pbm<PBMList>('list', ...args);

  list.pitr.ranges = list.pitr.ranges.map(processPITRRange);
  list.snapshots = list.snapshots.map(processSnapshot);
  return list;
}

export async function logs(opts: PBMCommandOptions = {}) {
  const args = prepareOptions(opts);
  return pbm<PBMLogEntry[]>('logs', ...args);
}

export async function cancelBackup(opts: PBMCommandOptions = {}) {
  const args = prepareOptions(opts);
  return pbm<PBMResponse>('cancel-backup', ...args);
}

export async function backup(opts: PBMBackupOptions = {}) {
  const args = prepareOptions(opts);
  return pbm<PBMResponse>('backup', ...args);
}

export async function deleteBackup(opts: PBMDeleteBackupOptions) {
  const args = prepareOptions(opts);

  return pbm<PBMResponse>('delete-backup', ...args);
}

export async function deletePITR(opts: PBMDeleteBackupBeforeDateOptions) {
  const args = prepareOptions(opts);

  return pbm<PBMResponse>('delete-pitr', ...args);
}

export interface PBMClusterNodeStatus {
  host: string;
  agent: string;
  ok: boolean;
}
export interface PBMClusterStatus {
  rs: string;
  nodes: PBMClusterNodeStatus[];
}
export interface PBMStatus {
  running: any;
  pitr: {
    conf: boolean;
    run: boolean;
  };
  cluster: PBMClusterStatus;
  backups: {
    type: string;
    path: string;
    region: string;
    snapshot: PBMSnapshot[];
    pitrChunks: {
      pitrChunks: PBMPITRRange[];
      size: number;
    }
  };
}

export async function status(opts: PBMCommandOptions = {}) {
  const args = prepareOptions(opts);
  return pbm<PBMStatus>('status', ...args);
}