# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class DealGuardV7(gl.Contract):

    verification_count: u32

    def __init__(self):
        self.verification_count = 0

    @gl.public.write
    def analyze_deal(
        self,
        title: str,
        description: str,
        deal_url: str,
        second_source_url: str
    ) -> str:

        if not title.strip():
            raise gl.UserError("Deal title cannot be empty")

        if not description.strip():
            raise gl.UserError("Deal description cannot be empty")

        if not deal_url.startswith("https://"):
            raise gl.UserError("Deal URL must use HTTPS")

        if not second_source_url.startswith("https://"):
            raise gl.UserError("Second source URL must use HTTPS")

        def analyze() -> str:

            primary_page = gl.nondet.web.get(deal_url)
            secondary_page = gl.nondet.web.get(second_source_url)

            primary_text = primary_page.body.decode("utf-8")
            secondary_text = secondary_page.body.decode("utf-8")

            prompt = f"""
You are DealGuard, an autonomous online deal verification system.

IMPORTANT:
This is a completely new verification request.
Do NOT use information from previous requests.
Do NOT assume the product is a PS5, Toyota, iPhone, or any other
previously tested product.

DEAL TITLE:
{title}

DEAL DESCRIPTION:
{description}

PRIMARY SOURCE:
{deal_url}

SECOND SOURCE:
{second_source_url}

PRIMARY SOURCE CONTENT:
{primary_text[:10000]}

SECOND SOURCE CONTENT:
{secondary_text[:10000]}

Your job is to independently determine whether THIS SPECIFIC DEAL
is trustworthy.

Compare the two supplied webpages.

Analyze:

- Product or service identity
- Advertised price
- Currency
- Seller
- Product specifications
- Availability
- Shipping
- Warranty
- Return policy
- Important conditions
- Contradictions
- Missing information
- Suspicious or unrealistic claims
- Possible fraud indicators

CRITICAL RULES:

1. Analyze only the current deal.
2. Never use a previous verification.
3. Never assume a product from an earlier request.
4. Do not invent facts.
5. Evidence must come only from the supplied webpages.
6. If a webpage is inaccessible, say so.
7. If the two sources do not actually verify the same deal,
   increase the risk.
8. A very low price alone is not proof of fraud, but it should
   be investigated against the available evidence.

Return ONLY valid JSON:

{{
    "verdict": "SAFE",
    "risk_score": 0,
    "confidence": 0,
    "summary": "Short explanation of the current deal",
    "reasons": [
        "reason 1",
        "reason 2",
        "reason 3"
    ],
    "evidence": [
        "evidence from the primary source",
        "evidence from the secondary source"
    ]
}}

verdict MUST be one of:

SAFE
RISKY
HIGH_RISK

risk_score:
0 = very low risk
100 = extremely high risk

confidence:
0 = very uncertain
100 = very confident
"""

            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json"
            )

            return json.dumps(result, sort_keys=True)

        criteria = """
The result must:

1. Be valid JSON.
2. Contain:
   verdict,
   risk_score,
   confidence,
   summary,
   reasons,
   evidence.
3. Use only SAFE, RISKY, or HIGH_RISK.
4. Use risk_score from 0 to 100.
5. Use confidence from 0 to 100.
6. Analyze the CURRENT deal only.
7. Compare the CURRENT two webpages.
8. Never rely on a previous transaction or previous result.
9. Never assume a fixed product.
10. Evidence must be based only on supplied webpage content.
"""

        result = gl.eq_principle.prompt_non_comparative(
            analyze,
            task="Independently verify the current online deal using two web sources.",
            criteria=criteria
        )

        self.verification_count += 1

        return result

    @gl.public.view
    def get_verification_count(self) -> u32:
        return self.verification_count
