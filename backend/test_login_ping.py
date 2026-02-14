
import requests
import sys

BASE_URL = "http://localhost:8000"

def test_login():
    email = "ronnietyagi821@gmail.com" # Taken from previous debug output
    password = "password" # Assumption, or we can try anything to see if it reaches 401 vs Timeout

    print(f"Attempting login for {email}...")
    try:
        response = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": email, "password": password}, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except requests.exceptions.Timeout:
        print("TIMEOUT: Login request timed out after 10s.")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_login()
