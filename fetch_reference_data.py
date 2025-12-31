import requests
import json
import pandas as pd

def fetch_range(label, url):
    print(f"Fetching {label}...")
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"Error {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        print(f"Exception: {e}")
        return None

def parse_actuals(data, years):
    off_dict = data.get('offenses', {})
    actuals = off_dict.get('actuals', {})
    
    # find offenses key
    target_key = next((k for k in actuals.keys() if "Offenses" in k), None)
    if not target_key: return {y: 0 for y in years}
    
    monthly = actuals[target_key]
    results = {}
    for y in years:
        total = 0
        suffix = f"-{y}"
        for k, v in monthly.items():
            if k.endswith(suffix) and isinstance(v, (int, float)):
                total += v
        results[y] = int(total)
    return results

def main():
    years = [2020, 2021, 2022, 2023, 2024]
    offenses = ["HOM", "ASS"]
    
    report = "# FBI Crime Data Preview (2020-2024)\n\n"
    report += "This report shows actual crime counts at National and State (Alabama) levels.\n\n"
    
    for off in offenses:
        report += f"## Offense: {off}\n\n"
        
        # Alabama
        al_data = fetch_range(f"Alabama {off}", f"https://cde.ucr.cjis.gov/LATEST/summarized/state/AL/{off}?from=01-2020&to=12-2024&type=counts")
        al_counts = parse_actuals(al_data, years) if al_data else {}
        
        # National
        us_data = fetch_range(f"National {off}", f"https://cde.ucr.cjis.gov/LATEST/summarized/national/{off}?from=01-2020&to=12-2024&type=counts")
        us_counts = parse_actuals(us_data, years) if us_data else {}
        
        # Table
        report += "| Year | Alabama (State) | United States (National) |\n"
        report += "|------|-----------------|--------------------------|\n"
        for y in years:
            report += f"| {y} | {al_counts.get(y, 'N/A'):,} | {us_counts.get(y, 'N/A'):,} |\n"
        report += "\n"

    with open("data_preview.md", "w") as f:
        f.write(report)
    
    print("\nReport saved to data_preview.md")

if __name__ == "__main__":
    main()
