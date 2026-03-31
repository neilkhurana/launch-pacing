#!/usr/bin/env python3
"""
Daily Snowflake data refresh script for launch-pacing dashboard.
Updates hardcoded values in src/App.jsx.
"""

import os
import re
import sys
import tempfile
import snowflake.connector
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

def get_snowflake_conn():
    private_key_pem = os.environ["SNOWFLAKE_PRIVATE_KEY"].encode()
    private_key = serialization.load_pem_private_key(
        private_key_pem, password=None, backend=default_backend()
    )
    private_key_der = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        private_key=private_key_der,
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "CLAUDE_SNOWFLAKE_AI_WH"),
        database="DBT_ANALYTICS_PROD",
        role=os.environ.get("SNOWFLAKE_ROLE", "CLAUDE_SNOWFLAKE_AI_ROLE"),
    )

def run_query(cur, sql):
    cur.execute(sql)
    cols = [d[0].lower() for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

COHORT_HISTORY_SQL = """
WITH cw AS (
  SELECT
    DATE_TRUNC('month', S5_CLOSED_WON_DATE) AS cw_month,
    COUNT(DISTINCT OPPORTUNITY_ID) AS cw_count
  FROM DBT_ANALYTICS_PROD.ANALYTICS_GTM.FACT_GTM_FUNNEL
  WHERE S5_CLOSED_WON_FLAG = TRUE
    AND S5_CLOSED_WON_DATE >= '2025-01-01'
  GROUP BY 1
),
launches AS (
  SELECT
    DATE_TRUNC('month', ACCOUNT_MOST_RECENT_CLOSE_WON_DATE) AS cw_month,
    DATEDIFF('month',
      DATE_TRUNC('month', ACCOUNT_MOST_RECENT_CLOSE_WON_DATE),
      DATE_TRUNC('month', ACCOUNT_MOST_RECENT_GO_LIVE_DATE)
    ) AS month_offset,
    COUNT(DISTINCT LOCATION_ID) AS launches
  FROM DBT_ANALYTICS_PROD.ANALYTICS_PRODUCT.LOCATIONS
  WHERE ACCOUNT_MOST_RECENT_CLOSE_WON_DATE >= '2025-01-01'
    AND ACCOUNT_MOST_RECENT_GO_LIVE_DATE IS NOT NULL
    AND ACCOUNT_MOST_RECENT_GO_LIVE_DATE <= CURRENT_DATE()
  GROUP BY 1, 2
),
pivoted AS (
  SELECT
    cw.cw_month,
    cw.cw_count,
    SUM(CASE WHEN l.month_offset = 0 THEN l.launches ELSE 0 END) AS m0,
    SUM(CASE WHEN l.month_offset = 1 THEN l.launches ELSE 0 END) AS m1,
    SUM(CASE WHEN l.month_offset = 2 THEN l.launches ELSE 0 END) AS m2,
    SUM(CASE WHEN l.month_offset >= 3 THEN l.launches ELSE 0 END) AS m3
  FROM cw
  LEFT JOIN launches l ON cw.cw_month = l.cw_month
  GROUP BY 1, 2
)
SELECT
  cw_month,
  cw_count,
  m0,
  m1,
  m2,
  CASE WHEN DATEADD('month', 2, cw_month) <= DATE_TRUNC('month', CURRENT_DATE()) THEN m2 ELSE NULL END AS m2_final,
  m3,
  CASE WHEN DATEADD('month', 3, cw_month) <= DATE_TRUNC('month', CURRENT_DATE()) THEN m3 ELSE NULL END AS m3_final,
  m0 + m1 + m2 + m3 AS total_launched,
  cw_count - (m0 + m1 + m2 + m3) AS not_launched
FROM pivoted
ORDER BY cw_month
"""

MTD_SQL = """
SELECT
  DATE_TRUNC('month', ACCOUNT_MOST_RECENT_CLOSE_WON_DATE) AS cw_month,
  COUNT(DISTINCT LOCATION_ID) AS mtd_launches
FROM DBT_ANALYTICS_PROD.ANALYTICS_PRODUCT.LOCATIONS
WHERE ACCOUNT_MOST_RECENT_GO_LIVE_DATE >= DATE_TRUNC('month', CURRENT_DATE())
  AND ACCOUNT_MOST_RECENT_GO_LIVE_DATE <= CURRENT_DATE()
GROUP BY 1
ORDER BY 1
"""

MTD_TOTAL_SQL = """
SELECT COUNT(DISTINCT LOCATION_ID) AS total
FROM DBT_ANALYTICS_PROD.ANALYTICS_PRODUCT.LOCATIONS
WHERE ACCOUNT_MOST_RECENT_GO_LIVE_DATE >= DATE_TRUNC('month', CURRENT_DATE())
  AND ACCOUNT_MOST_RECENT_GO_LIVE_DATE <= CURRENT_DATE()
"""

def month_label(dt):
    """Convert date to label like 'Jan 25'"""
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return f"{months[dt.month - 1]} {str(dt.year)[2:]}"

def safe_rate(num, denom):
    if denom and denom > 0:
        return round(num / denom, 5)
    return 0.0

def format_rate(r):
    if r is None:
        return "null"
    return str(round(r, 5))

def main():
    print("Connecting to Snowflake...")
    conn = get_snowflake_conn()
    cur = conn.cursor()

    print("Fetching cohort history...")
    rows = run_query(cur, COHORT_HISTORY_SQL)

    print("Fetching MTD data...")
    mtd_rows = run_query(cur, MTD_SQL)
    mtd_total_row = run_query(cur, MTD_TOTAL_SQL)

    cur.close()
    conn.close()

    # Build MTD lookup
    mtd_by_month = {}
    for r in mtd_rows:
        label = month_label(r["cw_month"])
        mtd_by_month[label] = int(r["mtd_launches"] or 0)

    mtd_total = int(mtd_total_row[0]["total"] or 0)

    # Build cohort lines
    cohort_lines = []
    pre_2026_p0 = []
    pre_2026_p1 = []
    pre_2026_p2 = []
    pre_2026_p3 = []

    for r in rows:
        cw_month = r["cw_month"]
        label = month_label(cw_month)
        cw = int(r["cw_count"] or 0)
        m0 = int(r["m0"] or 0)
        m1 = int(r["m1"] or 0)
        m2 = int(r["m2"] or 0)
        m3 = int(r["m3"] or 0)
        m2_final = r["m2_final"]
        m3_final = r["m3_final"]
        nl = cw - (m0 + m1 + m2 + m3)

        p0 = safe_rate(m0, cw)
        p1 = safe_rate(m0 + m1, cw)
        p2 = safe_rate(m0 + m1 + m2, cw) if m2_final is not None else None
        p3 = safe_rate(m0 + m1 + m2 + m3, cw) if m3_final is not None else None

        year = cw_month.year
        is_pre_2026 = year < 2026

        if is_pre_2026:
            pre_2026_p0.append(p0)
            pre_2026_p1.append(p1)
            if p2 is not None:
                pre_2026_p2.append(p2)
            # p3 only if month + 3 is before current month (fully mature)
            if p3 is not None:
                pre_2026_p3.append(p3)

        p3_str = format_rate(p3)
        p2_str = format_rate(p2)

        cohort_lines.append(
            f'  {{ c: "{label}", cw: {cw}, m0: {m0}, m1: {m1}, m2: {m2}, m3: {m3}, '
            f'nl: {max(nl, 0)},  '
            f'p0: {round(p0, 3)}, p1: {round(p1, 3)}, '
            f'p2: {p2_str if p2 is not None else "null"}, '
            f'p3: {p3_str if p3 is not None else "null"} }},'
        )

    # Compute averages
    avg_p0 = round(sum(pre_2026_p0) / len(pre_2026_p0), 5) if pre_2026_p0 else 0
    avg_p1 = round(sum(pre_2026_p1) / len(pre_2026_p1), 5) if pre_2026_p1 else 0
    avg_p2 = round(sum(pre_2026_p2) / len(pre_2026_p2), 5) if pre_2026_p2 else 0
    avg_p3 = round(sum(pre_2026_p3) / len(pre_2026_p3), 5) if pre_2026_p3 else 0

    print(f"Averages: p0={avg_p0}, p1={avg_p1}, p2={avg_p2}, p3={avg_p3}")

    # Extract current rates from most recent cohorts
    def find_row(label):
        for r in rows:
            if month_label(r["cw_month"]) == label:
                return r
        return None

    dec_row = find_row("Dec 25")
    jan_row = find_row("Jan 26")
    feb_row = find_row("Feb 26")
    mar_row = find_row("Mar 26")

    def cur_rate(r, milestone):
        if not r:
            return 0.0
        cw = int(r["cw_count"] or 0)
        if cw == 0:
            return 0.0
        m0 = int(r["m0"] or 0)
        m1 = int(r["m1"] or 0)
        m2 = int(r["m2"] or 0)
        m3 = int(r["m3"] or 0)
        launched = {0: m0, 1: m0+m1, 2: m0+m1+m2, 3: m0+m1+m2+m3}.get(milestone, 0)
        return round(launched / cw, 5)

    dec_m3 = cur_rate(dec_row, 3)
    jan_m2 = cur_rate(jan_row, 2)
    feb_m1 = cur_rate(feb_row, 1)
    mar_m0 = cur_rate(mar_row, 0) if mar_row else 0.0

    # PREV rates (end-of-prev-month baselines for March model)
    # Dec = M2 rate (through Feb), Jan = M1 rate (through Feb), Feb = M0 rate (through Feb), Mar = 0
    prev_pre_jan = cur_rate(dec_row, 2)   # Dec through M2
    prev_jan = cur_rate(jan_row, 1)       # Jan through M1
    prev_feb = cur_rate(feb_row, 0)       # Feb through M0
    prev_mar = 0.0

    # CW counts
    fixed_pre_jan = int(dec_row["cw_count"]) if dec_row else 831
    fixed_jan = int(jan_row["cw_count"]) if jan_row else 810
    fixed_feb = int(feb_row["cw_count"]) if feb_row else 839

    # MTD values
    mtd_pre_jan = mtd_by_month.get("Dec 25", 0)
    mtd_jan = mtd_by_month.get("Jan 26", 0)
    mtd_feb = mtd_by_month.get("Feb 26", 0)
    mtd_mar = mtd_by_month.get("Mar 26", 0)

    # Pre-Dec '25 launches this month
    model_cohort_mtd = mtd_pre_jan + mtd_jan + mtd_feb + mtd_mar
    extra = mtd_total - model_cohort_mtd
    mtd_total_comment = f"// includes {extra} from pre-Dec '25 cohorts"

    print(f"MTD: preJan={mtd_pre_jan}, jan={mtd_jan}, feb={mtd_feb}, mar={mtd_mar}, total={mtd_total}")

    # Read App.jsx
    app_path = os.path.join(os.path.dirname(__file__), "..", "src", "App.jsx")
    with open(app_path, "r") as f:
        content = f.read()

    # Replace cohortHistorical array
    cohort_block = "const cohortHistorical = [\n" + "\n".join(cohort_lines) + "\n];"
    content = re.sub(
        r"const cohortHistorical = \[[\s\S]*?\];",
        cohort_block,
        content
    )

    # Replace AVG
    avg_line = f"const AVG = {{ p0: {avg_p0}, p1: {avg_p1}, p2: {avg_p2}, p3: {avg_p3} }};"
    content = re.sub(r"const AVG = \{[^}]+\};", avg_line, content)

    # Replace CUR
    cur_line = f"const CUR = {{ decM3: {dec_m3}, janM2: {jan_m2}, febM1: {feb_m1}, marM0: {mar_m0} }};"
    content = re.sub(r"const CUR = \{[^}]+\};", cur_line, content)

    # Replace MTD
    mtd_line = f"const MTD  = {{ preJan: {mtd_pre_jan}, jan: {mtd_jan}, feb: {mtd_feb}, mar: {mtd_mar} }};"
    content = re.sub(r"const MTD\s+=\s+\{[^}]+\};", mtd_line, content)

    # Replace MTD_TOTAL
    mtd_total_line = f"const MTD_TOTAL = {mtd_total}; {mtd_total_comment}"
    content = re.sub(r"const MTD_TOTAL = \d+;.*", mtd_total_line, content)

    # Replace PREV
    prev_line = f"const PREV = {{ preJan: {prev_pre_jan}, jan: {prev_jan}, feb: {prev_feb}, mar: {prev_mar} }};"
    content = re.sub(r"const PREV = \{[^}]+\};", prev_line, content)

    # Replace FIXED
    fixed_line = f"const FIXED = {{ preJan: {fixed_pre_jan}, jan: {fixed_jan}, feb: {fixed_feb} }};"
    content = re.sub(r"const FIXED = \{[^}]+\};", fixed_line, content)

    with open(app_path, "w") as f:
        f.write(content)

    print("App.jsx updated successfully.")

if __name__ == "__main__":
    main()
