#!/bin/bash
# CRIT-1: Git History Rewrite
# Run this script ONLY with explicit owner approval.
# This script requires git-filter-repo to be installed.

echo "WARNING: This will rewrite git history to remove sensitive files."
echo "Press Ctrl+C to abort or Enter to continue."
read

# Remove common sensitive files from git history
git filter-repo --path .env --invert-paths --force
git filter-repo --path backend/db.sqlite3 --invert-paths --force
git filter-repo --path db.sqlite3 --invert-paths --force

echo "History rewritten. You must now force push to the remote repository:"
echo "git push origin --force --all"
