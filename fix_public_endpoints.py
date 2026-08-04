import glob
import re

for filepath in glob.glob('backend/**/*.py', recursive=True):
    with open(filepath, 'r') as f:
        content = f.read()
    
    changed = False
    
    # Function based views
    if '@permission_classes([permissions.AllowAny])' in content:
        new_content = re.sub(
            r'(@api_view\(.*?\)\n)(\s*)(@permission_classes\(\[permissions\.AllowAny\]\))',
            r'\1\2@authentication_classes([])\n\2\3',
            content
        )
        if new_content != content:
            content = new_content
            changed = True
    
    # Class based views
    if 'permission_classes = [permissions.AllowAny]' in content:
        new_content = re.sub(
            r'(\n\s*)(permission_classes\s*=\s*\[permissions\.AllowAny\])',
            r'\1authentication_classes = []\1\2',
            content
        )
        if new_content != content:
            content = new_content
            changed = True
            
    if changed:
        with open(filepath, 'w') as f:
            f.write(content)
        print('Updated', filepath)
