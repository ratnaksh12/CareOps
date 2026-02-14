import socket
import sys

def check_dns(hostname):
    print(f"Checking DNS for {hostname}...")
    try:
        ip = socket.gethostbyname(hostname)
        print(f"  OK: Resolved to {ip}")
        return ip
    except socket.gaierror as e:
        print(f"  FAIL: DNS resolution failed: {e}")
        return None

def check_tcp(ip, port):
    print(f"Checking TCP connection to {ip}:{port}...")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((ip, port))
        if result == 0:
            print("  OK: Port is open")
        else:
            print(f"  FAIL: Port closed or unreachable (code {result})")
        sock.close()
    except Exception as e:
        print(f"  FAIL: Connection error: {e}")

if __name__ == "__main__":
    # Supabase Host from .env
    host = "db.hhhijdrhgnmmnqpdoaat.supabase.co"
    port = 5432
    
    ip = check_dns(host)
    if ip:
        check_tcp(ip, port)
    
    print("\nChecking Google DNS (8.8.8.8)...")
    check_tcp("8.8.8.8", 53)
