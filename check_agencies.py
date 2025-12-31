import asyncio
from backend.src.database import get_async_session
from backend.src.models import Agency
from sqlalchemy import select

async def check():
    async with get_async_session() as session:
        res = await session.execute(select(Agency).where(Agency.ori.like('STATE_%')))
        states = res.scalars().all()
        print(f"States found: {len(states)}")
        for s in states[:5]:
            print(f" - {s.ori}: {s.agency_name}")
            
        res = await session.execute(select(Agency).where(Agency.ori == 'NATIONAL_US'))
        national = res.scalars().all()
        print(f"National found: {len(national)}")
        for n in national:
            print(f" - {n.ori}: {n.agency_name}")

if __name__ == "__main__":
    asyncio.run(check())
