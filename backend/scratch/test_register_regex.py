import requests
import re

url = "http://localhost:8000/api/auth/register/"
data = {
    "username": "testuser_5",
    "email": "test5@example.com",
    "password": "TestPassword123!",
    "confirm_password": "TestPassword123!"
}
try:
    response = requests.post(url, json=data)
    print("Status:", response.status_code)
    if response.status_code == 500:
        title_match = re.search(r'<title>(.*?)</title>', response.text, re.IGNORECASE | re.DOTALL)
        exc_val_match = re.search(r'<pre class="exception_value">(.*?)</pre>', response.text, re.IGNORECASE | re.DOTALL)
        print("Title:", title_match.group(1).strip() if title_match else "No Title")
        print("Exception Value:", exc_val_match.group(1).strip() if exc_val_match else "Not found")
    else:
        print("Response:", response.text)
except Exception as e:
    print("Error:", e)
