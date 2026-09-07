# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class DealGuardV8(gl.Contract):

    # Each verification is stored under its unique case ID.
    verifications: TreeMap[str, str]

    verification_count: u32

    def __init__(self):
        self.verification_count = 0

    @gl.public.write
    def analyze_deal(
        self,
        case_id: str,
        title: str,
        description: str,
        deal_url: str,
        second_source_url: str
    ) -> str:

        if not case_id:
            raise Exception("case_id cannot be empty")

        if not title:
            raise Exception("title cannot be empty")

        if not description:
            raise Exception("description cannot be empty")

        if not deal_url.startswith("https://"):
            raise Exception("deal_url must start with https://")

        if not second_source_url.startswith("https://"):
            raise Exception("second_source_url must start with https://")

        def analyze() -> str:

            try:
                primary_page = gl.nondet.web.get(deal_url)
                primary_text = primary_page.body.decode("utf-8")[:8000]
            except Exception as e:
                primary_text = (
                    f"Failed to fetch primary URL: {deal_url}. "
                    f"Error: {str(e)}"
                )

            try:
                secondary_page = gl.nondet.web.get(second_source_url)
                secondary_text = secondary_page.body.decode("utf-8")[:8000]
            except Exception as e:
                secondary_text = (
                    f"Failed to fetch secondary URL: {second_source_url}. "
                    f"Error: {str(e)}"
                )

            prompt = f"""
You are DealGuard V8, an intelligent online deal verification system.

Your task is to analyze an online deal using TWO independent web sources.

CASE ID:
{case_id}

DEAL TITLE:
{title}

DEAL DESCRIPTION:
{description}

PRIMARY URL:
{deal_url}

SECONDARY URL:
{second_source_url}

PRIMARY SOURCE CONTENT:
{primary_text}

SECONDARY SOURCE CONTENT:
{secondary_text}

Analyze both sources carefully.

Check:

- price consistency
- product identity
- seller identity
- warranty information
- return policy
- shipping information
- suspicious claims
- contradictions
- possible fraud indicators
- whether the two sources actually support the deal

IMPORTANT:
Only use information contained in the supplied source content.

Do not invent facts.

Return ONLY valid JSON:

{{
    "case_id": "{case_id}",
    "verdict": "SAFE",
    "risk_score": 0,
    "confidence": 90,
    "summary": "Short 2-3 sentence explanation",
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
- case_id must be exactly "{case_id}"
- evidence must refer ONLY to supplied content
- do not invent facts
"""

            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json"
            )

            return json.dumps(result, sort_keys=True)

        criteria = """
Output must be valid JSON.

Required fields:
case_id
verdict
risk_score
confidence
summary
reasons
evidence

Rules:

- verdict must be SAFE, RISKY, or HIGH_RISK
- risk_score must be 0-100
- confidence must be 0-100
- case_id must match the submitted case_id
- compare both webpages
- base claims only on supplied evidence
- do not invent facts
"""

        result = gl.eq_principle.prompt_non_comparative(
            analyze,
            task="Compare two web sources and verify an online deal for fraud risk.",
            criteria=criteria
        )

        parsed = json.loads(result)

        # Enforce the request-specific ID deterministically.
        parsed["case_id"] = case_id

        final_result = json.dumps(
            parsed,
            sort_keys=True
        )

        # Store the result under its unique case ID.
        self.verifications[case_id] = final_result

        self.verification_count += 1

        return final_result

    @gl.public.view
    def get_verification(
        self,
        case_id: str
    ) -> str:

        result = self.verifications.get(case_id, "")

        if result == "":
            return json.dumps({
                "case_id": case_id,
                "verdict": "UNKNOWN",
                "risk_score": 0,
                "confidence": 0,
                "summary": "Verification not found.",
                "reasons": [],
                "evidence": []
            })

        return result

    @gl.public.view
    def get_verification_count(self) -> u32:
        return self.verification_count
