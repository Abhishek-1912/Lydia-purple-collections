"""Video-call slot maths (pure — tested). Times are India time (IST, no daylight saving)."""
from datetime import date, datetime, time, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))


def parse_hhmm(s: str, default: time) -> time:
    try:
        h, m = (int(x) for x in str(s).split(":"))
        return time(h, m)
    except Exception:
        return default


def slots_for_day(day: date, cfg: dict, now: datetime, taken: set[str]) -> list[dict]:
    """Bookable slots on `day`. cfg: call_days '1,2,..' (Mon=1), call_start/end 'HH:MM', call_slot minutes."""
    days = {int(d) for d in str(cfg.get("call_days") or "1,2,3,4,5,6").split(",") if d.strip().isdigit()}
    if day.isoweekday() not in days:
        return []
    start = parse_hhmm(cfg.get("call_start"), time(11, 0))
    end = parse_hhmm(cfg.get("call_end"), time(19, 0))
    step = max(10, int(cfg.get("call_slot") or 30))
    cur = datetime.combine(day, start, IST)
    stop = datetime.combine(day, end, IST)
    lead = now + timedelta(hours=1)          # need at least an hour's notice
    out = []
    while cur + timedelta(minutes=step) <= stop:
        iso = cur.astimezone(timezone.utc).isoformat()
        out.append({"start": iso, "label": cur.strftime("%I:%M %p").lstrip("0"),
                    "free": cur >= lead and iso not in taken})
        cur += timedelta(minutes=step)
    return out


def upcoming(cfg: dict, now: datetime, taken: set[str]) -> list[dict]:
    ahead = max(1, min(30, int(cfg.get("call_days_ahead") or 7)))
    today = now.astimezone(IST).date()
    result = []
    for i in range(ahead + 1):
        d = today + timedelta(days=i)
        s = slots_for_day(d, cfg, now, taken)
        if s:
            result.append({"date": d.isoformat(), "label": d.strftime("%a %d %b"), "slots": s})
    return result
