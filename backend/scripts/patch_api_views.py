import re

file_path = '/home/bea/uzaspea/backend/marketplace/api_views.py'
with open(file_path, 'r') as f:
    content = f.read()

# Replace price calculation in pos_checkout
pattern = r"(price = variant\.final_price if variant else product\.price)"
replacement = r"""\1
                if product.requires_quote:
                    if 'price' in item_data:
                        try:
                            price = float(item_data['price'])
                        except (ValueError, TypeError):
                            return Response({'error': 'Invalid custom price provided.'}, status=status.HTTP_400_BAD_REQUEST)
                    else:
                        return Response({'error': f'Price is required for {product.name} because it requires a quote.'}, status=status.HTTP_400_BAD_REQUEST)"""

new_content = re.sub(pattern, replacement, content, count=1)

with open(file_path, 'w') as f:
    f.write(new_content)

print("Patched api_views.py")
