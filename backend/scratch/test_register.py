import requests

url = "http://localhost:8000/api/auth/register/"
data = {
    "username": "testuser_2",
    "email": "test2@example.com",
    "password": "TestPassword123!",
    "confirm_password": "TestPassword123!"
}
try:
    response = requests.post(url, json=data)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
