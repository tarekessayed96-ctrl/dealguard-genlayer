# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class DealGuardV9(gl.Contract):

    # Every verification is stored under its unique case ID.
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

        # ---------------------------------------------------------
        # 1. Validate request
        # ---------------------------------------------------------

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

        # ---------------------------------------------------------
        # 2. Safe fallback result
        # ---------------------------------------------------------

        def fallback_result(reason: str) -> str:
            return json.dumps({
                "case_id": case_id,
                "verdict": "RISKY",
                "risk_score": 75,
                "confidence": 100,
                "summary": (
                    "DealGuard could not complete a reliable verification "
                    "of the supplied deal."
                ),
                "reasons": [
                    reason,
                    "The available evidence was insufficient for a SAFE verdict.",
                    "The deal should be independently verified before purchase."
                ],
                "evidence": []
            }, sort_keys=True)

        # ---------------------------------------------------------
        # 3. Analysis performed by GenLayer
        # ---------------------------------------------------------

        def analyze() -> str:

            # ---------------------------------------------
            # Fetch primary source
            # ---------------------------------------------

            try:
                primary_page = gl.nondet.web.get(deal_url)

                primary_text = (
                    primary_page.body
                    .decode("utf-8")
                    [:8000]
                )

                if not primary_text:
                    primary_text = (
                        "Primary source was successfully reached, "
                        "but returned empty content."
                    )

            except Exception as e:

                primary_text = (
                    f"PRIMARY_SOURCE_ERROR: "
                    f"Could not retrieve {deal_url}. "
                    f"Error: {str(e)}"
                )

            # ---------------------------------------------
            # Fetch secondary source
            # ---------------------------------------------

            try:
                secondary_page = gl.nondet.web.get(second_source_url)

                secondary_text = (
                    secondary_page.body
                    .decode("utf-8")
                    [:8000]
                )

                if not secondary_text:
                    secondary_text = (
                        "Secondary source was successfully reached, "
                        "but returned empty content."
                    )

            except Exception as e:

                secondary_text = (
                    f"SECONDARY_SOURCE_ERROR: "
                    f"Could not retrieve {second_source_url}. "
                    f"Error: {str(e)}"
                )

            # ---------------------------------------------
            # Build analysis prompt
            # ---------------------------------------------

            prompt = f"""
You are DealGuard V9, an online deal verification system.

Analyze the supplied deal using the two supplied web sources.

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

Analyze:

1. Product identity
2. Price consistency
3. Seller identity
4. Warranty
5. Return policy
6. Shipping information
7. Suspicious claims
8. Contradictions
9. Whether both sources actually support the advertised deal

IMPORTANT RULES:

- Use ONLY the supplied source content.
- Never invent facts.
- If a source failed to load, explicitly say so.
- If both URLs are identical, treat them as NOT independent sources.
- Missing evidence should increase uncertainty/risk.
- Do not assume that missing information means the deal is safe.

Return ONLY valid JSON.

Required structure:

{{
    "case_id": "{case_id}",
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
        "evidence 1",
        "evidence 2"
    ]
}}

Rules:

verdict:
SAFE, RISKY, or HIGH_RISK

risk_score:
integer from 0 to 100

confidence:
integer from 0 to 100

case_id:
must exactly equal "{case_id}"

The evidence array must contain only information present
in the supplied source content.
"""

            # ---------------------------------------------
            # Execute model safely
            # ---------------------------------------------

            try:

                result = gl.nondet.exec_prompt(
                    prompt,
                    response_format="json"
                )

            except Exception as e:

                return fallback_result(
                    "The AI analysis could not be completed: "
                    + str(e)
                )

            # ---------------------------------------------
            # Validate model output
            # ---------------------------------------------

            if result is None:
                return fallback_result(
                    "The AI analysis returned no result."
                )

            if not isinstance(result, str):
                try:
                    result = json.dumps(result, sort_keys=True)
                except Exception:
                    return fallback_result(
                        "The AI analysis returned an unsupported result."
                    )

            if not result.strip():
                return fallback_result(
                    "The AI analysis returned an empty response."
                )

            # ---------------------------------------------
            # Parse JSON safely
            # ---------------------------------------------

            try:

                parsed = json.loads(result)

            except Exception:

                return fallback_result(
                    "The AI analysis returned invalid JSON."
                )

            # ---------------------------------------------
            # Validate parsed object
            # ---------------------------------------------

            if not isinstance(parsed, dict):
                return fallback_result(
                    "The AI analysis returned an invalid data structure."
                )

            # ---------------------------------------------
            # Enforce request identity
            # ---------------------------------------------

            parsed["case_id"] = case_id

            # ---------------------------------------------
            # Validate verdict
            # ---------------------------------------------

            verdict = parsed.get("verdict", "")

            if verdict not in [
                "SAFE",
                "RISKY",
                "HIGH_RISK"
            ]:
                parsed["verdict"] = "RISKY"

            # ---------------------------------------------
            # Validate risk score
            # ---------------------------------------------

            risk_score = parsed.get("risk_score", 75)

            try:
                risk_score = int(risk_score)
            except Exception:
                risk_score = 75

            if risk_score < 0:
                risk_score = 0

            if risk_score > 100:
                risk_score = 100

            parsed["risk_score"] = risk_score

            # ---------------------------------------------
            # Validate confidence
            # ---------------------------------------------

            confidence = parsed.get("confidence", 50)

            try:
                confidence = int(confidence)
            except Exception:
                confidence = 50

            if confidence < 0:
                confidence = 0

            if confidence > 100:
                confidence = 100

            parsed["confidence"] = confidence

            # ---------------------------------------------
            # Validate summary
            # ---------------------------------------------

            if not isinstance(
                parsed.get("summary"),
                str
            ):
                parsed["summary"] = (
                    "DealGuard completed the verification "
                    "but returned limited analysis details."
                )

            # ---------------------------------------------
            # Validate reasons
            # ---------------------------------------------

            if not isinstance(
                parsed.get("reasons"),
                list
            ):
                parsed["reasons"] = []

            # ---------------------------------------------
            # Validate evidence
            # ---------------------------------------------

            if not isinstance(
                parsed.get("evidence"),
                list
            ):
                parsed["evidence"] = []

            # ---------------------------------------------
            # Final deterministic JSON
            # ---------------------------------------------

            return json.dumps(
                parsed,
                sort_keys=True
            )

        # ---------------------------------------------------------
        # 4. Consensus / equivalence
        # ---------------------------------------------------------

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
- risk_score must be an integer from 0 to 100
- confidence must be an integer from 0 to 100
- case_id must match the submitted case_id
- compare both supplied web sources
- use only supplied source content
- do not invent facts
- missing evidence must not be treated as proof of safety
"""

        try:

            result = gl.eq_principle.prompt_non_comparative(
                analyze,
                task=(
                    "Verify an online deal using two web sources "
                    "and assess fraud risk."
                ),
                criteria=criteria
            )

        except Exception as e:

            result = fallback_result(
                "Consensus analysis failed: " + str(e)
            )

        # ---------------------------------------------------------
        # 5. Final validation before storage
        # ---------------------------------------------------------

        try:

            parsed = json.loads(result)

        except Exception:

            parsed = json.loads(
                fallback_result(
                    "The final verification result was invalid."
                )
            )

        if not isinstance(parsed, dict):
            parsed = json.loads(
                fallback_result(
                    "The final verification result had an invalid structure."
                )
            )

        # Always bind the result to this exact request.
        parsed["case_id"] = case_id

        # Safe defaults
        if parsed.get("verdict") not in [
            "SAFE",
            "RISKY",
            "HIGH_RISK"
        ]:
            parsed["verdict"] = "RISKY"

        try:
            parsed["risk_score"] = int(
                parsed.get("risk_score", 75)
            )
        except Exception:
            parsed["risk_score"] = 75

        if parsed["risk_score"] < 0:
            parsed["risk_score"] = 0

        if parsed["risk_score"] > 100:
            parsed["risk_score"] = 100

        try:
            parsed["confidence"] = int(
                parsed.get("confidence", 50)
            )
        except Exception:
            parsed["confidence"] = 50

        if parsed["confidence"] < 0:
            parsed["confidence"] = 0

        if parsed["confidence"] > 100:
            parsed["confidence"] = 100

        if not isinstance(parsed.get("summary"), str):
            parsed["summary"] = (
                "DealGuard completed the verification "
                "with limited available evidence."
            )

        if not isinstance(parsed.get("reasons"), list):
            parsed["reasons"] = []

        if not isinstance(parsed.get("evidence"), list):
            parsed["evidence"] = []

        final_result = json.dumps(
            parsed,
            sort_keys=True
        )

        # ---------------------------------------------------------
        # 6. Store result by unique case ID
        # ---------------------------------------------------------

        self.verifications[case_id] = final_result

        self.verification_count += 1

        return final_result

    # -------------------------------------------------------------
    # Read verification by request-specific case ID
    # -------------------------------------------------------------

    @gl.public.view
    def get_verification(
        self,
        case_id: str
    ) -> str:

        result = self.verifications.get(
            case_id,
            ""
        )

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

    # -------------------------------------------------------------
    # Verification count
    # -------------------------------------------------------------

    @gl.public.view
    def get_verification_count(self) -> u32:
        return self.verification_count
