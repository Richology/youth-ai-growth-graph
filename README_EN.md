# Richology Youth AI Growth Graph

> An open framework, competency graph, and practical methodology for youth learning through AI-enabled creation and value development.

[中文](README.md) · [Project Charter](docs/project-charter.md) · [Graph Specification](specification/graph-specification.md) · [Contributing](CONTRIBUTING.md)

## Why This Project Exists

We want to ask more than “What did the learner make?” We also ask:

- Which human capabilities developed through the work?
- How do these capabilities depend on and support one another?
- How can educators use the graph to design courses and projects?
- What evidence can support a careful capability judgment?
- How can families understand the growth behind a learning experience?

This project treats commercialization as a complete value-creation process: discovering real problems, collaborating with AI, making something useful, entering real contexts, receiving feedback, and iterating. It is not limited to teaching young people how to make money.

## Project Structure

| Part | Question | Main outputs |
|---|---|---|
| Open framework | How should youth growth in the AI era be understood? | Working paper, conceptual models, terminology |
| Competency graph | What capabilities matter, and how are they connected? | Nodes, relationships, proficiency levels, evidence guidance, cross-domain paths, and machine-readable data |
| Practical methodology | How can educators and learners use the graph? | Methods for courses, projects, assessment, and family communication |

In short: **the open framework defines the landscape, the competency graph marks its places and paths, and the methodology explains how to act within it.**

## Core Model

### Three Life Accounts

Wealth, health, and relationships are long-term directions that the project aims to serve. They are not three courses, nor outcomes that a single lesson can directly produce.

### Four Competency Domains

1. **AI Enablement:** AI boundaries, human–AI communication and collaboration, judgment and correction.
2. **Value Creation:** needs discovery, product development, and market validation.
3. **Professional Practice:** project management, professional communication, and self-directed action.
4. **Social Practice:** social awareness, collaboration, and responsible participation.

### Four Depths of Practice

Making, creative production, innovation, and entrepreneurship are not four additional competency domains. They describe increasing depths of practice through which learners combine capabilities and engage with the real world.

## Boundaries of Use

- This is not a validated psychometric assessment.
- It must not be used as a permanent label for a young person.
- It is not an established standard endorsed by an academic or professional community.
- Public examples must not contain identifiable source data from minors.

Claims are marked as principles, practice observations, hypotheses, or evidence. Node status and current dataset counts are defined in [`data/manifest.json`](data/manifest.json).

## Basic Learning Loop

```text
Discover a real problem → Collaborate with AI → Make something useful
                        → Enter a real context → Receive feedback
                        → Iterate → Build capability evidence
```

## Repository Layout

```text
framework/       Open framework, working paper, and terminology
specification/   Graph, relationship, proficiency, and evidence rules
data/            Machine-readable domains, competencies, and relationships
schema/          JSON Schema files
methodology/     Course, project, and assessment methods
examples/        Course mapping and evidence examples
rfcs/            Public proposals for significant changes
tools/           Validation, derived-data, and release-manifest tools
site/            Dual-view constellation and terrain website
```

The machine-readable layer separates nodes, relationships, external-framework alignments, learning paths, audience guidance, and evidence-elicitation tasks. Complete-file JSON Schemas and reproducible hashes make it suitable as a data source for course tools, search, and 2D or 3D graph interfaces. Applications must preserve the project’s minor-protection and non-psychometric boundaries.

## Website Development

The website uses Astro, TypeScript, and Three.js. Its deterministic constellation and terrain coordinates are generated from the source graph data at build time, so the site does not maintain a second copy of competency content.

```bash
cd site
npm install
npm run dev
npm run build
npm run test:e2e
```

See [`site/README.md`](site/README.md) for details.

## Contributing

Contributions may:

- identify overlapping, unclear, or missing capabilities;
- improve observable behaviors, evidence, and counter-evidence;
- add course mappings and project contexts;
- examine the graph from educational, AI, entrepreneurship, youth-development, privacy, or ethics perspectives.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing. Structural changes should begin with an RFC.

## Licensing

This repository uses multiple licenses:

- software: Apache License 2.0;
- graph database: ODbL 1.0;
- documentation, methodology, and templates: CC BY-SA 4.0;
- the Richology name and logo are not licensed under the terms above.

See [LICENSES/README.md](LICENSES/README.md) and [PROVENANCE.md](PROVENANCE.md) for complete terms, file scopes, and third-party source boundaries.

## Citation

For academic, research, or public citations, see [CITATION.cff](CITATION.cff).

## Contact and Discussion

Use GitHub Issues for specific problems and GitHub Discussions for open discussion.
