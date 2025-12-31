"""
Elasticsearch loader.
Bulk indexes county data for fast search and analytics.
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk

from backend.config.settings import get_settings
from backend.src.database import get_async_session
from backend.src.models import County, CountyCrimeStat
from backend.src.analytics import Analytics
from backend.config.offenses import OFFENSE_CODES, EXTRACTION_YEARS
from sqlalchemy import select


logger = logging.getLogger(__name__)


# Elasticsearch index mapping
ES_MAPPING = {
    "mappings": {
        "properties": {
            "county_id": {"type": "keyword"},
            "county_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            "state_abbr": {"type": "keyword"},
            "agencies_total": {"type": "integer"},
            "crimes": {
                "type": "nested",
                "properties": {
                    "offense": {"type": "keyword"},
                    "counts": {
                        "properties": {
                            "2020": {"type": "integer"},
                            "2021": {"type": "integer"},
                            "2022": {"type": "integer"},
                            "2023": {"type": "integer"},
                            "2024": {"type": "integer"},
                        }
                    },
                    "analytics": {
                        "properties": {
                            "trend": {"type": "keyword"},
                            "cagr": {"type": "float"},
                            "volatility": {"type": "keyword"},
                            "predicted_2025": {"type": "integer"},
                            "is_anomaly": {"type": "boolean"},
                        }
                    },
                    "reporting_pct": {"type": "float"},
                }
            },
            "overall_trend": {"type": "keyword"},
            "last_updated": {"type": "date"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    }
}


class ElasticsearchLoader:
    """
    Loads aggregated data into Elasticsearch.
    Supports bulk indexing for efficiency.
    """
    
    def __init__(self, es_url: Optional[str] = None):
        settings = get_settings()
        self.es_url = es_url or settings.elasticsearch.url
        self.index_name = settings.elasticsearch.index_name
        self.batch_size = settings.elasticsearch.batch_size
        self._client: Optional[AsyncElasticsearch] = None
        self.analytics = Analytics()
    
    async def connect(self) -> None:
        """Initialize Elasticsearch connection."""
        if self._client is None:
            self._client = AsyncElasticsearch([self.es_url])
    
    async def close(self) -> None:
        """Close connection."""
        if self._client:
            await self._client.close()
            self._client = None
    
    async def ensure_index(self) -> None:
        """Create index if it doesn't exist."""
        await self.connect()
        
        if not await self._client.indices.exists(index=self.index_name):
            await self._client.indices.create(
                index=self.index_name,
                body=ES_MAPPING,
            )
            logger.info(f"Created index: {self.index_name}")
    
    async def build_county_document(self, county: County) -> Dict[str, Any]:
        """Build Elasticsearch document for a county."""
        crimes = []
        
        for offense in OFFENSE_CODES:
            # Get trend analysis
            try:
                analysis = await self.analytics.analyze_county_offense(
                    county.county_id,
                    offense,
                )
                
                crime_data = {
                    "offense": offense,
                    "counts": analysis.counts,
                    "analytics": {
                        "trend": analysis.trend.value,
                        "cagr": analysis.cagr,
                        "volatility": analysis.volatility.value,
                        "predicted_2025": analysis.predicted_next,
                        "is_anomaly": analysis.is_anomaly,
                    },
                    "reporting_pct": None,  # Will be filled from stats
                }
                crimes.append(crime_data)
            except Exception as e:
                logger.warning(f"Error analyzing {county.county_id}/{offense}: {e}")
        
        return {
            "_index": self.index_name,
            "_id": county.county_id,
            "_source": {
                "county_id": county.county_id,
                "county_name": county.county_name,
                "state_abbr": county.state_abbr,
                "agencies_total": county.agency_count,
                "crimes": crimes,
                "last_updated": datetime.utcnow().isoformat(),
            }
        }
    
    async def index_county(self, county: County) -> bool:
        """Index a single county."""
        await self.connect()
        
        try:
            doc = await self.build_county_document(county)
            await self._client.index(
                index=self.index_name,
                id=doc["_id"],
                body=doc["_source"],
            )
            return True
        except Exception as e:
            logger.error(f"Error indexing {county.county_id}: {e}")
            return False
    
    async def bulk_index(self, counties: List[County]) -> Dict[str, int]:
        """Bulk index multiple counties."""
        await self.connect()
        await self.ensure_index()
        
        docs = []
        for county in counties:
            try:
                doc = await self.build_county_document(county)
                docs.append(doc)
            except Exception as e:
                logger.error(f"Error building doc for {county.county_id}: {e}")
        
        if not docs:
            return {"indexed": 0, "errors": 0}
        
        # Bulk index
        success, errors = await async_bulk(
            self._client,
            docs,
            raise_on_error=False,
            stats_only=True,
        )
        
        logger.info(f"Bulk indexed: {success} success, {errors} errors")
        return {"indexed": success, "errors": errors}
    
    async def index_all_counties(self) -> Dict[str, int]:
        """Index all counties from database."""
        async with get_async_session() as session:
            query = select(County)
            result = await session.execute(query)
            counties = result.scalars().all()
        
        logger.info(f"Indexing {len(counties)} counties...")
        
        total_indexed = 0
        total_errors = 0
        
        # Process in batches
        for i in range(0, len(counties), self.batch_size):
            batch = counties[i:i + self.batch_size]
            stats = await self.bulk_index(batch)
            total_indexed += stats["indexed"]
            total_errors += stats["errors"]
            logger.info(f"Progress: {i + len(batch)}/{len(counties)}")
        
        return {"indexed": total_indexed, "errors": total_errors}
    
    async def search(self, query: Dict[str, Any]) -> List[Dict]:
        """Execute search query."""
        await self.connect()
        
        response = await self._client.search(
            index=self.index_name,
            body=query,
        )
        
        return [hit["_source"] for hit in response["hits"]["hits"]]
    
    async def get_top_yoy_changes(
        self,
        offense: str,
        limit: int = 10,
        direction: str = "desc",
    ) -> List[Dict]:
        """Get counties with highest/lowest YoY changes."""
        query = {
            "size": limit,
            "query": {
                "nested": {
                    "path": "crimes",
                    "query": {
                        "term": {"crimes.offense": offense}
                    }
                }
            },
            "sort": [
                {
                    "crimes.analytics.cagr": {
                        "order": direction,
                        "nested": {
                            "path": "crimes",
                            "filter": {"term": {"crimes.offense": offense}}
                        }
                    }
                }
            ]
        }
        
        return await self.search(query)
