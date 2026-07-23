import urllib.request
import urllib.parse
import json
import random
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"
USERNAME = "bsans"
PASSWORD = "Test@1234"

def seed_tasks_via_api():
    print(f"Logging in as {USERNAME}...")
    
    # 1. Login to get JWT token
    login_data = json.dumps({"username": USERNAME, "password": PASSWORD}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/auth/token/", data=login_data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            token = res_data.get('access')
            if not token:
                print("Failed to get access token.")
                return
    except Exception as e:
        print(f"Login failed: {e}. Is your server running at {BASE_URL}?")
        return

    print("Login successful! Fetching assignable users...")
    
    # 2. Get Assignable Users
    req = urllib.request.Request(f"{BASE_URL}/api/staff/tasks/assignable_users/", headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req) as response:
            users = json.loads(response.read().decode())
    except Exception as e:
        print(f"Failed to fetch users: {e}")
        return

    user_ids = [u['id'] for u in users]
    
    # 3. Create Tasks
    print("Seeding tasks...")
    statuses = ['pending', 'in_progress', 'on_hold', 'completed']
    priorities = ['low', 'medium', 'high', 'urgent']
    titles = ['Review Seller Application', 'Audit Inventory Log', 'Resolve Dispute #1002', 'Approve Product Mod', 'Update Logistics Table']

    for i in range(15):
        status = random.choice(statuses)
        priority = random.choice(priorities)
        title = random.choice(titles) + f' {i+1}'
        
        assigned_to = random.choice(user_ids) if user_ids else None
        if status == 'pending' and random.random() < 0.3:
            assigned_to = None
            
        due_date = (datetime.now() + timedelta(days=random.randint(-2, 5))).strftime('%Y-%m-%dT%H:%M:%S')
        
        task_data = {
            "title": title,
            "description": f"This is an auto-generated sample task for {title}. Please ensure all guidelines are followed.",
            "status": status,
            "priority": priority,
            "due_date": due_date
        }
        
        if assigned_to:
            task_data["assigned_to"] = assigned_to

        req = urllib.request.Request(
            f"{BASE_URL}/api/staff/tasks/",
            data=json.dumps(task_data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}'
            },
            method='POST'
        )
        try:
            with urllib.request.urlopen(req) as response:
                pass # created
        except Exception as e:
            print(f"Failed to create task: {e}")
            return
            
    print("Successfully seeded 15 tasks via API! Check your frontend now.")

if __name__ == "__main__":
    seed_tasks_via_api()
