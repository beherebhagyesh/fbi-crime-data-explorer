import requests
import json

def test_fetch():
    # 1. Counts Range
    url_counts = "https://cde.ucr.cjis.gov/LATEST/summarized/agency/AL0040000/HOM?from=01-2020&to=12-2024&type=counts"
    print(f"Fetching Counts Range: {url_counts}")
    try:
        resp = requests.get(url_counts, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            # Check structure of 'actuals'
            if 'offenses' in data and 'actuals' in data['offenses']:
                actuals = data['offenses']['actuals']
                print("Actuals Keys:", actuals.keys())
                for k, v in actuals.items():
                    if "Offenses" in k and isinstance(v, dict):
                        print(f"Months found: {len(v)} keys")
                        print(f"Sample keys: {list(v.keys())[:5]} ... {list(v.keys())[-5:]}")
        else:
             print(resp.text)
    except Exception as e:
        print(e)

    # 2. Participation Range
    # /participation/agency/{ori}/{start_year}/{end_year} ??
    # Trying this format
    url_part = "https://cde.ucr.cjis.gov/LATEST/participation/agency/AL0040000/2020/2024"
    print(f"\nFetching Participation Range: {url_part}")
    try:
        resp = requests.get(url_part, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if 'results' in data:
                 print(f"Participation Results: {len(data['results'])} items")
                 if len(data['results']) > 0:
                     print(f"Sample: {data['results'][0]}")
        else:
            print(resp.text)
    except Exception as e:
        print(e)

if __name__ == "__main__":
    test_fetch()
