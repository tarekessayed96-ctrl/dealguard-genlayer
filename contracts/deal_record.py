# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class DealRecord(gl.Contract):

    deal_count: u32
    last_title: str
    last_verdict: str
    last_risk_score: u32

    def __init__(self):
        self.deal_count = 0
        self.last_title = ""
        self.last_verdict = ""
        self.last_risk_score = 0

    @gl.public.write
    def record_deal(
        self,
        title: str,
        verdict: str,
        risk_score: u32
    ) -> str:

        self.deal_count += 1
        self.last_title = title
        self.last_verdict = verdict
        self.last_risk_score = risk_score

        return "Deal recorded successfully"

    @gl.public.view
    def get_record(self) -> str:
        return (
            "Deal #" + str(self.deal_count)
            + " | Title: " + self.last_title
            + " | Verdict: " + self.last_verdict
            + " | Risk Score: " + str(self.last_risk_score)
        )
