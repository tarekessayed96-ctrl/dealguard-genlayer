# DealGuard

## Don't trust the deal. Verify it.

DealGuard is a GenLayer-powered deal risk verification platform.

Users submit an online deal, and DealGuard uses a GenLayer Intelligent Contract
to analyze the deal and evaluate potential risks using information retrieved
from the provided webpage.

## How It Works

1. User submits a deal title.
2. User provides a short description.
3. User provides the deal URL.
4. DealGuard retrieves the webpage.
5. GenLayer analyzes the available evidence.
6. The Intelligent Contract produces a risk assessment.
7. The result includes a verdict, risk score, summary, and reasons.

## Verdicts

- SAFE — No significant risk detected from the available evidence.
- RISKY — Potential issues or missing evidence were detected.
- HIGH_RISK — Strong risk indicators were detected.

## Risk Score

The risk score ranges from 0 to 100.

A higher score indicates a higher level of detected risk.

## Why GenLayer?

DealGuard is designed around GenLayer Intelligent Contracts.

The verification workflow depends on GenLayer's ability to combine
web-accessible information with AI-based analysis and decentralized
validation.

This makes GenLayer a core part of the product rather than an optional
integration.

## Current Features

- Deal URL analysis
- Webpage content retrieval
- AI-powered risk analysis
- Risk score from 0–100
- SAFE / RISKY / HIGH_RISK verdicts
- Evidence-based reasoning
- On-chain verification state
- Intelligent Contract architecture

## Project Structure

```text
dealguard-genlayer/
├── contracts/
│   └── deal_guard.py
├── tests/
│   └── test_deal_guard.py
└── README.md
