import requests
from bs4 import BeautifulSoup

url = "http://localhost:8000/api/auth/register/"
data = {
    "username": "testuser_3",
    "email": "test3@example.com",
    "password": "TestPassword123!",
    "confirm_password": "TestPassword123!"
}
try:
    response = requests.post(url, json=data)
    print("Status:", response.status_code)
    if response.status_code == 500:
        soup = BeautifulSoup(response.text, 'html.parser')
        exception_type = soup.select_one('div.exception_type')
        exception_value = soup.select_one('pre.exception_value')
        title = soup.find('title')
        print("Title:", title.text if title else "No Title")
        print("Exception Type:", exception_type.text if exception_type else "Not found")
        print("Exception Value:", exception_value.text if exception_value else "Not found")
    else:
        print("Response:", response.text)
except Exception as e:
    print("Error:", e)
