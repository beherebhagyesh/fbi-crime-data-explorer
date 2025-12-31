"""
Analytics API routes.
Trend analysis, predictions, and rankings.
"""
from typing import List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.src.analytics import Analytics, TrendDirection, VolatilityLevel
from backend.src.elasticsearch_loader import ElasticsearchLoader
from backend.config.offenses import OFFENSE_CODES


router = APIRouter()


class TrendResult(BaseModel):
    """Trend analysis result."""
    county_id: str
    offense: str
    trend: str
    cagr: Optional[float]
    volatility: str
    predicted_2025: Optional[int]
    is_anomaly: bool


@router.get("/trends/{county_id}")
async def get_county_trends(
    county_id: str,
    offense: Optional[str] = Query(None, description="Specific offense"),
):
    """Get trend analysis for a county."""
    analytics = Analytics()
    offenses = [offense] if offense else OFFENSE_CODES
    
    results = []
    for off in offenses:
        analysis = await analytics.analyze_county_offense(county_id, off)
        results.append({
            "offense": off,
            "counts": analysis.counts,
            "trend": analysis.trend.value,
            "cagr": analysis.cagr,
            "yoy_changes": analysis.yoy_changes,
            "volatility": analysis.volatility.value,
            "predicted_2025": analysis.predicted_next,
            "is_anomaly": analysis.is_anomaly,
            "anomaly_reason": analysis.anomaly_reason,
        })
    
    return {
        "county_id": county_id,
        "trends": results,
    }


@router.get("/top-risers")
async def get_top_risers(
    offense: str = Query(...),
    limit: int = Query(10, le=50),
):
    """Get counties with highest crime increase."""
    loader = ElasticsearchLoader()
    
    try:
        await loader.connect()
        results = await loader.get_top_yoy_changes(offense, limit, "desc")
        return {
            "offense": offense,
            "direction": "increasing",
            "counties": results,
        }
    finally:
        await loader.close()


@router.get("/top-fallers")
async def get_top_fallers(
    offense: str = Query(...),
    limit: int = Query(10, le=50),
):
    """Get counties with biggest crime decrease."""
    loader = ElasticsearchLoader()
    
    try:
        await loader.connect()
        results = await loader.get_top_yoy_changes(offense, limit, "asc")
        return {
            "offense": offense,
            "direction": "decreasing",
            "counties": results,
        }
    finally:
        await loader.close()


@router.get("/anomalies")
async def get_anomalies(
    threshold: float = Query(100.0, description="YoY change threshold %"),
    limit: int = Query(50, le=200),
):
    """Get counties with anomalous crime changes."""
    loader = ElasticsearchLoader()
    
    try:
        await loader.connect()
        
        # Search for anomalies in ES
        query = {
            "size": limit,
            "query": {
                "nested": {
                    "path": "crimes",
                    "query": {
                        "term": {"crimes.analytics.is_anomaly": True}
                    }
                }
            }
        }
        
        results = await loader.search(query)
        return {
            "threshold": threshold,
            "anomalies": results,
        }
    finally:
        await loader.close()


@router.get("/predict/{county_id}")
async def predict_county(county_id: str):
    """Get 2025 predictions for a county."""
    analytics = Analytics()
    
    predictions = {}
    for offense in OFFENSE_CODES:
        analysis = await analytics.analyze_county_offense(county_id, offense)
        predictions[offense] = {
            "predicted_2025": analysis.predicted_next,
            "trend": analysis.trend.value,
            "confidence": "high" if analysis.volatility == VolatilityLevel.LOW else (
                "medium" if analysis.volatility == VolatilityLevel.MEDIUM else "low"
            ),
        }
    
    return {
        "county_id": county_id,
        "predictions": predictions,
    }
