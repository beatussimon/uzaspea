#!/usr/bin/env bash
set -euo pipefail
APP_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"

echo "=== Installing netfilter-persistent on Data Node ==="
ssh -n -o StrictHostKeyChecking=no -i "$DATA_KEY" ubuntu@13.235.198.184 '
  set -euo pipefail
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent netfilter-persistent
  sudo systemctl enable netfilter-persistent
'

echo "=== Installing netfilter-persistent & locking App Node 80/443 strictly to Cloudflare IPs ==="
ssh -o StrictHostKeyChecking=no -i "$APP_KEY" ubuntu@3.6.193.212 << 'EOF'
  set -euo pipefail
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent netfilter-persistent curl

  CF_V4="$(curl -fsSL https://www.cloudflare.com/ips-v4)"
  CF_V6="$(curl -fsSL https://www.cloudflare.com/ips-v6)"
  test -n "$CF_V4" && test -n "$CF_V6"

  sudo iptables -N DOCKER-USER 2>/dev/null || true
  sudo iptables -F DOCKER-USER
  sudo iptables -A DOCKER-USER -i lo -j RETURN
  sudo iptables -A DOCKER-USER -p tcp --dport 22 -j RETURN
  sudo iptables -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  sudo iptables -A DOCKER-USER -s 172.16.0.0/12 -j RETURN
  sudo iptables -A DOCKER-USER -s 127.0.0.1/32 -j RETURN
  for cidr in $CF_V4; do
    sudo iptables -A DOCKER-USER -p tcp -m multiport --dports 80,443 -s "$cidr" -j RETURN
  done
  sudo iptables -A DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP
  sudo iptables -A DOCKER-USER -j RETURN

  sudo ip6tables -N DOCKER-USER 2>/dev/null || true
  sudo ip6tables -F DOCKER-USER
  sudo ip6tables -A DOCKER-USER -i lo -j RETURN
  sudo ip6tables -A DOCKER-USER -p tcp --dport 22 -j RETURN
  sudo ip6tables -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  for cidr6 in $CF_V6; do
    sudo ip6tables -A DOCKER-USER -p tcp -m multiport --dports 80,443 -s "$cidr6" -j RETURN
  done
  sudo ip6tables -A DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP
  sudo ip6tables -A DOCKER-USER -j RETURN

  sudo netfilter-persistent save
  sudo systemctl enable netfilter-persistent
  echo "STEP_8_4_FIREWALL_OK"
EOF
