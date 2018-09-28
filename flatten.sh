#!/usr/bin/env bash
#
# Flattens contracts for etherscan verification
#

set -eu
set -o pipefail

TARGET_SUBDIR='build/flattened'

BIN_DIR="$(cd $(dirname $0) && pwd)"
cd "$BIN_DIR"


rm -rf "$TARGET_SUBDIR"
mkdir -p "$TARGET_SUBDIR"

for F in contracts/*.sol contracts/crowdsale/FundsRegistry.sol contracts/minter-service/ReenterableMinter.sol;
do
    ./node_modules/.bin/truffle-flattener "$F" > "$TARGET_SUBDIR/$(basename "$F")"
done
