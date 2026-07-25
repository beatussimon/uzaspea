from vapid import Vapid
v = Vapid()
v.generate_keys()
import base64
print("PRIVATE:", v.private_pem().decode('utf-8'))
print("PUBLIC:", v.public_key_b64)
