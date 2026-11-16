# Reform

AI-powered frontend refactoring for existing applications.

Reform helps teams improve an interface’s visual design while preserving the product behavior behind it. Start with a GitHub repository, choose a design direction, and turn the redesign into code that can be reviewed and integrated.

**First-place project at LotusHacks 2026 in Vietnam.**

[Explore Reform](https://refineui-chi.vercel.app)

## Why Reform?

A working product can still have inconsistent spacing, unclear visual hierarchy, or dated components. Improving those interfaces often requires substantial implementation work alongside design decisions.

Reform focuses on that gap: upgrading the presentation layer of an existing application while keeping its underlying logic intact.

## Workflow

1. **Connect a repository** — Start with an existing frontend.
2. **Choose a direction** — Define the visual style for the redesign.
3. **Refine individual elements** — Select an element and describe the change in plain language.
4. **Review the output** — Export components or review changes through a GitHub pull request.

## Capabilities

### Frontend redesign

Improve spacing, typography, layout, and component consistency across an existing interface.

### Targeted editing

Use Edit Lab to select interface elements and request focused changes through natural-language instructions.

### Code output

Generate React components using Tailwind CSS and TypeScript, rather than delivering a static mockup.

### GitHub workflow

Move generated changes into a new branch and pull request for review before merging.

## Design goals

- Preserve existing interactions, handlers, navigation, and backend integrations.
- Improve visual hierarchy and consistency across screens.
- Produce implementation-ready changes that developers can inspect.
- Keep redesign work focused on the frontend presentation layer.

These are the project's intended goals; generated changes should be reviewed and tested before deployment.

## Technology

- **Frontend:** TypeScript, React, Next.js, Tailwind CSS
- **Backend:** Python
- **Testing:** Vitest

## Repository structure

| Directory | Contents |
| --- | --- |
| `frontend/` | Frontend application |
| `backend/` | Backend services |
| `__tests__/` | Automated tests |
| `video/` | Project video assets |

## Background

Reform was built collaboratively for LotusHacks 2026 in Vietnam, where the team won first place. Development continued after the hackathon, including improvements to the generation pipeline, editing experience, and project history.

## Contributors

Built by the Reform team. See the repository's contributor list and commit history for individual contributions.


<img width="1045" height="692" alt="Screenshot 2026-11-16 at 11 35 45 AM" src="https://github.com/user-attachments/assets/204ce12a-9006-4562-9919-313dd4d078ef" />
