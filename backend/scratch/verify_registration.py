import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.contrib.auth.models import User
from marketplace.models import UserProfile

def test_registration_signal():
    username = 'testuser_new'
    email = 'test@example.com'
    password = 'testpassword123'

    # Clean up if exists
    User.objects.filter(username=username).delete()

    print(f"Creating user: {username}")
    user = User.objects.create_user(username=username, email=email, password=password)
    
    # Check if profile exists (via signal)
    try:
        profile = user.profile
        print(f"Profile found: {profile}")
        print(f"Tier: {profile.tier}")
    except UserProfile.DoesNotExist:
        print("FAILED: Profile not found!")
    
    # Verify my logic didn't hit collision (manual check of the code I wrote)
    # The code I wrote was:
    # user = User.objects.create_user(...)
    # profile = user.profile
    # This should work fine now.

    # Cleanup
    user.delete()
    print("Test complete.")

if __name__ == "__main__":
    test_registration_signal()
