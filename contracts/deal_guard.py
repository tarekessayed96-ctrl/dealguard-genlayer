from genlayer import *


class DealGuard(gl.Contract):
    last_title: str
    last_description: str
    last_url: str
    last_verdict: str
    last_risk_score: u32
    last_analysis: str

    def __init__(self):
        self.last_title = ""
        self.last_description = ""
        self.last_url = ""
        self.last_verdict = ""
        self.last_risk_score = 0
        self.last_analysis = ""

    @gl.public.write
    def analyze_deal(
        self,
        title: str,
        description: str,
        deal_url: str
    ) -> str:

        prompt = f"""
You are DealGuard, an AI-powered deal risk analysis system.

Analyze the following online deal.

DEAL TITLE:
{title}

DEAL DESCRIPTION:
{description}

DEAL URL:
{deal_url}

Evaluate:

1. Suspicious or unrealistic claims
2. Missing information
3. Seller or offer risks
4. Warranty and return-policy risks
5. Misleading language
6. Possible fraud indicators
7. Contradictions in the provided information

Return ONLY valid JSON:

{{
  "verdict": "SAFE",
  "risk_score": 0,
  "summary": "Short explanation",
  "reasons": [
    "reason 1",
    "reason 2",
    "reason 3"
  ]
}}

The verdict MUST be exactly one of:
SAFE
RISKY
HIGH_RISK

The risk_score MUST be an integer from 0 to 100.
"""

        result = gl.nondet.exec_prompt(prompt)

        self.last_title = title
        self.last_description = description
        self.last_url = deal_url
        self.last_verdict = result["verdict"]
        self.last_risk_score = result["risk_score"]
        self.last_analysis = str(result)

        return self.last_analysis

    @gl.public.view
    def get_last_verification(self) -> str:
        return self.last_analysis
