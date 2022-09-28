import {spawn} from 'child_process';

export class ProcessErrorClass extends Error {
    constructor(code: number, public stdout: string, public stderr: string) {
        super(`Process returned failure result: ${code} - ${(stderr || stdout)?.substring(0, 50)}...`);
        (<any>Object).setPrototypeOf?.(this, new.target.prototype);
    }
}

interface processOpts {
    stdoutEncoding?: BufferEncoding;
    stderrEncoding?: BufferEncoding;
}

export default function processExec(command:string, args?: string[], stdinVal?: string | Buffer, opts: processOpts = {}) {
    // console.log("processExec:", command, args, stdinText);
    return new Promise<string>((resolve, reject) => {
        let cmd = spawn(command, args, {
          env: process.env, // preserve environment
        });
        if (opts.stdoutEncoding) cmd.stdout.setEncoding(opts.stdoutEncoding);
        if (opts.stderrEncoding) cmd.stderr.setEncoding(opts.stderrEncoding);
        let stdout = "";
        let stderr = "";

        cmd.stdout.on('data', function (data: string | Buffer) {
            try {
                stdout += data;
            } catch(e) {
                console.error(`Failed to append from stdout when executing: ${command}`, args);
                console.error(`    stdout (length=${stdout.length}) += ${data}`);
            }
        });

        cmd.stderr.on('data', function (data: string | Buffer) {
            try {
                stderr += data;
            } catch(e) {
                console.error(`Failed to append from stderr when executing: ${command}`, args);
                console.error(`    stderr (length=${stderr.length}) += ${data}`);
            }
        });

        cmd.on('exit', function (code: number) {
            if (code === 0) {
                resolve(stdout);
            } else {
                console.warn("Non-zero exit code on process:", command, args, stdout, stderr);
                reject(new ProcessErrorClass(code, stdout, stderr));
            }
        });

        if (stdinVal) {
            cmd.stdin.write(stdinVal);
            cmd.stdin.end();
        }
    });
}
