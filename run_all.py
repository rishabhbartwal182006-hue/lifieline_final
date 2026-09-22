import subprocess
import sys
import time
import os
import signal
import webbrowser

SERVICES = [
    {
        "name": "LifeLine 360 Backend (:4000)",
        "cwd": os.path.join(os.path.dirname(__file__), "medikiosk"),
        "cmd": ["node", "server.js"],
        "port": 4000
    },
    {
        "name": "Hospital Kiosk Frontend (:5173)",
        "cwd": os.path.join(os.path.dirname(__file__), "medikiosk", "public", "patientTerminal"),
        "cmd": ["cmd", "/c", "npm run dev"],
        "port": 5173
    },
    {
        "name": "Vital Vision AI Engine (:8000)",
        "cwd": os.path.join(os.path.dirname(__file__), "vital_scanner_lab"),
        "cmd": [sys.executable, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        "port": 8000
    },
    {
        "name": "NOVA Voice Assistant (:3000)",
        "cwd": os.path.join(os.path.dirname(__file__), "nova-assistant", "server"),
        "cmd": ["node", "server.js"],
        "port": 3000
    }
]

def main():
    print("=" * 72)
    print("      LIFELINE 360 — DUAL-NODE ECOSYSTEM UNIFIED RUNNER")
    print("         (Hospital MediKiosk + Home Personal Station)")
    print("=" * 72)
    processes = []

    try:
        for idx, svc in enumerate(SERVICES, 1):
            print(f" [{idx}/4] Launching {svc['name']}...")
            p = subprocess.Popen(
                svc["cmd"],
                cwd=svc["cwd"],
                shell=False
            )
            processes.append((svc["name"], p))
            time.sleep(1)

        print("\n" + "=" * 72)
        print("                 ALL 4 SERVICES ONLINE & SYNCED!")
        print("=" * 72)
        print("  PORTALS & DASHBOARDS:")
        print("   • Main Landing Portal      : http://localhost:4000/index.html (or http://192.168.137.1:4000)")
        print("   • 3-Pillar Gateway         : http://localhost:4000/landingPage.html")
        print("   • Node 1 - Hospital Kiosk  : http://localhost:5173 (or /kiosk.html)")
        print("   • Node 2 - Home Care Hub   : http://localhost:4000/home-patient")
        print("   • Doctor Command Center    : http://localhost:4000/dashboard/index.html")
        print("   • NOVA Voice Assistant     : http://localhost:3000")
        print("   • Vision AI Engine         : http://localhost:8000")
        print("")
        print("  EMBEDDED HARDWARE IOT MAPPING:")
        print("   • Node 1 Kiosk Optical Scanner: http://192.168.137.100 (vitals-cam.local)")
        print("   • Node 2 Home Station Sensor  : http://192.168.137.101 (DHT11 on GPIO 13)")
        print("   • Node 3 Kiosk Motorized Door : http://192.168.137.102 (Servo on GPIO 2)")
        print("=" * 72)
        print("\n  Opening Main Landing Portal (http://localhost:4000/index.html)...")
        print("  Press Ctrl+C at any time to shut down all servers.")
        print("=" * 72 + "\n")

        time.sleep(2)
        webbrowser.open("http://localhost:4000/landingPage.html")

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\nShutting down all LifeLine 360 services...")
        for name, p in processes:
            try:
                p.terminate()
                p.wait(timeout=2)
            except Exception:
                p.kill()
        print("All services have been stopped.\n")

if __name__ == "__main__":
    main()
