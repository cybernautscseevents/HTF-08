from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.models import AlertModel
from backend.schemas import AlertResponse

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertResponse])
def get_alerts(
    severity: Optional[str] = None,
    type: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(AlertModel)
    if severity:
        query = query.filter(AlertModel.severity.ilike(severity))
    if type:
        query = query.filter(AlertModel.type.ilike(type))
    if unread_only:
        query = query.filter(AlertModel.read == False)

    return query.order_by(AlertModel.created_at.desc()).limit(limit).all()

@router.post("/{alert_id}/read")
def mark_alert_read(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail={"code": "ALERT_NOT_FOUND", "message": f"Alert {alert_id} not found."})
    alert.read = True
    db.commit()
    return {"status": "success", "alert_id": alert_id, "read": True}
