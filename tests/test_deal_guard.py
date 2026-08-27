import pytest

from contracts.deal_guard import DealGuard


def test_contract_initial_state():
    contract = DealGuard()

    assert contract.last_title == ""
    assert contract.last_description == ""
    assert contract.last_verdict == ""
    assert contract.last_risk_score == 0
    assert contract.last_analysis == ""
