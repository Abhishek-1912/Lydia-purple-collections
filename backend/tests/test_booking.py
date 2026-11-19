from datetime import date, datetime, timezone

from app.booking import IST, slots_for_day, upcoming

CFG = {"call_days": "1,2,3,4,5,6", "call_start": "11:00", "call_end": "13:00", "call_slot": 30, "call_days_ahead": 7}


def test_slots_and_closed_day():
    now = datetime(2026, 11, 16, 8, 0, tzinfo=IST)            # Monday 8 am
    s = slots_for_day(date(2026, 11, 16), CFG, now, set())
    assert [x["label"] for x in s] == ["11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM"] and all(x["free"] for x in s)
    assert slots_for_day(date(2026, 11, 22), CFG, now, set()) == []   # Sunday closed


def test_taken_and_notice():
    now = datetime(2026, 11, 16, 10, 45, tzinfo=IST)          # 10:45 → 11:00 and 11:30 too soon (<1h)
    taken = {datetime(2026, 11, 16, 12, 0, tzinfo=IST).astimezone(timezone.utc).isoformat()}
    s = slots_for_day(date(2026, 11, 16), CFG, now, taken)
    assert [x["free"] for x in s] == [False, False, False, True]


def test_upcoming_window():
    days = upcoming(CFG, datetime(2026, 11, 16, 8, 0, tzinfo=IST), set())
    assert days[0]["date"] == "2026-11-16" and all(d["date"] != "2026-11-22" for d in days) and len(days) == 7


def test_video_kind():
    from app.routers.admin import video_kind
    assert video_kind(b"\x00\x00\x00\x18ftypmp42") == "mp4"
    assert video_kind(b"\x00\x00\x00\x14ftypqt  ") == "mov"
    assert video_kind(b"\x1a\x45\xdf\xa3\x01\x00") == "webm"
    assert video_kind(b"\xff\xd8\xff\xe0JFIF") is None
