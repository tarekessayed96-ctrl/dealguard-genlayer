# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class DealGuard(gl.Contract):
    last_title: str
    last_description: str
    last_url: str
    last_verdict: str
    last_risk_score: u32
    last_analysis: str
    verification_count: u32

    def __init__(self):
        self.last_title = ""
        self.last_description = ""
        self.last_url = ""
        self.last_verdict = ""
        self.last_risk_score = 0
        self.last_analysis = ""
        self.verification_count = 0

    @gl.public.write
    def analyze_deal(
        self,
        title: str,
        description: str,
        deal_url: str
    ) -> str:

        def analyze() -> str:
            page = gl.nondet.web.get(deal_url)
            page_text = page.body.decode("utf-8")

            prompt = f"""
You are DealGuard, a decentralized online deal risk
analysis system.

Analyze the deal using the actual webpage content.

DEAL TITLE:
{title}

DEAL DESCRIPTION:
{description}

DEAL URL:
{deal_url}

WEBPAGE CONTENT:
{page_text[:12000]}

Evaluate:

1. Suspicious or unrealistic claims
2. Missing information
3. Seller or offer risks
4. Warranty and return-policy risks
5. Misleading language
6. Possible fraud indicators
7. Contradictions between the description and webpage
8. Important information found on the webpage

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
    ]
}}

Rules:
- verdict must be SAFE, RISKY, or HIGH_RISK
- risk_score must be an integer from 0 to 100
- confidence must be an integer from 0 to 100
- reasons must be based on available evidence
- do not invent facts
"""

            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json"
            )

            return json.dumps(result, sort_keys=True)

        criteria = """
The result must:

1. Be valid JSON.
2. Contain verdict, risk_score, confidence, summary, and reasons.
3. Use verdict SAFE, RISKY, or HIGH_RISK.
4. Use risk_score from 0 to 100.
5. Use confidence from 0 to 100.
6. Base the assessment on the supplied deal information
   and webpage content.
7. Avoid inventing facts.
8. Provide reasons supported by the available evidence.
"""

        result = gl.eq_principle.prompt_non_comparative(
            analyze,
            task="Analyze the online deal and produce a DealGuard risk assessment.",
            criteria=criteria
        )

        parsed = json.loads(result)

        self.last_title = title
        self.last_description = description
        self.last_url = deal_url
        self.last_verdict = parsed["verdict"]
        self.last_risk_score = parsed["risk_score"]
        self.last_analysis = result
        self.verification_count += 1

        return result

    @gl.public.view
    def get_last_verification(self) -> str:
        return self.last_analysis

    @gl.public.view
    def get_verification_count(self) -> u32:
        return self.verification_count
