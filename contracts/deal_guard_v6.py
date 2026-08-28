# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class DealGuardV6(gl.Contract):

    last_title: str
    last_description: str
    last_url: str
    last_source_url: str
    last_verdict: str
    last_risk_score: u32
    last_confidence: u32
    last_analysis: str
    verification_count: u32

    def __init__(self):
        self.last_title = ""
        self.last_description = ""
        self.last_url = ""
        self.last_source_url = ""
        self.last_verdict = ""
        self.last_risk_score = 0
        self.last_confidence = 0
        self.last_analysis = ""
        self.verification_count = 0

    @gl.public.write
    def analyze_deal(
        self,
        title: str,
        description: str,
        deal_url: str,
        second_source_url: str
    ) -> str:

        def analyze() -> str:

            primary_page = gl.nondet.web.get(deal_url)
            secondary_page = gl.nondet.web.get(second_source_url)

            primary_text = primary_page.body.decode("utf-8")
            secondary_text = secondary_page.body.decode("utf-8")

            prompt = f"""
You are DealGuard V6.

You are verifying an online deal using TWO independent
web sources.

DEAL TITLE:
{title}

DEAL DESCRIPTION:
{description}

PRIMARY DEAL URL:
{deal_url}

SECOND SOURCE URL:
{second_source_url}

PRIMARY SOURCE CONTENT:
{primary_text[:8000]}

SECOND SOURCE CONTENT:
{secondary_text[:8000]}

Compare the two sources.

Look for:

1. Price consistency
2. Product or service identity
3. Seller identity
4. Warranty information
5. Return policy
6. Shipping claims
7. Suspicious or unrealistic claims
8. Missing information
9. Contradictions between sources
10. Possible fraud indicators

Return ONLY valid JSON:

{{
    "verdict": "SAFE",
    "risk_score": 0,
    "confidence": 0,
    "summary": "Short explanation",
    "reasons": [
        "reason 1",
        "reason 2",
        "reason 3"
    ],
    "evidence": [
        "evidence from source 1",
        "evidence from source 2"
    ]
}}

Rules:

- verdict must be SAFE, RISKY, or HIGH_RISK
- risk_score must be an integer from 0 to 100
- confidence must be an integer from 0 to 100
- evidence must refer only to supplied webpage content
- do not invent facts
- explicitly identify contradictions when present
"""

            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json"
            )

            return json.dumps(result, sort_keys=True)

        criteria = """
The output must:

1. Be valid JSON.
2. Contain verdict, risk_score, confidence,
   summary, reasons, and evidence.
3. Use SAFE, RISKY, or HIGH_RISK.
4. Use risk_score from 0 to 100.
5. Use confidence from 0 to 100.
6. Compare both supplied webpages.
7. Identify meaningful agreements or contradictions.
8. Base claims only on supplied evidence.
"""

        result = gl.eq_principle.prompt_non_comparative(
            analyze,
            task="Compare two web sources and verify an online deal.",
            criteria=criteria
        )

        parsed = json.loads(result)

        self.last_title = title
        self.last_description = description
        self.last_url = deal_url
        self.last_source_url = second_source_url
        self.last_verdict = parsed["verdict"]
        self.last_risk_score = parsed["risk_score"]
        self.last_confidence = parsed["confidence"]
        self.last_analysis = result
        self.verification_count += 1

        return result

    @gl.public.view
    def get_last_verification(self) -> str:
        return self.last_analysis

    @gl.public.view
    def get_verification_count(self) -> u32:
        return self.verification_count
