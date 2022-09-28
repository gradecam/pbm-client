# Percona Backup for MongoDB wrapper

This tool is intended to provide a library to wrap the `pbm` binary for Percona Backup for MongoDB to assist with managing backups,
specifically to make it easier to prune old backups while keeping a reasonable retension policy.

## Debugging instructions:

To run the jest unit tests with a vscode debugger so you can examine what it is doing:

    node ./node_modules/.bin/jest --runInBand