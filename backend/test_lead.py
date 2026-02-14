import requests
import sys

def test():
    try:
        print("1. Checking health...", flush=True)
        r = requests.get("http://localhost:8000/health", timeout=5)
        print(f"Health: {r.status_code} {r.text}", flush=True)
        
        print("\n2. Sending public lead...", flush=True)
        payload = {
            "name": "Test Debug",
            "email": "debug_hang@test.com",
            "phone": "1234567890",
            "message": "Debugging hang issue"
        }
        r = requests.post("http://localhost:8000/api/v1/public/contacts", json=payload, timeout=10)
        print(f"Response: {r.status_code} {r.text}", flush=True)
        
    except Exception as e:
        print(f"\nERROR: {e}", flush=True)

if __name__ == "__main__":
    test()
