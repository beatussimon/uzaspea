# assign_network_images.py
# Run this script with: python manage.py shell < assign_network_images.py

from marketplace.models import MobileNetwork

# Map network names to image filenames (update these as needed)
network_image_map = {
    'Airtel Money': 'airtel money.png',
    'Halopesa': 'halopesa_tanzania_logo.jpg',
    'M-Pesa': 'mpesa.png',
    'Mixx by Yas': 'mixx_by_yas.png',
}

for network in MobileNetwork.objects.all():
    image_filename = network_image_map.get(network.name)
    if image_filename:
        # Set the image field to the relative path under 'mobile-networks/'
        network.image = f"mobile-networks/{image_filename}"
        network.save()
        print(f"Set image for {network.name} -> {network.image}")
    else:
        print(f"No image mapping for {network.name}")
import os
import django
django.setup()
from django.core.files import File
from marketplace.models import MobileNetwork

# Map network names to image filenames (adjust as needed)
NETWORK_IMAGE_MAP = {
    'Airtel Money': 'airtel money.png',
    'Halopesa': 'halopesa_tanzania_logo.jpg',
    'M-Pesa': 'mpesa.png',
    'Mixx by Yas': 'mixx_by_yas.png',
}

MEDIA_PATH = os.path.join('media', 'mobile-networks')

def assign_images():
    for network_name, image_filename in NETWORK_IMAGE_MAP.items():
        try:
            network = MobileNetwork.objects.get(name__iexact=network_name)
            if not network.image:
                image_path = os.path.join(MEDIA_PATH, image_filename)
                print(f"Checking for file: {image_path}")
                if os.path.exists(image_path):
                    with open(image_path, 'rb') as img_file:
                        network.image.save(image_filename, File(img_file), save=True)
                    print(f"Assigned {image_filename} to {network_name}")
                else:
                    print(f"Image file not found: {image_path}")
            else:
                print(f"{network_name} already has an image: {network.image}")
        except MobileNetwork.DoesNotExist:
            print(f"MobileNetwork not found: {network_name}")

if __name__ == "__main__":
    assign_images()
