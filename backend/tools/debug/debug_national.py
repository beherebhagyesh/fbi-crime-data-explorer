import requests
import json
from pydantic import BaseModel, Field
from typing import List, Optional

def fetch_url(label, url):
    print(f"\n--- Fetching {label} ---")
    print(f"URL: {url}")
    try:
        resp = requests.get(url, timeout=15)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            # Summarize structure
            keys = list(data.keys())
            print(f"Root keys: {keys}")
            
            # Check for 'offenses' vs 'actuals' at root
            target_data = data
            if 'offenses' in data:
                print("Found 'offenses' wrapper")
                target_data = data['offenses']
            
            if 'actuals' in target_data:
                actuals = target_data['actuals']
                print(f"Actuals keys: {list(actuals.keys())}")
                for k, v in actuals.items():
                    sample_dates = list(v.keys())[:3]
                    print(f"  Key '{k}' sample dates: {sample_dates}")
                    if sample_dates:
                        print(f"  Sample value for {sample_dates[0]}: {v[sample_dates[0]]}")

    except Exception as e:
        print(f"Error: {e}")

def main():
    # 1. State Level (Texas)
    fetch_url("Texas Homicide (State)", "https://cde.ucr.cjis.gov/LATEST/summarized/state/TX/HOM?from=01-2023&to=12-2023&type=counts")
    
    # 2. National Level
    fetch_url("US Homicide (National)", "https://cde.ucr.cjis.gov/LATEST/summarized/national/HOM?from=01-2023&to=12-2023&type=counts")

if __name__ == "__main__":
    main()
