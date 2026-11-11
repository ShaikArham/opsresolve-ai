<div align="center">

# OPSRESOLVE / AI

### FROM INCIDENT SIGNAL TO THE NEXT DEFENSIBLE ACTION.

**An interactive enterprise-support investigation lab.**  
Explore incident operations, SLA exposure, recurring problems and experimental AI-assisted triage in one browser workspace.

[**Launch the live demo**](https://shaikarham.github.io/opsresolve-ai/) · [**Explore the source**](https://github.com/ShaikArham/opsresolve-ai) · [**Meet the builder**](https://arham-bi.vercel.app/)

![Live demo](https://img.shields.io/badge/Demo-GitHub%20Pages-075d60?style=flat-square) ![Data](https://img.shields.io/badge/Dataset-100%25%20fictional-334155?style=flat-square) ![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS-111827?style=flat-square) ![Approach](https://img.shields.io/badge/AI-Human%20review%20required-633c91?style=flat-square)

*Built by Shaik Arham Saquib · Dublin, Ireland*

</div>

---

## 01 / THE QUESTION

**When a support queue fills up, what should an analyst investigate first, and how can they justify the decision?**

A list of tickets is not an investigation. Support teams also need to see which cases threaten service commitments, which failures recur, what historical evidence exists and which troubleshooting procedures are relevant.

OpsResolve AI is my portfolio exploration of that workflow. It combines **operational reporting, incident investigation and retrieval-assisted suggestions** while keeping the final decision with a human reviewer.

> **Design principle:** Surface the evidence. Explain the recommendation. Leave the action to the analyst.

## 02 / WHAT YOU CAN EXPLORE

| Workspace | The question it helps answer |
| :--- | :--- |
| **Incident queue** | Which cases need attention, and why? |
| **Operations dashboard** | Where is workload or SLA exposure concentrated? |
| **Ticket histories** | What happened to this incident over time? |
| **Recurring-issue investigation** | Are multiple tickets connected to the same underlying issue? |
| **Knowledge base** | Which documented troubleshooting procedures are relevant? |
| **Experimental triage lab** | What category, procedure or similar case might help an analyst investigate? |

[**Open the interactive workspace →**](https://shaikarham.github.io/opsresolve-ai/)

## 03 / THE EVIDENCE

<div align="center">

| **200** | **26** | **12** | **6** |
| :---: | :---: | :---: | :---: |
| Fictional incidents | Troubleshooting procedures | Simulated systems | Support categories |

</div>

The demo includes incident search, filtering, SLA-priority views, histories and operational summaries. These counts describe the **scope of the fictional dataset**, not measured production impact.

### A representative investigation

1. **Detect:** Review the incident queue and operational indicators for cases requiring attention.
2. **Inspect:** Open the ticket history and examine the affected system and support context.
3. **Connect:** Look for recurring patterns and related incidents.
4. **Retrieve:** Review relevant procedures and previously resolved examples.
5. **Decide:** Use the suggested next steps as supporting evidence, not automatic instructions.

This sequence is an illustration of the intended workflow, not a claim of autonomous incident resolution.

## 04 / HOW THE TRIAGE LAYER WORKS

```text
            FICTIONAL INCIDENT RECORDS
                       │
            Search · Filter · Inspect
                       │
          ┌────────────┴────────────┐
          │                         │
    Operations views          Investigation context
    SLA / workload            History / recurrence
          │                         │
          └────────────┬────────────┘
                       │
                EXPERIMENTAL TRIAGE
                       │
          ┌────────────┼────────────┐
          │            │            │
      Category      Relevant     Similar
      suggestion    procedures   resolved cases
          │            │            │
          └────────────┼────────────┘
                       │
                  HUMAN REVIEW
                       │
            Analyst decides next step
```

The browser-based engine uses **TF-IDF retrieval** for text relevance and **multinomial Naive Bayes** for experimental category classification. Its scores represent model preference or text similarity, **not calibrated probabilities or guaranteed correctness**.

The demo does **not** silently change tickets or execute production remediations.

## 05 / ENGINEERING NOTES

| Layer | Implementation |
| :--- | :--- |
| Interface | HTML, CSS, vanilla JavaScript |
| Data | Local JSON fixtures |
| Investigation logic | Browser-side operational views and linked records |
| Experimental assistance | TF-IDF retrieval and multinomial Naive Bayes |
| Delivery | Static site on GitHub Pages |

### Repository map

```text
opsresolve-ai/
├── index.html          # Main application markup
├── app.js              # Workspace interactions and presentation
├── engine.js           # Experimental retrieval/classification logic
├── data/               # Fictional support data and procedures
├── opsresolve-mark.svg # Project identity
├── README.md           # Project guide
└── LICENSE
```

### Run locally

```bash
git clone https://github.com/ShaikArham/opsresolve-ai.git
cd opsresolve-ai
python -m http.server 8000
```

Open **http://localhost:8000/**. Serve over HTTP rather than opening `index.html` as a local file, because browsers can restrict loading the JSON data via `file://`.

## 06 / WHAT THIS PROJECT DEMONSTRATES

**Operational judgment.** Prioritisation should be grounded in service exposure, case history and the available evidence.

**Data fluency.** Incident records become useful when analysts can filter, relate, summarise and interrogate them.

**Explainable assistance.** A model suggestion should be inspectable and challengeable, not presented as an unquestionable decision.

**Support-first design.** A useful tool makes the next investigation step clearer without concealing uncertainty.

These are the design goals demonstrated by the prototype. They are not claims of deployment inside a real customer support organisation.

## 07 / SCOPE & TRUST

- All incident records, people, systems, procedures and outcomes are **fictional**.
- The project is an **independent portfolio demonstration**, not a production service desk.
- Triage outputs are experimental; classification scores and similarity values are **not calibrated confidence**.
- Recommendations require human review and do not create, update or resolve real incidents.
- Any model evaluation in the demo applies only to its experimental data and does not establish production accuracy, SLA improvement or time savings.
- No employer-internal data, systems or confidential support procedures are represented.

## 08 / WHY I BUILT IT

My professional background includes enterprise BI, ERP/application support, SQL-based investigation, operational monitoring and reporting. I wanted a project that connects those responsibilities to a visible, interactive support workflow.

**OpsResolve AI shows how I approach ambiguous operational problems:** establish the facts, investigate the pattern, retrieve relevant knowledge and communicate a defensible next step.

---

<div align="center">

### GOOD SUPPORT STARTS WITH GOOD EVIDENCE.

[**Try OpsResolve AI**](https://shaikarham.github.io/opsresolve-ai/) · [**View my portfolio**](https://arham-bi.vercel.app/) · [**Read my CV**](https://github.com/ShaikArham/arham-portfolio/blob/main/assets/Shaik_Arham_Saquib.pdf) · [**Contact me**](mailto:sarhamsaquib@gmail.com)

<sub>Shaik Arham Saquib · Business Intelligence · Data Analytics · Application Support</sub>

</div>
