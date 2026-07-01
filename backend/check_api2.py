import requests, json
res = requests.post('http://localhost:8000/api/token/', data={'username': 'halima', 'password': 'password123'})
token = res.json().get('access')
res2 = requests.get('http://localhost:8000/api/orders/', headers={'Authorization': f'Bearer {token}'})
data = res2.json()
order48 = next(o for o in data['results'] if o['id'] == 48)
print(json.dumps({'has_vehicles': order48.get('has_vehicles')}))
