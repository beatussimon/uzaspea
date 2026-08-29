#!/bin/bash
# Check local postgres for data
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
  -i ~/.ssh/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.193.212 \
  'docker exec uzaspea-postgres psql -U postgres -d uzaspea -c "SELECT count(*) FROM pg_tables WHERE schemaname = '"'"'public'"'"';"'
