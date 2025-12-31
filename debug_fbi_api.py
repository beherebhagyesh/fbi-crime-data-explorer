import requests
import json
from pydantic import BaseModel, Field
from typing import List, Optional

# Define models inline to match backend
class CrimeResult(BaseModel):
    actual: Optional[int] = None
    cleared: Optional[int] = None
    data_year: Optional[int] = None

class CrimeResponse(BaseModel):
    results: List[CrimeResult] = Field(default_factory=list)
    offenses: Optional[dict] = None
    
    @property
    def actual_count(self) -> Optional[int]:
        if self.offenses:
            actuals = self.offenses.get('actuals', {})
            total = 0
            found = False
            for key, val in actuals.items():
                if "Offenses" in key and isinstance(val, dict):
                     found = True
                     total += sum(v for v in val.values() if isinstance(v, (int, float)))
            if found: return int(total)
            
        if not self.results:
            return None
        return self.results[0].actual

def test_fetch():
    # User provided URL
    # TX0010000 (Anderson County, TX) - Homicide
    url = "https://cde.ucr.cjis.gov/LATEST/summarized/agency/TX0010000/HOM?from=01-2023&to=12-2023&type=counts"
    print(f"Fetching {url}...")
    
    try:
        resp = requests.get(url, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print("Response JSON:")
            print(json.dumps(data, indent=2))
            
            # value check
            try:
                parsed = CrimeResponse(**data)
                print(f"\nParsed OK. actual_count: {parsed.actual_count}")
            except Exception as e:
                print(f"\nParse Failed: {e}")
        else:
            print(f"Error: {resp.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_fetch()
