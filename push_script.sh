#!/bin/bash
ssh-agent -s > /tmp/agent.env
source /tmp/agent.env
export SSH_ASKPASS=/home/bea/uzaspea/askpass.sh
export DISPLAY=:0
chmod +x /home/bea/uzaspea/askpass.sh
setsid ssh-add /home/bea/.ssh/id_ed25519 < /dev/null
cd /home/bea/uzaspea
git remote set-url origin git@github.com:beatussimon/uzaspea.git
git push origin --force --all
git push origin --force --tags

