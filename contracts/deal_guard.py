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

        task = f"""
You are DealGuard, an online deal risk analysis system.

Analyze the deal using the actual webpage content.

DEAL TITLE:
{title}

DEAL DESCRIPTION:
{description}

DEAL URL:
{deal_url}

Identify:

1. Suspicious or unrealistic claims
2. Missing information
3. Seller or offer risks
4. Warranty and return-policy risks
5. Misleading language
6. Possible fraud indicators
7. Contradictions between the user's description and the webpage
8. Important information found on the webpage

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

Rules:

verdict must be exactly one of:
SAFE
RISKY
HIGH_RISK

risk_score must be an integer from 0 to 100.
"""

        criteria = """
The analysis must:

- Be based only on the supplied webpage content and deal information.
- Identify meaningful risks supported by the evidence.
- Use a risk_score between 0 and 100.
- Use exactly SAFE, RISKY, or HIGH_RISK as the verdict.
- Keep the summary consistent with the evidence.
- Never invent facts that are not present in the provided information.
"""

        def get_deal_page():
            response = gl.nondet.web.get(deal_url)
            return response.body.decode("utf-8")

        def analyze_page(page_content):
            prompt = f"""
{task}

WEBPAGE CONTENT:
{page_content[:12000]}
"""
            return gl.nondet.exec_prompt(prompt)

        def analyze():
            page_content = get_deal_page()
            return analyze_page(page_content)

        result = gl.eq_principle.prompt_non_comparative(
            analyze,
            task=task,
            criteria=criteria
        )

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
