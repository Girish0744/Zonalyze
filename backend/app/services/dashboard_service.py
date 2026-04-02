from sqlalchemy.orm import Session
from app.schemas.dashboard import DashboardSummaryResponse, MonitorStatus
from app.schemas.scenario import AnalyzeScenarioRequest
from app.services.people_location_service import get_people_location_packet


def get_dashboard_summary(db: Session) -> DashboardSummaryResponse:
    default_request = AnalyzeScenarioRequest(
        selected_zone="Waterloo Region",
        selected_business_type="Coffee Shop",
        radius_km=5
    )

    people_packet = get_people_location_packet(default_request, db)

    return DashboardSummaryResponse(
        application_name="Zonalyze",
        project_phase="People/Location Module Prototype",
        selected_zone=default_request.selected_zone,
        selected_business_type=default_request.selected_business_type,
        radius_km=default_request.radius_km,
        people_location_packet=people_packet,
        competition_monitor=MonitorStatus(
            name="Competition",
            value="Competition analysis pending",
            indicator="yellow"
        ),
        revenue_monitor=MonitorStatus(
            name="Revenue",
            value="Revenue prediction pending",
            indicator="yellow"
        ),
        risk_monitor=MonitorStatus(
            name="Risk",
            value="Risk evaluation pending",
            indicator="yellow"
        )
    )


def analyze_scenario(
    request: AnalyzeScenarioRequest,
    db: Session
) -> DashboardSummaryResponse:
    people_packet = get_people_location_packet(request, db)

    if request.radius_km <= 3:
        competition_value = "Lower nearby competition coverage expected"
        competition_indicator = "green"
        revenue_value = "Moderate revenue opportunity in compact market"
        revenue_indicator = "yellow"
        risk_value = "Lower expansion risk, but smaller customer pool"
        risk_indicator = "yellow"
    elif request.radius_km <= 10:
        competition_value = "Moderate competitor presence expected"
        competition_indicator = "yellow"
        revenue_value = "Good revenue potential with wider market reach"
        revenue_indicator = "green"
        risk_value = "Balanced business risk profile"
        risk_indicator = "green"
    else:
        competition_value = "Higher competitor saturation likely"
        competition_indicator = "red"
        revenue_value = "Higher opportunity but more uncertainty"
        revenue_indicator = "yellow"
        risk_value = "Higher operational and competition risk"
        risk_indicator = "red"

    return DashboardSummaryResponse(
        application_name="Zonalyze",
        project_phase="People/Location Module Prototype",
        selected_zone=request.selected_zone,
        selected_business_type=request.selected_business_type,
        radius_km=request.radius_km,
        people_location_packet=people_packet,
        competition_monitor=MonitorStatus(
            name="Competition",
            value=competition_value,
            indicator=competition_indicator
        ),
        revenue_monitor=MonitorStatus(
            name="Revenue",
            value=revenue_value,
            indicator=revenue_indicator
        ),
        risk_monitor=MonitorStatus(
            name="Risk",
            value=risk_value,
            indicator=risk_indicator
        )
    )