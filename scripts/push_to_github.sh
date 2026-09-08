#!/bin/bash
# Helper script to cleanly push to GitHub using the pre-configured SSH agent and expect script
set -e

cd /home/bea/uzaspea

echo "Starting ssh-agent..."
eval $(ssh-agent -s)

# Prevent terminal askpass prompt by routing through the helper
unset DISPLAY
export SSH_ASKPASS="/home/bea/.ssh/ssh-helper.sh"
export SSH_ASKPASS_REQUIRE="force"

echo "Adding SSH key..."
ssh-add ~/.ssh/id_ed25519 < /dev/null

echo "Pushing code to origin master..."
git push origin master

echo "Cleaning up..."
ssh-agent -k

echo "Push complete!"
