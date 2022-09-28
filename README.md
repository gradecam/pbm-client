# Percona Backup for MongoDB wrapper

This tool is intended to provide a library to wrap the `pbm` binary for Percona Backup for MongoDB to assist with managing backups,
specifically to make it easier to prune old backups while keeping a reasonable retension policy.

## Debugging instructions:

To run the jest unit tests with a vscode debugger so you can examine what it is doing:

    node ./node_modules/.bin/jest --runInBand


If PITR is enabled then you can't delete a snapshot while a PITR backup exists which depends on it.
Before deleting a backup snapshot first use deletePitr with `older-than` the date of the first backup
that you are keeping after the one you want to delete. That means that you can
only use PITR in ranges that you are keeping all backups for, unfortunately.