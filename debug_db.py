from sqlalchemy import select
from backend.src.database import get_async_session
from backend.src.models import RawResponse
import asyncio

async def debug():
    async with get_async_session() as session:
        for ori in ["NATIONAL_US", "STATE_AL", "STATE_TX", "STATE_FL"]:
            print(f"\n--- {ori} ---")
            stmt = select(RawResponse).where(RawResponse.ori == ori).order_by(RawResponse.year.desc(), RawResponse.offense)
            res = await session.execute(stmt)
            rows = res.scalars().all()
            if not rows:
                print(f"No data found for {ori}")
            for r in rows[:15]:
                print(f"Year {r.year}, Offense {r.offense}, Count: {r.actual_count}, Clearances: {r.clearance_count}")

if __name__ == "__main__":
    asyncio.run(debug())
