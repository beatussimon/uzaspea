#!/bin/bash
set -e
KEY=/home/bea/uzaspea/sensitive/LightsailDefaultKey-ap-south-1.pem
SERVER=ubuntu@3.6.193.212

cat > /tmp/remote_test.sh << 'REOF'
cd /home/ubuntu/uzaspea
TOKEN=$(docker compose -f docker-compose.prod.yml exec -T backend python manage.py shell -c 'from rest_framework_simplejwt.tokens import RefreshToken; from django.contrib.auth.models import User; user=User.objects.first(); t=RefreshToken.for_user(user); print(str(t.access_token))')
TOKEN=$(echo $TOKEN | tr -d '\r\n ')
echo TOKEN_OK
echo === Test 1: full editForm ===
docker compose -f docker-compose.prod.yml exec -T backend curl -s -X PATCH http://localhost:8000/api/profiles/admin/ -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"bio":"test","location":"Dar","phone_number":"","website":""}'
echo
echo === Test 2: bio only ===
docker compose -f docker-compose.prod.yml exec -T backend curl -s -X PATCH http://localhost:8000/api/profiles/admin/ -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"bio":"new bio"}'
echo
echo === Test 3: with phone ===
docker compose -f docker-compose.prod.yml exec -T backend curl -s -X PATCH http://localhost:8000/api/profiles/admin/ -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"phone_number":"+255123456789"}'
echo
echo === Test 4: empty phone ===
docker compose -f docker-compose.prod.yml exec -T backend curl -s -X PATCH http://localhost:8000/api/profiles/admin/ -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"phone_number":""}'
echo
REOF

scp -o StrictHostKeyChecking=no -i $KEY /tmp/remote_test.sh $SERVER:/tmp/remote_test.sh
ssh -o StrictHostKeyChecking=no -i $KEY $SERVERm«!