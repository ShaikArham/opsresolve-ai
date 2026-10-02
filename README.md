# OpsResolve AI

**Enterprise support intelligence portfolio project by Shaik Arham Saquib.**

[Open the live demo](https://shaikarham.github.io/opsresolve-ai/)

OpsResolve AI is an interactive, fictional enterprise-support workspace. It brings incident records, SLA performance, recurring-issue investigation, knowledge procedures and an experimental triage layer into one browser-based demonstration.

## What you can explore

- 200 fictional incidents across six support categories and 12 systems
- Incident queue with search, filters, SLA-priority views and full ticket histories
- Operations dashboard with active workload, SLA exposure and support-team performance
- Recurring-issue investigation with linked incidents, affected users and relevant SOPs
- Knowledge base containing 26 fictional troubleshooting procedures
- Experimental triage lab that suggests categories, procedures and similar resolved cases
- Human-review controls that clearly keep recommendations separate from ticket changes

## Project workflow

```text
Synthetic incident dataset → Operational analytics → Procedure and historical retrieval → Human review
```

The demonstration is designed to show data modelling, support operations thinking, dashboard design and transparent AI-assistance boundaries.

## Technology

- HTML, CSS and vanilla JavaScript
- Local JSON dataset
- Browser-based TF-IDF retrieval and multinomial Naive Bayes category classification
- GitHub Pages hosting

## Run locally

Serve the repository with a local static web server. The site loads JSON files from `data/`, so opening `index.html` directly from a file browser may prevent all features from loading.

## Important scope notes

All people, systems, incidents, procedures and outcomes are fictional. The dataset was created for a portfolio demonstration.

The triage model is experimental. Its scores express model preference or text similarity, not calibrated confidence. Recommendations require human review and do not create or modify incidents. The reported evaluation figures do not establish production performance.

## Author

Shaik Arham Saquib · Data Analytics, ERP and Business Intelligence portfolio
