import requests, json
res = requests.get('http://localhost:8000/api/categories/')
print(res.json())
