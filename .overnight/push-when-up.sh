#!/bin/sh
# Push the moment the network comes back. The Office WiFi dropped
# outbound 443 mid-session with 8 commits staged; polling by hand costs
# a turn each time and this costs none.
cd /z/Apps/Disconnect || exit 1
i=0
while [ $i -lt 120 ]; do
  if git push >/z/Apps/Disconnect/.overnight/push.log 2>&1; then
    echo "PUSHED at $(date)" >> /z/Apps/Disconnect/.overnight/push.log
    exit 0
  fi
  i=$((i+1))
  sleep 30
done
echo "STILL DOWN after 60 minutes" >> /z/Apps/Disconnect/.overnight/push.log
exit 1
