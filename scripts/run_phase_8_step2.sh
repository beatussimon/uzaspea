#!/usr/bin/env bash
set -euo pipefail
DATA_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"
ssh -n -o StrictHostKeyChecking=no -i "$DATA_KEY" ubuntu@13.235.198.184 '
  set -euo pipefail
  sudo mkdir -p /home/ubuntu/uzaspea/certs/postgres
  if [ ! -f /home/ubuntu/uzaspea/certs/postgres/server.key ]; then
    sudo openssl req -new -x509 -days 3650 -nodes \
      -out /home/ubuntu/uzaspea/certs/postgres/server.crt \
      -keyout /home/ubuntu/uzaspea/certs/postgres/server.key \
      -subj "/CN=uzaspea-postgres" \
      -addext "subjectAltName=IP:172.26.1.218,DNS:db,DNS:localhost"
  fi
  sudo chown 70:70 /home/ubuntu/uzaspea/certs/postgres/server.key /home/ubuntu/uzaspea/certs/postgres/server.crt
  sudo chmod 600 /home/ubuntu/uzaspea/certs/postgres/server.key
  sudo chmod 644 /home/ubuntu/uzaspea/certs/postgres/server.crt
  echo "STEP_8_2_PG_TLS_CERT_OK"
'
