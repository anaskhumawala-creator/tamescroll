#!/usr/bin/env bash
# OVERNIGHT QUEUE -- SERIAL, ON PURPOSE.
#
# Five benches were run in parallel earlier tonight and every one of them
# crawled: tfjs is on the pure-JS CPU backend (no tfjs-node), so each is
# already CPU-bound, and running them together only divides the same cores
# more ways. Serial finishes the first result sooner and every result
# sooner on average.
#
# Each step writes its own log so a crash in one cannot take the others'
# output with it, and every bench banks its rows to disk before printing,
# so a killed run still leaves scoreable data.
#
# ORDER IS BY WHAT DECIDES SOMETHING, not by what is quick:
#   1 grey-corpus     does grey survive on HIS footage. Decides whether
#                     finding 36 is shippable at all. Everything else is
#                     academic if this loses.
#   2 grey-variants   which grey. Carries the one real hypothesis (blue
#                     channel carries least skin tone).
#   3 faceres-size    the largest cheap PERFORMANCE lever left.
#   4 detect-precision the other half of his random-blur-marks complaint:
#                     finding 35 could only measure crops the detector
#                     already reported. This asks how often it reports
#                     something that is not a face at all.
set -u
cd "$(dirname "$0")/.."
LOG=/z/Apps/Disconnect/.overnight
mkdir -p "$LOG"
run() {
  local name="$1"; shift
  echo "[$(date +%H:%M:%S)] START $name" >> "$LOG/queue.log"
  "$@" > "$LOG/$name.log" 2>&1
  echo "[$(date +%H:%M:%S)] DONE  $name exit=$?" >> "$LOG/queue.log"
}
run grey-corpus      env GC_LIMIT=0            node bench/grey-corpus.mjs
run grey-variants    env GV_PER=15             node bench/grey-variants.mjs
run faceres-size     env FI_PER=10             node bench/faceres-input-size.mjs
echo "[$(date +%H:%M:%S)] QUEUE EMPTY" >> "$LOG/queue.log"
