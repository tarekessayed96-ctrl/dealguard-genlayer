from genlayer import *


class DealGuard(gl.Contract):
    last_title: str
    last_description: str
    last_verdict: str
    last_risk_score: u32
    last_analysis: str

    def __init__(self):
        self.last_title = ""
        self.last_description = ""
        self.last_verdict = ""
        self.last_risk_score = 0
        self.last_analysis = ""

    @gl.public.write
    def analyze_deal(self, title: str, description: str) -> str:

        prompt = f"""
You are DealGuard, an AI-powered deal risk analysis system.

Analyze this deal:

Title:
{title}

Description:
{description}

Evaluate:
- suspicious or unrealistic claims
- missing information
- seller or offer risks
- warranty and return-policy risks
- misleading language
- possible fraud indicators

Return ONLY JSON in this exact structure:

{{
  "verdict": "SAFE",
  "risk_score": 0,
  "summary": "Short explanation",
  "reasons": ["reason 1", "reason 2", "reason 3"]
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
        self.last_verdict = result["verdict"]
        self.last_risk_score = result["risk_score"]
        self.last_analysis = str(result)

        return self.last_analysis

    @gl.public.view
    def get_last_verification(self) -> str:
        return self.last_analysis
