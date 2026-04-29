#!/bin/bash
set -e

echo "=== Installing Docker ==="
curl -fsSL https://get.docker.com | sudo sh

echo "=== Adding ubuntu to docker group ==="
sudo usermod -aG docker ubuntu

echo "=== Setting up Docker log rotation ==="
sudo tee /etc/docker/daemon.json > /dev/null << 'DEOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DEOF

sudo systemctl restart docker

echo "=== Installing unattended-upgrades ==="
sudo apt-get install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee /etc/apt/apt.conf.d/51myconfig

echo "=== Docker version ==="
docker --version
docker compose version

echo "=== DOCKER_DONE ==="
