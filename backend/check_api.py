import urllib.request
try:
    with urllib.request.urlopen("http://localhost:8000/pool_assignments") as response:
       print(response.read().decode('utf-8'))
except Exception as e:
    print(e)