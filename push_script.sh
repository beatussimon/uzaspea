#!/bin/bash
ssh-agent -s > /tmp/agent.env
source /tmp/agent.env
export SSH_ASKPASS=/home/bea/uzaspea/askpass.sh
export DISPLAY=:0
chmod +x /home/bea/uzaspea/askpass.sh
setsid ssh-add /home/bea/.ssh/id_ed25519 < /dev/null
cd /home/bea/uzaspea
git fetch origin master
git push origin master -f
git push origin --tags

