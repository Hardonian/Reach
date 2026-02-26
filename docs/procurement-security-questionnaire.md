# Procurement Security Questionnaire

This document provides answers to a standard set of security and compliance questions that may be asked during a procurement or vendor review process.

---

## A. Company Information

| Question | Answer |
| :--- | :--- |
| **Vendor Name** | Project Reach (Open Source) |
| **Product Name** | Reach CLI |
| **Product Description**| Reach is a command-line tool for ensuring deterministic and verifiable behavior in complex systems. |
| **Company Website** | [Link to GitHub Repository] |
| **Security Contact**| See `SECURITY.md` in our public repository for our responsible disclosure policy. |

## B. Information Security & Compliance

| Question | Answer |
| :--- | :--- |
| **Does your organization have a formal information security program?** | Yes. Our security program is documented publicly in our repository (`docs/security-posture.md`). It is managed by the core maintainers of the project. |
| **Are you audited by a third party? (e.g., SOC 2, ISO 27001)** | Not at this time. However, we have designed our processes to be "audit-ready" and maintain a structured evidence binder. We publish a request for a third-party audit in `docs/external-security-audit-request.md`. |
| **How do you classify data?** | The Reach CLI is a stateless tool that runs on the user's machine. It does not have access to, store, or transmit any customer data to us. Data classification is the responsibility of the user. |
| **Do you have a vulnerability management program?** | Yes. We automatically scan all dependencies for known vulnerabilities on every code change. We also have a documented policy for handling responsible disclosures of new vulnerabilities. See `docs/vulnerability-response-policy.md`. |
| **How do you handle security incidents?** | We have a formal Incident Response policy that outlines steps for containment, remediation, and communication. See `docs/incident-response.md`. |

## C. Application Security

| Question | Answer |
| :--- | :--- |
| **Do you follow a Secure Software Development Lifecycle (SSDLC)?** | Yes. Security is integrated into our development process through mandatory code reviews, automated security scanning (SAST, dependency scanning), and a documented threat model. |
| **Do you perform penetration testing on your application?** | We have not yet undergone a formal, third-party penetration test. We do conduct internal red team simulations to test our defenses. See `docs/red-team-simulation.md`. |
| **How are secrets managed within your application?** | The application is designed to be stateless and does not manage secrets itself. We instruct users to inject secrets via environment variables, delegating storage to a dedicated secrets management system. |
| **How do you secure your software supply chain?** | We follow SLSA Level 2 practices. Our key controls include: dependency locking, automated vulnerability scanning, reproducible builds, and cryptographically signing all release artifacts with `cosign`. A full Software Bill of Materials (SBOM) is provided with every release. |
| **Are your software builds reproducible?** | Yes, on a per-OS basis. We document the process for any user to verify that the binary we release is identical to the one built from the corresponding source code. See `docs/reproducible-builds.md`. |

## D. Infrastructure & Operations

| Question | Answer |
| :--- | :--- |
| **Describe your production environment.** | Not applicable. Reach is a CLI tool that is downloaded and run entirely within the user's environment. We do not operate a SaaS service. |
| **How do you control access to your build and release environment?** | Our build environment is GitHub Actions. Access is controlled via GitHub's organization and repository permission model. We enforce branch protection rules and require multiple reviewers for any changes to the build and release workflows. |
| **How are release artifacts protected from tampering?** | All release artifacts, along with a manifest of their SHA256 hashes, are cryptographically signed using `cosign`. We document the verification process for our users. This ensures that any tampering would be detected. |

## E. Data Privacy

| Question | Answer |
| :--- | :--- |
| **What types of customer data do you process?** | None. The tool runs locally and does not transmit any data to us. |
| **Is the tool compliant with GDPR / CCPA?** | Not applicable, as we do not process any personal data. The user is responsible for ensuring their use of the tool on their own data is compliant with relevant regulations. |
