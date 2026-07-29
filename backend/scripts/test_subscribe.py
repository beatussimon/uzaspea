import requests
try:
    res = requests.post("http://localhost:8000/api/push/subscribe/", json={"endpoint": "test", "keys": {"p256dh": "test", "auth": "test"}}, headers={"Authorization": "Bearer ..."}) # Wait, requires auth.
except Exception as e:
    print(e)
