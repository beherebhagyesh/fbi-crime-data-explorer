import asyncio
import aiohttp
import json

ALL_OFFENSES = [
    'HOM', 'RPE', 'ROB', 'ASS',
    'BUR', 'LAR', 'MVT', 'ARS',
    '13B', '250', '270', '280', '290', '520', '35A'
]

async def trigger_fetch(ori):
    print(f"Triggering fetch for {ori} (All Offenses)...")
    url = "http://localhost:49000/api/crimes/fetch/" + ori
    payload = {
        "years": [2020, 2021, 2022, 2023, 2024, 2025],
        "offenses": ALL_OFFENSES
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, timeout=300) as resp:
            data = await resp.json()
            print(f"Results for {ori}: Success={data.get('success')}, Count={data.get('recordCount')}")

async def main():
    # Fetch US, AL, GA, TX, FL
    await asyncio.gather(
        trigger_fetch("NATIONAL_US"),
        trigger_fetch("STATE_AL"),
        trigger_fetch("STATE_GA"),
        trigger_fetch("STATE_TX"),
        trigger_fetch("STATE_FL")
    )

if __name__ == "__main__":
    asyncio.run(main())
