#!/bin/bash
cd /home/bea/uzaspea
export PATH="$HOME/.local/bin:$PATH"

echo "Running filter-repo..."
git-filter-repo --path certs/key.pem --invert-paths --force
git-filter-repo --path certs/cert.pem --invert-paths --force
git-filter-repo --path traefik_acme.json --invert-paths --force
git-filter-repo --path backend/db.sqlite3 --invert-paths --force
git-filter-repo --path db.sqlite3 --invert-paths --force
git-filter-repo --path .env --invert-paths --force
git-filter-repo --path backend/.venv --invert-paths --force
git-filter-repo --path backend/server.log --invert-paths --force

echo "Re-adding remote..."
git remote add origin git@github.com:beatussimon/uzaspea.git

echo "Setting up SSH agent..."
eval $(ssh-agent -s)
unset DISPLAY
export SSH_ASKPASS="/home/bea/.ssh/ssh-helper.sh"
export SSH_ASKPASS_REQUIRE="force"
ssh-add ~/.ssh/id_ed25519 < /dev/null

echo "Force pushing..."
git push origin --force --all
git push origin --force --tags

ssh-agent -k
echo "Done!"
