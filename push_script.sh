#!/bin/bash
ssh-agent -s > /tmp/agent.env
source /tmp/agent.env
chmod +x /home/bea/uzaspea/add_key.exp
/home/bea/uzaspea/add_key.exp
cd /home/bea/uzaspea
git remote set-url origin git@github.com:beatussimon/uzaspea.git
git push origin --force --all
git push origin --force --tags
