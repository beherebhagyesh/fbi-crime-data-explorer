"""
Analytics module.
Calculates trends, CAGR, predictions, and anomaly detection.
"""
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import statistics

from sqlalchemy import select

from backend.src.database import get_async_session
from backend.src.models import CountyCrimeStat
from backend.config.offenses import EXTRACTION_YEARS


logger = logging.getLogger(__name__)


class TrendDirection(str, Enum):
    """Trend classification."""
    INCREASING = "increasing"
    DECREASING = "decreasing"
    STABLE = "stable"
    UNKNOWN = "unknown"


class VolatilityLevel(str, Enum):
    """Volatility classification."""
    HIGH = "high"      # CV > 30%
    MEDIUM = "medium"  # CV 15-30%
    LOW = "low"        # CV < 15%
    UNKNOWN = "unknown"


@dataclass
class TrendAnalysis:
    """Complete trend analysis for a county/offense."""
    county_id: str
    offense: str
    counts: Dict[int, Optional[int]]  # year -> count
    trend: TrendDirection
    cagr: Optional[float]  # Compound Annual Growth Rate
    yoy_changes: List[Optional[float]]  # Year-over-year changes
    volatility: VolatilityLevel
    predicted_next: Optional[int]  # Linear extrapolation
    is_anomaly: bool
    anomaly_reason: Optional[str]


class Analytics:
    """
    Statistical analysis for crime data.
    """
    
    @staticmethod
    def calculate_cagr(
        start_value: int,
        end_value: int,
        years: int,
    ) -> Optional[float]:
        """
        Calculate Compound Annual Growth Rate.
        CAGR = (End/Start)^(1/years) - 1
        """
        if start_value <= 0 or end_value < 0 or years <= 0:
            return None
        
        try:
            cagr = ((end_value / start_value) ** (1 / years) - 1) * 100
            return round(cagr, 2)
        except (ZeroDivisionError, ValueError):
            return None
    
    @staticmethod
    def calculate_yoy_changes(counts: List[Optional[int]]) -> List[Optional[float]]:
        """Calculate year-over-year percentage changes."""
        changes = []
        for i in range(1, len(counts)):
            prev = counts[i - 1]
            curr = counts[i]
            
            if prev is None or curr is None:
                changes.append(None)
            elif prev == 0:
                changes.append(100.0 if curr > 0 else 0.0)
            else:
                changes.append(round((curr - prev) / prev * 100, 2))
        
        return changes
    
    @staticmethod
    def determine_trend(counts: List[Optional[int]]) -> TrendDirection:
        """Determine overall trend from counts."""
        valid_counts = [c for c in counts if c is not None]
        
        if len(valid_counts) < 2:
            return TrendDirection.UNKNOWN
        
        # Simple linear regression slope
        n = len(valid_counts)
        x_sum = sum(range(n))
        y_sum = sum(valid_counts)
        xy_sum = sum(i * c for i, c in enumerate(valid_counts))
        x2_sum = sum(i * i for i in range(n))
        
        denominator = n * x2_sum - x_sum * x_sum
        if denominator == 0:
            return TrendDirection.STABLE
        
        slope = (n * xy_sum - x_sum * y_sum) / denominator
        
        # Normalize slope by mean
        mean = statistics.mean(valid_counts)
        if mean == 0:
            return TrendDirection.STABLE
        
        normalized_slope = slope / mean * 100
        
        if normalized_slope > 5:
            return TrendDirection.INCREASING
        elif normalized_slope < -5:
            return TrendDirection.DECREASING
        else:
            return TrendDirection.STABLE
    
    @staticmethod
    def calculate_volatility(counts: List[Optional[int]]) -> VolatilityLevel:
        """Calculate volatility using coefficient of variation."""
        valid_counts = [c for c in counts if c is not None]
        
        if len(valid_counts) < 2:
            return VolatilityLevel.UNKNOWN
        
        mean = statistics.mean(valid_counts)
        if mean == 0:
            return VolatilityLevel.LOW
        
        stdev = statistics.stdev(valid_counts)
        cv = (stdev / mean) * 100
        
        if cv > 30:
            return VolatilityLevel.HIGH
        elif cv > 15:
            return VolatilityLevel.MEDIUM
        else:
            return VolatilityLevel.LOW
    
    @staticmethod
    def predict_next(counts: List[Optional[int]]) -> Optional[int]:
        """Predict next value using linear regression."""
        valid_counts = [c for c in counts if c is not None]
        
        if len(valid_counts) < 2:
            return None
        
        n = len(valid_counts)
        x_sum = sum(range(n))
        y_sum = sum(valid_counts)
        xy_sum = sum(i * c for i, c in enumerate(valid_counts))
        x2_sum = sum(i * i for i in range(n))
        
        denominator = n * x2_sum - x_sum * x_sum
        if denominator == 0:
            return valid_counts[-1]
        
        slope = (n * xy_sum - x_sum * y_sum) / denominator
        intercept = (y_sum - slope * x_sum) / n
        
        prediction = intercept + slope * n
        return max(0, int(round(prediction)))
    
    @staticmethod
    def detect_anomaly(
        yoy_changes: List[Optional[float]],
        threshold: float = 100.0,
    ) -> Tuple[bool, Optional[str]]:
        """Detect anomalous year-over-year changes."""
        for i, change in enumerate(yoy_changes):
            if change is not None and abs(change) > threshold:
                direction = "increase" if change > 0 else "decrease"
                return True, f"Anomalous {direction} of {abs(change):.1f}% in year {i + 1}"
        
        return False, None
    
    async def analyze_county_offense(
        self,
        county_id: str,
        offense: str,
        years: Optional[List[int]] = None,
    ) -> TrendAnalysis:
        """Perform complete trend analysis for a county/offense."""
        years = years or EXTRACTION_YEARS
        
        async with get_async_session() as session:
            query = select(CountyCrimeStat).where(
                CountyCrimeStat.county_id == county_id,
                CountyCrimeStat.offense == offense,
                CountyCrimeStat.year.in_(years),
            ).order_by(CountyCrimeStat.year)
            
            result = await session.execute(query)
            stats = result.scalars().all()
        
        # Build counts dict
        counts = {year: None for year in years}
        for stat in stats:
            counts[stat.year] = stat.total_count
        
        # Convert to list in order
        count_list = [counts[y] for y in sorted(years)]
        
        # Calculate metrics
        yoy_changes = self.calculate_yoy_changes(count_list)
        trend = self.determine_trend(count_list)
        volatility = self.calculate_volatility(count_list)
        predicted = self.predict_next(count_list)
        is_anomaly, anomaly_reason = self.detect_anomaly(yoy_changes)
        
        # CAGR (first to last valid)
        valid_years = [(y, c) for y, c in counts.items() if c is not None]
        cagr = None
        if len(valid_years) >= 2:
            valid_years.sort()
            start_year, start_val = valid_years[0]
            end_year, end_val = valid_years[-1]
            num_years = end_year - start_year
            cagr = self.calculate_cagr(start_val, end_val, num_years)
        
        return TrendAnalysis(
            county_id=county_id,
            offense=offense,
            counts=counts,
            trend=trend,
            cagr=cagr,
            yoy_changes=yoy_changes,
            volatility=volatility,
            predicted_next=predicted,
            is_anomaly=is_anomaly,
            anomaly_reason=anomaly_reason,
        )
