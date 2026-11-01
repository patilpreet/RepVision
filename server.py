"""
Simple HTTP server to test RepVision Web locally on PC and Mobile.
Run:
    python server.py
Then open http://localhost:8000 on PC.
"""
import http.server
import socket
import socketserver
import webbrowser

PORT = 8000

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin and proper MIME types
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    local_ip = get_local_ip()
    print("=" * 65)
    print(f"RepVision Web Server running at:")
    print(f"  👉 PC Browser:     http://localhost:{PORT}")
    print(f"  👉 Mobile (Wi-Fi): http://{local_ip}:{PORT}")
    print("=" * 65)
    print("Press Ctrl+C to stop the server.")

    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        try:
            webbrowser.open(f"http://localhost:{PORT}")
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    main()
